import type { Prisma } from "@prisma/client";

/**
 * Inbox list filters (spec §M2), pure and unit-tested. Semantics:
 * - open       → status open OR handoff (handoff shows a "Needs human" badge)
 * - mine       → assigned to the caller, not yet resolved
 * - unassigned → no assignee, not yet resolved
 * - resolved   → resolved (legacy "closed" rows count as resolved)
 * - unread     → unreadCount > 0
 * - all        → everything
 */

export const INBOX_FILTERS = [
  "all",
  "open",
  "mine",
  "unassigned",
  "resolved",
  "unread",
] as const;

export type InboxFilter = (typeof INBOX_FILTERS)[number];

export const INBOX_FILTER_LABELS: Record<InboxFilter, string> = {
  all: "All",
  open: "Open",
  mine: "Mine",
  unassigned: "Unassigned",
  resolved: "Resolved",
  unread: "Unread",
};

/** Legacy "closed" rows are treated as resolved (spec §3.2). */
const RESOLVED_STATUSES = ["resolved", "closed"];

export function parseInboxFilter(value: string | undefined): InboxFilter {
  return (INBOX_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as InboxFilter)
    : "open";
}

/** Org-scoped Prisma where clause for the conversation list. */
export function buildConversationWhere(
  orgId: string,
  filter: InboxFilter,
  q: string,
  userId: string
): Prisma.ConversationWhereInput {
  const where: Prisma.ConversationWhereInput = { orgId };

  switch (filter) {
    case "open":
      where.status = { in: ["open", "handoff"] };
      break;
    case "mine":
      where.assignedToUserId = userId;
      where.status = { notIn: RESOLVED_STATUSES };
      break;
    case "unassigned":
      where.assignedToUserId = null;
      where.status = { notIn: RESOLVED_STATUSES };
      break;
    case "resolved":
      where.status = { in: RESOLVED_STATUSES };
      break;
    case "unread":
      where.unreadCount = { gt: 0 };
      break;
    case "all":
      break;
  }

  const query = q.trim();
  if (query) {
    where.OR = [
      { contact: { name: { contains: query, mode: "insensitive" } } },
      { contact: { phoneE164: { contains: query } } },
      { lastMessagePreview: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}
