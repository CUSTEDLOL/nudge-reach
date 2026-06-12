import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { isStopMessage, verifyWebhookSignature } from "@/lib/webhook/verify";
import { isForwardTransition } from "@/lib/send/sim-progress";
import type { MessageStatus } from "@prisma/client";

/**
 * WhatsApp Cloud API webhook: signature-verified, idempotent.
 * - message status updates (sent/delivered/read/failed + pricing)
 * - template status updates (approve/reject)
 * - inbound messages: STOP → permanent opt-out (rule 2)
 */

// Subscription verification handshake
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
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
        await processTemplateUpdate(change.value);
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
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ code?: number | string }>;
          pricing?: { amount_1000?: number };
        }>;
        messages?: Array<{ from?: string; text?: { body?: string } }>;
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
  messages: Array<{ from?: string; text?: { body?: string } }>,
  phoneNumberId?: string
) {
  for (const inbound of messages ?? []) {
    const text = inbound.text?.body ?? "";
    if (!inbound.from || !isStopMessage(text)) continue;

    // Scope the opt-out to the org owning this phone number when known.
    const account = phoneNumberId
      ? await prisma.whatsappAccount.findFirst({ where: { phoneNumberId } })
      : null;

    await prisma.contact.updateMany({
      where: {
        phoneE164: { endsWith: inbound.from.replace(/^\+?/, "") },
        ...(account ? { orgId: account.orgId } : {}),
      },
      data: { optedIn: false, optedOutAt: new Date() },
    });
  }
}

async function processTemplateUpdate(
  value?: {
    event?: string;
    message_template_name?: string;
    reason?: string;
  }
) {
  if (!value?.message_template_name || !value.event) return;
  const template = await prisma.template.findFirst({
    where: { name: value.message_template_name },
    orderBy: { submittedAt: "desc" },
  });
  if (!template) return;

  if (value.event === "APPROVED") {
    await prisma.$transaction([
      prisma.template.update({
        where: { id: template.id },
        data: { metaStatus: "APPROVED", rejectionReason: null },
      }),
      prisma.campaign.update({
        where: { id: template.campaignId },
        data: { status: "TEMPLATE_APPROVED" },
      }),
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
      prisma.campaign.update({
        where: { id: template.campaignId },
        data: { status: "DRAFT" },
      }),
    ]);
  }
}
