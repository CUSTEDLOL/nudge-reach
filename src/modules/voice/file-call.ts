import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";
import { outcomeOf } from "@/modules/voice/transcript";
import type { PostCall } from "@/modules/voice/types";

const PREVIEW = 80;

/**
 * A finished call becomes a normal inbox thread: the customer's contact, a
 * conversation on the "voice" channel, one message per spoken turn, and a
 * VoiceCall row with duration/summary/outcome. Idempotent on the provider's
 * call id (ElevenLabs retries webhooks).
 */
export async function fileCall(
  orgId: string,
  call: PostCall,
  purpose: "inbound" | "reminder" | "no_show"
): Promise<{ voiceCallId: string; conversationId: string; contactId: string }> {
  const existing = await prisma.voiceCall.findUnique({
    where: { providerCallId: call.providerCallId },
  });
  const customerE164 = call.direction === "inbound" ? call.fromE164 : call.toE164;

  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId, phoneE164: customerE164 } },
    create: { orgId, phoneE164: customerE164, name: customerE164, optInSource: "voice" },
    update: {},
  });
  const now = new Date();
  const summary = call.summary ?? call.transcript.at(-1)?.message ?? "Phone call";
  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: {
      orgId,
      contactId: contact.id,
      channel: "voice",
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: summary.slice(0, PREVIEW),
      unreadCount: 1,
    },
    update: {
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: summary.slice(0, PREVIEW),
      unreadCount: { increment: 1 },
    },
  });
  if (existing) {
    return { voiceCallId: existing.id, conversationId: conversation.id, contactId: contact.id };
  }

  await prisma.conversationMessage.createMany({
    data: call.transcript
      .filter((t) => t.message.trim().length > 0)
      .map((t) => ({
        conversationId: conversation.id,
        direction: t.role === "user" ? "inbound" : "outbound",
        body: t.message,
        metaMessageId: `${call.providerCallId}:${t.t}`,
      })),
  });

  const outcome = outcomeOf(call.transcript);
  const voiceCall = await prisma.voiceCall.create({
    data: {
      orgId,
      contactId: contact.id,
      conversationId: conversation.id,
      direction: call.direction,
      fromE164: call.fromE164,
      toE164: call.toE164,
      providerCallId: call.providerCallId,
      status: "completed",
      durationSecs: call.durationSecs,
      transcript: call.transcript as unknown as Prisma.InputJsonValue,
      summary: call.summary,
      outcome,
      purpose,
      endedAt: now,
    },
  });
  if (outcome === "handoff") {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "handoff" } });
  }
  void dispatchWebhook(orgId, "call.completed", {
    voiceCallId: voiceCall.id,
    conversationId: conversation.id,
    contactId: contact.id,
    direction: call.direction,
    durationSecs: call.durationSecs,
    outcome,
    summary: call.summary,
  });
  return { voiceCallId: voiceCall.id, conversationId: conversation.id, contactId: contact.id };
}
