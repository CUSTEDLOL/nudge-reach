import { ensureAgentProfile } from "@/modules/agent/profile";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { isStopMessage } from "@/modules/whatsapp/webhook-verify";
import { sendMessage } from "@/modules/messaging";
import { crmContactCreated } from "@/modules/crm/events";
import { recordContactEvent } from "@/modules/contacts/events";
import { scoreContactSoon } from "@/modules/scoring/compute";
import {
  buildHistory,
  generateAgentActionReply,
  generateAgentReply,
} from "@/modules/agent/reply";
import { MAX_ACTIVE_RULES } from "@/modules/agent/rules";
import { activeRules } from "@/modules/agent/rules-store";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { cancelWaitingRuns, runInboundAutomations } from "@/modules/automation/engine";
import { toPreview } from "@/modules/inbox/format";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";

export interface InboundResult {
  optedOut?: boolean;
  reply?: string;
  handoff?: boolean;
  conversationId?: string;
  skipped?: "no_profile" | "disabled" | "no_knowledge";
  /** Set when an automation (not the AI agent) produced the reply. */
  automated?: true;
  /** Tools the agent invoked this turn (capture_lead, capture_booking_request, …). */
  actions?: string[];
  /** The model call failed; the customer got the hand-off line and the thread needs a person. */
  aiFailed?: true;
  /** A model successfully generated this reply; acquisition trials meter only these. */
  generatedByAi?: true;
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
  const restrictedTrial = await isRestrictedAcquisitionTrial(orgId);
  const stopMessage = isStopMessage(text);
  // A restricted trial must use one authoritative knowledge snapshot for the
  // whole turn. Re-reading after an outer preflight allowed the last active
  // fact to be archived between checks and sent an ungrounded prompt.
  const trialKnowledgeEntries = restrictedTrial && !stopMessage
    ? await prisma.knowledgeEntry.findMany({
        where: { orgId, status: "active" },
        select: { category: true, fact: true, condition: true },
        orderBy: { createdAt: "asc" },
        take: 400,
      })
    : null;
  if (restrictedTrial && !stopMessage && trialKnowledgeEntries?.length === 0) {
    return { skipped: "no_knowledge" };
  }
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
  if (!existingContact && !restrictedTrial) {
    await crmContactCreated(orgId, contact, "WhatsApp (Nudge)");
  }

  // Opt-out always wins, and we never auto-reply to it.
  if (stopMessage) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { optedIn: false, optedOutAt: new Date() },
    });
    recordContactEvent(orgId, "opted_out", {
      contactId: contact.id,
      props: { source: "stop" },
    });
    await cancelWaitingRuns(orgId, contact.id, "opt_out");
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

  // E6: refresh the lead score on activity (fire-and-forget, plan-gated inside).
  if (!restrictedTrial) scoreContactSoon(orgId, contact.id);

  // Notify any integrations subscribed to inbound messages (fire-and-forget).
  if (!restrictedTrial) {
    void dispatchWebhook(orgId, "message.received", {
      conversationId: conversation.id,
      contactId: contact.id,
      from: phoneE164,
      text,
    });
  }

  // The customer is talking to us again — nothing should keep chasing them.
  // Runs before the dispatch so a reply can never cancel the run it starts.
  await cancelWaitingRuns(orgId, contact.id, "reply");

  // Automations run BEFORE the AI agent (spec §M6). Loop-safe: automation
  // sends go OUT through sendMessage and never re-enter this function — only
  // genuine inbound webhooks / the simulation tester reach here.
  if (!restrictedTrial) {
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
  }

  const profile = await ensureAgentProfile(orgId);
  if (!profile) return { conversationId: conversation.id, skipped: "no_profile" };
  if (!profile.enabled)
    return { conversationId: conversation.id, skipped: "disabled" };

  // Structured knowledge + org-local time make the prompt condition-aware
  // ("weekends only" resolves against TODAY). The digest is the source of
  // truth for facts — the legacy businessInfo blob no longer reaches the
  // prompt at all, `migrateProfileToRules` having moved it into these rules
  // and facts. The house rules ride above the digest — how the owner wants
  // the agent to behave.
  const [recent, org, knowledgeEntries, rules] = await Promise.all([
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
    restrictedTrial
      ? Promise.resolve(trialKnowledgeEntries ?? [])
      : prisma.knowledgeEntry.findMany({
          where: { orgId, status: "active" },
          select: { category: true, fact: true, condition: true },
          orderBy: { createdAt: "asc" },
          take: 400,
        }),
    // `restrictedTrial` is the same unconverted-trial test the rest of this
    // function runs on, already resolved — so the trial's smaller cap costs
    // nothing extra here.
    activeRules(
      orgId,
      restrictedTrial ? MAX_ACTIVE_RULES.trial : MAX_ACTIVE_RULES.full
    ),
  ]);

  // buildHistory drops leading assistant turns; whatever happens, the agent
  // must at minimum see the message it is replying to (empty history is an
  // API error).
  const history = buildHistory(recent);
  if (history.length === 0) history.push({ role: "user", text });

  const reply = restrictedTrial
    ? await generateAgentReply(
        {
          vertical: profile.vertical,
          businessName: profile.businessName,
          businessInfo: profile.businessInfo,
          tone: profile.tone,
          doNots: profile.doNots,
        },
        history,
        { orgId, conversationId: conversation.id },
        {
          knowledgeDigest: buildKnowledgeDigest(knowledgeEntries),
          rules,
          now: new Date(),
          timezone: org?.timezone ?? "Asia/Kolkata",
        },
      )
    : await generateAgentActionReply(
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
          rules,
          now: new Date(),
          timezone: org?.timezone ?? "Asia/Kolkata",
        },
      );

  const {
    text: replyText,
    handoff,
    aiFailed,
    generatedByAi,
  } = reply;
  const actions = "actions" in reply && Array.isArray(reply.actions)
    ? reply.actions.filter((action): action is string => typeof action === "string")
    : [];

  const sent = await sendMessage(
    "whatsapp",
    {
      address: phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    { kind: "text", text: replyText },
    {
      orgId,
      whatsappAccountId: conversation.whatsappAccountId,
      suppressWebhook: restrictedTrial,
    }
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

  if (handoff && !restrictedTrial) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "handoff" },
    });
  }

  return {
    conversationId: conversation.id,
    reply: replyText,
    handoff,
    ...(generatedByAi ? { generatedByAi } : {}),
    ...(actions.length ? { actions } : {}),
    ...(aiFailed ? { aiFailed } : {}),
  };
}
