import { ensureAgentProfile } from "@/modules/agent/profile";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { isStopMessage } from "@/modules/whatsapp/webhook-verify";
import { sendMessage } from "@/modules/messaging";
import { crmContactCreated } from "@/modules/crm/events";
import { recordContactEvent } from "@/modules/contacts/events";
import { buildHistory, generateAgentActionReply } from "@/modules/agent/reply";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { runInboundAutomations } from "@/modules/automation/engine";
import { toPreview } from "@/modules/inbox/format";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";

export interface InboundResult {
  optedOut?: boolean;
  reply?: string;
  handoff?: boolean;
  conversationId?: string;
  skipped?: "no_profile" | "disabled";
  /** Set when an automation (not the AI agent) produced the reply. */
  automated?: true;
  /** Tools the agent invoked this turn (capture_lead, capture_booking_request, …). */
  actions?: string[];
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
  text: string,
  opts: { metaMessageId?: string; whatsappAccountId?: string } = {}
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
  const existingContact = await prisma.contact.findUnique({
    where: { orgId_phoneE164: { orgId, phoneE164 } },
    select: { id: true },
  });
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
  if (!existingContact) void crmContactCreated(orgId, contact, "WhatsApp (Nudge)");

  // Opt-out always wins, and we never auto-reply to it.
  if (isStopMessage(text)) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { optedIn: false, optedOutAt: new Date() },
    });
    recordContactEvent(orgId, "opted_out", {
      contactId: contact.id,
      props: { source: "stop" },
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
      // E4 sticky routing: remember which number the customer wrote to.
      ...(opts.whatsappAccountId ? { whatsappAccountId: opts.whatsappAccountId } : {}),
    },
    update: {
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: toPreview(text),
      unreadCount: { increment: 1 },
      ...(opts.whatsappAccountId ? { whatsappAccountId: opts.whatsappAccountId } : {}),
    },
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      body: text,
      metaMessageId: opts.metaMessageId ?? null,
    },
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

  const profile = await ensureAgentProfile(orgId);
  if (!profile) return { conversationId: conversation.id, skipped: "no_profile" };
  if (!profile.enabled)
    return { conversationId: conversation.id, skipped: "disabled" };

  // Structured knowledge + org-local time make the prompt condition-aware
  // ("weekends only" resolves against TODAY). The digest is the primary
  // source of truth; the legacy businessInfo blob rides along until migrated.
  const [recent, org, knowledgeEntries] = await Promise.all([
    // NEWEST messages, then restored to chronological order — a long thread
    // must keep the customer's latest turns, not its opening ones. This also
    // guarantees the just-persisted inbound is always in the window.
    prisma.conversationMessage
      .findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      })
      .then((rows) => rows.reverse()),
    prisma.org.findUnique({ where: { id: orgId }, select: { timezone: true } }),
    prisma.knowledgeEntry.findMany({
      where: { orgId, status: "active" },
      select: { category: true, fact: true, condition: true },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
  ]);

  // buildHistory drops leading assistant turns; whatever happens, the agent
  // must at minimum see the message it is replying to (empty history is an
  // API error).
  const history = buildHistory(recent);
  if (history.length === 0) history.push({ role: "user", text });

  const { text: replyText, handoff, actions } = await generateAgentActionReply(
    {
      vertical: profile.vertical,
      businessName: profile.businessName,
      businessInfo: profile.businessInfo,
      tone: profile.tone,
      doNots: profile.doNots,
    },
    history,
    {
      orgId,
      contactId: contact.id,
      conversationId: conversation.id,
      contactName: contact.name,
      contactPhone: phoneE164,
    },
    {
      knowledgeDigest: buildKnowledgeDigest(knowledgeEntries),
      now: new Date(),
      timezone: org?.timezone ?? "Asia/Kolkata",
    }
  );

  const sent = await sendMessage(
    "whatsapp",
    {
      address: phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    { kind: "text", text: replyText },
    { orgId, whatsappAccountId: conversation.whatsappAccountId }
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

  return {
    conversationId: conversation.id,
    reply: replyText,
    handoff,
    ...(actions.length ? { actions } : {}),
  };
}
