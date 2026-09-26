import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleInboundMessage } from "@/modules/agent/inbound";
import { isForwardTransition } from "@/modules/send/sim-progress";
import type { MessageStatus, Prisma } from "@prisma/client";

// Validate nested arrays before processing; Meta can include additional fields.
const valueSchema = z.object({
  statuses: z.array(z.object({ id: z.string().optional(), status: z.string().optional(), errors: z.array(z.object({ code: z.union([z.number(), z.string()]).optional() })).optional(), pricing: z.object({ amount_1000: z.number().optional() }).optional() })).optional(),
  messages: z.array(z.object({ id: z.string().optional(), from: z.string().optional(), text: z.object({ body: z.string().optional() }).optional() })).optional(),
  metadata: z.object({ phone_number_id: z.string().optional() }).optional(),
  event: z.string().optional(), message_template_name: z.string().optional(), reason: z.string().optional(),
});
const payloadSchema = z.object({ object: z.literal("whatsapp_business_account"), entry: z.array(z.object({ id: z.string(), changes: z.array(z.object({ field: z.string(), value: valueSchema.optional() })) })) });
const STATUS_MAP: Record<string, MessageStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };

/** Called only AFTER raw-body signature verification with the selected app. */
export async function processWhatsappWebhook(rawBody: string, connection?: { id: string; orgId: string }) {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const payload = parsed.data;
  const scope: Prisma.WhatsappAccountWhereInput = connection
    ? { orgId: connection.orgId }
    : { OR: [{ org: { whatsappConnection: { is: null } } }, { org: { whatsappConnection: { is: { activeAt: null } } } }] };
  const event = await prisma.webhookEvent.create({ data: { raw: raw as Prisma.InputJsonValue, type: payload.object } });
  let received = false;
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field === "messages" && change.value?.metadata?.phone_number_id) {
        const account = await prisma.whatsappAccount.findFirst({ where: { ...scope, wabaId: entry.id, phoneNumberId: change.value.metadata.phone_number_id } });
        if (!account) continue;
        await processStatuses(change.value.statuses ?? [], account.orgId);
        received = (await processInbound(change.value.messages ?? [], account)) || received;
      }
      if (change.field === "message_template_status_update") await processTemplateUpdate(change.value, entry.id, scope);
    }
  }
  if (connection && received) await prisma.whatsappConnection.update({ where: { id: connection.id }, data: { lastInboundAt: new Date() } });
  await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string; // the WABA id for this entry
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ code?: number | string }>;
          pricing?: { amount_1000?: number };
        }>;
        messages?: Array<{ id?: string; from?: string; text?: { body?: string } }>;
        metadata?: { phone_number_id?: string };
        event?: string;
        message_template_name?: string;
        reason?: string;
      };
    }>;
  }>;
}

async function processStatuses(
  statuses: NonNullable<
    NonNullable<
      NonNullable<WebhookPayload["entry"]>[number]["changes"]
    >[number]["value"]
  >["statuses"],
  orgId: string
) {
  for (const status of statuses ?? []) {
    if (!status?.id || !status.status) continue;
    const next = STATUS_MAP[status.status];
    if (!next) continue;

    const message = await prisma.message.findFirst({
      where: { metaMessageId: status.id, campaign: { orgId } },
    });
    // Idempotent + tolerant of out-of-order delivery.
    if (!message || !isForwardTransition(message.status, next)) continue;

    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: next,
        errorCode: status.errors?.[0]?.code?.toString() ?? message.errorCode,
        costMinorUnits:
          // amount_1000 = INR × 1000 → paise = /10
          status.pricing?.amount_1000 != null
            ? Math.round(status.pricing.amount_1000 / 10)
            : message.costMinorUnits,
      },
    });
  }
}

async function processInbound(
  messages: Array<{ id?: string; from?: string; text?: { body?: string } }>,
  account: { id: string; orgId: string }
) {
  let received = false;
  for (const inbound of messages ?? []) {
    const text = inbound.text?.body ?? "";
    if (!inbound.from || !text || !inbound.id) continue;
    received = true;
    // Meta redelivers a webhook it considers failed (slow reply, non-200), so
    // the same message id can arrive more than once — reply to each wamid once.
    if (inbound.id) {
      const seen = await prisma.conversationMessage.findFirst({
        where: { metaMessageId: inbound.id, direction: "inbound", conversation: { orgId: account.orgId, whatsappAccountId: account.id } },
        select: { id: true },
      });
      if (seen) continue;
    }
    // Threads the conversation, handles STOP, and auto-replies if the agent
    // is enabled (see lib/agent/inbound.ts).
    //
    // Isolated per message: Meta batches several customers into one delivery,
    // and an unhandled throw here would 500 the whole request — dropping
    // everyone else in the batch and making Meta redeliver the lot, which
    // just repeats the same failure. The agent already answers with the
    // handoff line when the MODEL fails; this is the backstop for everything
    // else, and it must stay quiet-but-logged rather than loud-and-fatal.
    try {
      await handleInboundMessage(account.orgId, inbound.from, text, {
        metaMessageId: inbound.id,
        // E4: the number the customer wrote to — replies leave from it.
        whatsappAccountId: account.id,
      });
    } catch (err) {
      console.error(
        `[webhook] inbound ${inbound.id ?? "(no id)"} for org ${account.orgId} failed`,
        err
      );
    }
  }
  return received;
}

async function processTemplateUpdate(
  value:
    | {
        event?: string;
        message_template_name?: string;
        reason?: string;
      }
    | undefined,
  wabaId: string | undefined,
  scope: Prisma.WhatsappAccountWhereInput
) {
  if (!value?.message_template_name || !value.event || !wabaId) return;
  // Only accounts authorized by this verified connection can change templates.
  const accounts = await prisma.whatsappAccount.findMany({
    where: { wabaId, ...scope },
    select: { orgId: true },
  });
  if (accounts.length === 0) return;
  for (const account of accounts) {
    await applyTemplateStatus(account.orgId, value);
  }
}

async function applyTemplateStatus(
  orgId: string,
  value: { event?: string; message_template_name?: string; reason?: string }
) {
  const template = await prisma.template.findFirst({
    where: { name: value.message_template_name, orgId },
    orderBy: { submittedAt: "desc" },
  });
  if (!template) return;
  // Library templates (no campaign) still track status; only linked campaigns
  // transition with the review outcome.
  const campaignId = template.campaignId;

  if (value.event === "APPROVED") {
    await prisma.$transaction([
      prisma.template.update({
        where: { id: template.id },
        data: { metaStatus: "APPROVED", rejectionReason: null },
      }),
      ...(campaignId
        ? [
            prisma.campaign.update({
              where: { id: campaignId },
              data: { status: "TEMPLATE_APPROVED" as const },
            }),
          ]
        : []),
    ]);
  } else if (value.event === "REJECTED") {
    await prisma.$transaction([
      prisma.template.update({
        where: { id: template.id },
        data: {
          metaStatus: "REJECTED",
          rejectionReason: value.reason ?? "Rejected by Meta",
        },
      }),
      ...(campaignId
        ? [
            prisma.campaign.update({
              where: { id: campaignId },
              data: { status: "DRAFT" as const },
            }),
          ]
        : []),
    ]);
  }
}
