import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { isStopMessage } from "@/lib/webhook/verify";
import { sendMessage } from "@/lib/messaging";
import { buildHistory, generateAgentReply } from "@/lib/agent/reply";
import { runInboundAutomations } from "@/lib/automation/engine";
import { toPreview } from "@/lib/inbox/format";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";

export interface InboundResult {
  optedOut?: boolean;
  reply?: string;
  handoff?: boolean;
  conversationId?: string;
  skipped?: "no_profile" | "disabled";
  /** Set when an automation (not the AI agent) produced the reply. */
  automated?: true;
}

const HISTORY_LIMIT = 12;

/**
 * The single entry point for an inbound customer message — called by both the
 * live Cloud API webhook and the simulation tester. Honors STOP, threads the
 * conversation, and (if the agent is enabled) generates + sends a scoped reply.
 */
export async function handleInboundMessage(
  orgId: string,
  fromPhone: string,
  text: string
): Promise<InboundResult> {
  // Meta's webhook always sends `from` with the country code but no "+"
  // (e.g. "919876543210", "971501234567") — so a bare digit string is an
  // international number as-is, never a local number to prefix.
  const digits = fromPhone.replace(/[\s\-().]/g, "");
  const phoneE164 = /^\d{8,15}$/.test(digits)
    ? `+${digits}`
    : (normalizePhoneE164(fromPhone) ?? fromPhone);

  // Find or create the contact (an inbound message is not marketing opt-in,
  // but it does open a service conversation).
  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId, phoneE164 } },
    create: {
      orgId,
      phoneE164,
      name: phoneE164,
      optInSource: "inbound",
    },
    update: {},
  });

  // Opt-out always wins, and we never auto-reply to it.
  if (isStopMessage(text)) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { optedIn: false, optedOutAt: new Date() },
    });
    return { optedOut: true };
  }

  // Denormalized inbox-list fields (lastMessageAt/preview/unread) are kept
  // here so live webhook inbounds surface in the inbox without extra queries.
  const now = new Date();
  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: {
      orgId,
      contactId: contact.id,
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: toPreview(text),
      unreadCount: 1,
    },
    update: {
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: toPreview(text),
      unreadCount: { increment: 1 },
    },
  });

  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, direction: "inbound", body: text },
  });

  // Notify any integrations subscribed to inbound messages (fire-and-forget).
  void dispatchWebhook(orgId, "message.received", {
    conversationId: conversation.id,
    contactId: contact.id,
    from: phoneE164,
    text,
  });

  // Automations run BEFORE the AI agent (spec §M6). Loop-safe: automation
  // sends go OUT through sendMessage and never re-enter this function — only
  // genuine inbound webhooks / the simulation tester reach here.
  const automations = await runInboundAutomations(orgId, {
    contactId: contact.id,
    conversationId: conversation.id,
    messageText: text,
  });
  if (automations.replied) {
    // An automation already answered this message — skip the AI auto-reply so
    // the customer never gets two responses to one message.
    return {
      conversationId: conversation.id,
      reply: automations.replyText,
      automated: true,
    };
  }

  const profile = await prisma.agentProfile.findUnique({ where: { orgId } });
  if (!profile) return { conversationId: conversation.id, skipped: "no_profile" };
  if (!profile.enabled)
    return { conversationId: conversation.id, skipped: "disabled" };

  const recent = await prisma.conversationMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  const { text: replyText, handoff } = await generateAgentReply(
    {
      vertical: profile.vertical,
      businessName: profile.businessName,
      businessInfo: profile.businessInfo,
      tone: profile.tone,
      doNots: profile.doNots,
    },
    buildHistory(recent)
  );

  const sent = await sendMessage(
    "whatsapp",
    {
      address: phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    { kind: "text", text: replyText },
    { orgId }
  );

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: replyText,
      metaMessageId: sent.providerMessageId,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: toPreview(replyText),
    },
  });

  if (handoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "handoff" },
    });
  }

  return { conversationId: conversation.id, reply: replyText, handoff };
}
