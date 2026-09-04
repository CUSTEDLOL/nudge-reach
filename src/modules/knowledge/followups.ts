import { prisma } from "@/lib/db";
import { sendMessage } from "@/modules/messaging";
import { isWithinServiceWindow } from "@/modules/agent/window";
import { toPreview } from "@/modules/inbox/format";
import type { DistilledFact } from "./distill";
import type { Waiter } from "./questions";

/**
 * When the owner answers a queued question, get back to every customer who
 * asked — but ONLY inside their 24h service window (free-form replies outside
 * it are forbidden; those customers keep the benefit as stored knowledge for
 * next time). Send failures skip that waiter and never throw: the answer must
 * always land in the knowledge base even if a follow-up can't be delivered.
 */

const MAX_FACTS_IN_REPLY = 3;

/** Pure: the customer-facing follow-up message. */
export function buildFollowUpText(facts: DistilledFact[]): string {
  const sentences = facts.slice(0, MAX_FACTS_IN_REPLY).map((f) => {
    const base = f.fact.replace(/[.\s]+$/, "");
    return f.condition ? `${base} (only: ${f.condition}).` : `${base}.`;
  });
  return `Good news — I checked with the team. ${sentences.join(
    " "
  )} Anything else I can help with?`;
}

/** Pure: waiters not yet followed up whose conversation window is still open. */
export function eligibleWaiters(
  waiting: Waiter[],
  lastInboundByConversation: Map<string, Date | null>,
  now: Date
): Waiter[] {
  return waiting.filter((w) => {
    if (w.followedUpAt) return false;
    const lastInbound = lastInboundByConversation.get(w.conversationId) ?? null;
    return isWithinServiceWindow(lastInbound, now);
  });
}

/**
 * Send the follow-ups and return the stamped waiting list — the CALLER
 * persists it (single update alongside status/answer, no clobbering).
 */
export async function sendKnowledgeFollowUps(
  orgId: string,
  waiting: Waiter[],
  facts: DistilledFact[]
): Promise<{ sent: number; waiting: Waiter[] }> {
  if (!waiting.length || !facts.length) return { sent: 0, waiting };

  const conversations = await prisma.conversation.findMany({
    where: { orgId, id: { in: waiting.map((w) => w.conversationId) } },
    select: {
      id: true,
      whatsappAccountId: true,
      lastInboundAt: true,
      contact: {
        select: { phoneE164: true, optedIn: true, optedOutAt: true },
      },
    },
  });
  const byId = new Map(conversations.map((c) => [c.id, c]));
  const now = new Date();
  const eligible = eligibleWaiters(
    waiting,
    new Map(conversations.map((c) => [c.id, c.lastInboundAt])),
    now
  );

  const text = buildFollowUpText(facts);
  const stamped = [...waiting];
  let sent = 0;

  for (const waiter of eligible) {
    const convo = byId.get(waiter.conversationId);
    if (!convo) continue;
    try {
      const result = await sendMessage(
        "whatsapp",
        {
          address: convo.contact.phoneE164,
          optedIn: convo.contact.optedIn,
          optedOutAt: convo.contact.optedOutAt,
        },
        { kind: "text", text },
        { orgId, whatsappAccountId: convo.whatsappAccountId }
      );
      await prisma.conversationMessage.create({
        data: {
          conversationId: convo.id,
          direction: "outbound",
          body: text,
          metaMessageId: result.providerMessageId,
        },
      });
      await prisma.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: toPreview(text),
        },
      });
      const i = stamped.findIndex(
        (w) => w.conversationId === waiter.conversationId
      );
      if (i >= 0)
        stamped[i] = { ...stamped[i], followedUpAt: now.toISOString() };
      sent++;
    } catch {
      // Skip this waiter; the knowledge is saved regardless.
    }
  }

  return { sent, waiting: stamped };
}
