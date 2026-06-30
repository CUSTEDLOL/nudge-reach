import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { isStopMessage } from "@/lib/webhook/verify";
import { sendMessage } from "@/lib/messaging";
import { buildHistory, generateAgentReply } from "@/lib/agent/reply";

export interface InboundResult {
  optedOut?: boolean;
  reply?: string;
  handoff?: boolean;
  conversationId?: string;
  skipped?: "no_profile" | "disabled";
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
  const phoneE164 = normalizePhoneE164(fromPhone) ?? fromPhone;

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

  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: { orgId, contactId: contact.id, lastInboundAt: new Date() },
    update: { lastInboundAt: new Date() },
  });

  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, direction: "inbound", body: text },
  });

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
    { kind: "text", text: replyText }
  );

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: replyText,
      metaMessageId: sent.providerMessageId,
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
