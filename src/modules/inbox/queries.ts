import { prisma } from "@/lib/db";
import { allowedNumberIds, numberAccessClause } from "@/modules/inbox/access";
import {
  buildConversationWhere,
  type InboxFilter,
} from "@/modules/inbox/filters";

/**
 * Server-side inbox reads, shared by the pages and the poll endpoints so the
 * initial render and every poll tick return the exact same shapes
 * (dates serialized to ISO strings).
 */

export interface ConversationSummary {
  id: string;
  /** "whatsapp" | "voice" */
  channel: string;
  status: string;
  unreadCount: number;
  assignedToUserId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastInboundAt: string | null;
  contact: { id: string; name: string; phoneE164: string };
}

export interface ThreadMessage {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
  metaMessageId: string | null;
}

export interface ThreadSnapshot {
  status: string;
  lastInboundAt: string | null;
  messages: ThreadMessage[];
}

const LIST_LIMIT = 100;
const THREAD_LIMIT = 200;

export async function listConversationSummaries(
  orgId: string,
  filter: InboxFilter,
  q: string,
  userId: string
): Promise<ConversationSummary[]> {
  // E4b: restricted members only see their numbers' conversations.
  const allowed = await allowedNumberIds(orgId, userId);
  const rows = await prisma.conversation.findMany({
    where: {
      AND: [buildConversationWhere(orgId, filter, q, userId), numberAccessClause(allowed)],
    },
    include: { contact: { select: { id: true, name: true, phoneE164: true } } },
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: LIST_LIMIT,
  });

  return rows.map((c) => ({
    id: c.id,
    channel: c.channel,
    status: c.status,
    unreadCount: c.unreadCount,
    assignedToUserId: c.assignedToUserId,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: c.lastMessagePreview,
    lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
    contact: c.contact,
  }));
}

/** Messages + the live bits of the conversation the thread pane polls. */
export async function getThreadSnapshot(
  conversationId: string,
  orgId: string,
  /** E4b: pass the caller's userId to enforce per-number access. */
  userId?: string
): Promise<ThreadSnapshot | null> {
  const allowed = userId ? await allowedNumberIds(orgId, userId) : null;
  const conversation = await prisma.conversation.findFirst({
    where: { AND: [{ id: conversationId, orgId }, numberAccessClause(allowed)] },
    select: {
      status: true,
      lastInboundAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: THREAD_LIMIT,
        select: {
          id: true,
          direction: true,
          body: true,
          createdAt: true,
          metaMessageId: true,
        },
      },
    },
  });
  if (!conversation) return null;

  return {
    status: conversation.status,
    lastInboundAt: conversation.lastInboundAt?.toISOString() ?? null,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      metaMessageId: m.metaMessageId,
    })),
  };
}
