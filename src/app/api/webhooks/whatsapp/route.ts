import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/modules/whatsapp/webhook-verify";
import { handleInboundMessage } from "@/modules/agent/inbound";
import { isForwardTransition } from "@/modules/send/sim-progress";
import type { MessageStatus } from "@prisma/client";

/**
 * WhatsApp Cloud API webhook: signature-verified, idempotent.
 * - message status updates (sent/delivered/read/failed + pricing)
 * - template status updates (approve/reject)
 * - inbound messages: STOP → permanent opt-out (rule 2)
 */

/** Constant-time string compare (mirrors the HMAC checks elsewhere). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Subscription verification handshake
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    expected.length > 0 &&
    timingSafeEqualStr(searchParams.get("hub.verify_token") ?? "", expected)
  ) {
    return new Response(searchParams.get("hub.challenge") ?? "", {
      status: 200,
    });
  }
  return new Response("Forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!env.META_APP_SECRET) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  const valid = verifyWebhookSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    env.META_APP_SECRET
  );
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Store raw first (audit + idempotent reprocessing), then process.
  const event = await prisma.webhookEvent.create({
    data: { raw: JSON.parse(rawBody), type: payload.object ?? "unknown" },
  });

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "messages") {
        await processStatuses(change.value?.statuses ?? []);
        await processInbound(
          change.value?.messages ?? [],
          change.value?.metadata?.phone_number_id
        );
      }
      if (change.field === "message_template_status_update") {
        // entry.id is the WABA id — scope the update to the org that owns it.
        await processTemplateUpdate(change.value, entry.id);
      }
    }
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });
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
  >["statuses"]
) {
  for (const status of statuses ?? []) {
    if (!status?.id || !status.status) continue;
    const next = STATUS_MAP[status.status];
    if (!next) continue;

    const message = await prisma.message.findFirst({
      where: { metaMessageId: status.id },
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
  phoneNumberId?: string
) {
  if (!phoneNumberId) return;
  const account = await prisma.whatsappAccount.findFirst({
    where: { phoneNumberId },
  });
  if (!account) return; // unknown number — ignore

  for (const inbound of messages ?? []) {
    const text = inbound.text?.body ?? "";
    if (!inbound.from || !text) continue;
    // Meta redelivers a webhook it considers failed (slow reply, non-200), so
    // the same message id can arrive more than once — reply to each wamid once.
    if (inbound.id) {
      const seen = await prisma.conversationMessage.findFirst({
        where: { metaMessageId: inbound.id, direction: "inbound" },
        select: { id: true },
      });
      if (seen) continue;
    }
    // Threads the conversation, handles STOP, and auto-replies if the agent
    // is enabled (see lib/agent/inbound.ts).
    await handleInboundMessage(account.orgId, inbound.from, text, {
      metaMessageId: inbound.id,
      // E4: the number the customer wrote to — replies leave from it.
      whatsappAccountId: account.id,
    });
  }
}

async function processTemplateUpdate(
  value:
    | {
        event?: string;
        message_template_name?: string;
        reason?: string;
      }
    | undefined,
  wabaId: string | undefined
) {
  if (!value?.message_template_name || !value.event || !wabaId) return;
  // Tenant isolation: template names are only unique per WABA, so scope the
  // lookup to the org(s) connected to this WABA — a status event for one WABA
  // must never flip another tenant's identically-named template. Several orgs
  // can share one WABA (numbers hosted under the platform's Business Manager),
  // and a Meta template is one object per WABA, so all of them get the update.
  const accounts = await prisma.whatsappAccount.findMany({
    where: { wabaId },
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
