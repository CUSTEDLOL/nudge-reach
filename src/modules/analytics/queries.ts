import type { LeadStage, MessageStatus, OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  average,
  fillDailyCounts,
  firstResponseGaps,
  ratio,
  windowFor,
  type DayPoint,
  type RangeDays,
} from "@/modules/analytics/compute";

/**
 * Server-only analytics queries. Every function is org-scoped and
 * parameterized by range (7 | 30 | 90 days). All numbers come from real rows —
 * zeros are returned honestly, never fabricated.
 *
 * Methodology (surfaced in the UI):
 * - "sent" counts campaign messages that reached at least SENT (statuses are
 *   progressive: SENT ⊇ DELIVERED ⊇ READ ⊇ CLICKED). QUEUED/FAILED excluded.
 * - "replied" counts unique campaign recipients whose conversation has an
 *   inbound message AFTER their campaign send — a proxy, not tracked intent.
 * - First response time = gap from a customer message to the next team reply
 *   in that conversation, capped at 24h so outliers don't dominate averages.
 */

const SENT_STATUSES: MessageStatus[] = ["SENT", "DELIVERED", "READ", "CLICKED"];
const DELIVERED_STATUSES: MessageStatus[] = ["DELIVERED", "READ", "CLICKED"];
const READ_STATUSES: MessageStatus[] = ["READ", "CLICKED"];

/** Window filter on campaign messages: sentAt when set, else createdAt. */
function sendWindow(start: Date, end: Date) {
  return {
    OR: [
      { sentAt: { gte: start, lt: end } },
      { sentAt: null, createdAt: { gte: start, lt: end } },
    ],
  };
}

/** True when the org has any message activity at all (else show empty state). */
export async function hasAnyMessages(orgId: string): Promise<boolean> {
  const [conv, camp] = await Promise.all([
    prisma.conversationMessage.findFirst({
      where: { conversation: { orgId } },
      select: { id: true },
    }),
    prisma.message.findFirst({
      where: { campaign: { orgId } },
      select: { id: true },
    }),
  ]);
  return Boolean(conv || camp);
}

/**
 * Daily in/out volume: inbound + outbound conversation messages plus campaign
 * sends (counted as outbound). Gaps are zero-filled across the whole range.
 */
export async function messageVolumeByDay(
  orgId: string,
  days: RangeDays
): Promise<DayPoint[]> {
  const { start, end } = windowFor(days);
  const [convMessages, campaignSends] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { conversation: { orgId }, createdAt: { gte: start } },
      select: { direction: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: {
        campaign: { orgId },
        status: { in: SENT_STATUSES },
        ...sendWindow(start, end),
      },
      select: { sentAt: true, createdAt: true },
    }),
  ]);
  const entries = [
    ...convMessages.map((m) => ({
      at: m.createdAt,
      direction: (m.direction === "inbound" ? "inbound" : "outbound") as
        | "inbound"
        | "outbound",
    })),
    ...campaignSends.map((m) => ({
      at: m.sentAt ?? m.createdAt,
      direction: "outbound" as const,
    })),
  ];
  return fillDailyCounts(days, end, entries);
}

export interface PeriodTotals {
  /** Campaign messages that reached at least SENT. */
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  /** Distinct contacts who received a campaign message in the period. */
  recipients: number;
  /** Recipients with an inbound conversation message after their send. */
  replied: number;
  /** Inbound conversation messages in the period. */
  inbound: number;
  /** Outbound conversation messages (non-campaign) in the period. */
  outboundConversation: number;
  costMinorUnits: number;
}

export interface RateStats {
  totals: PeriodTotals;
  /** delivered ÷ sent, or null when nothing was sent. */
  deliveredRate: number | null;
  /** read ÷ delivered, or null when nothing was delivered. */
  readRate: number | null;
  /** replied ÷ recipients, or null when there were no recipients. */
  replyRate: number | null;
}

export interface RatesResult {
  current: RateStats;
  previous: RateStats;
}

/** Delivery/read/reply rates for the period and the one before it. */
export async function rates(orgId: string, days: RangeDays): Promise<RatesResult> {
  const { start, end, prevStart } = windowFor(days);
  const [current, previous] = await Promise.all([
    periodStats(orgId, start, end),
    periodStats(orgId, prevStart, start),
  ]);
  return { current, previous };
}

async function periodStats(
  orgId: string,
  start: Date,
  end: Date
): Promise<RateStats> {
  const [statusGroups, sends, inbound, outboundConversation] = await Promise.all([
    prisma.message.groupBy({
      by: ["status"],
      where: { campaign: { orgId }, ...sendWindow(start, end) },
      _count: { _all: true },
      _sum: { costMinorUnits: true },
    }),
    prisma.message.findMany({
      where: {
        campaign: { orgId },
        status: { in: SENT_STATUSES },
        ...sendWindow(start, end),
      },
      select: { contactId: true, sentAt: true, createdAt: true },
    }),
    prisma.conversationMessage.count({
      where: {
        conversation: { orgId },
        direction: "inbound",
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.conversationMessage.count({
      where: {
        conversation: { orgId },
        direction: "outbound",
        createdAt: { gte: start, lt: end },
      },
    }),
  ]);

  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  let costMinorUnits = 0;
  for (const g of statusGroups) {
    const n = g._count._all;
    costMinorUnits += g._sum.costMinorUnits ?? 0;
    if (g.status === "FAILED") failed += n;
    if (SENT_STATUSES.includes(g.status)) sent += n;
    if (DELIVERED_STATUSES.includes(g.status)) delivered += n;
    if (READ_STATUSES.includes(g.status)) read += n;
  }

  // Reply attribution: earliest campaign send per contact in the period, then
  // count contacts with any inbound message after that instant (replies may
  // land after the period ends — that is stated in the UI methodology note).
  const earliestSendByContact = new Map<string, number>();
  for (const s of sends) {
    const at = (s.sentAt ?? s.createdAt).getTime();
    const prev = earliestSendByContact.get(s.contactId);
    if (prev === undefined || at < prev) earliestSendByContact.set(s.contactId, at);
  }
  const recipients = earliestSendByContact.size;
  let replied = 0;
  if (recipients > 0) {
    const inboundAfter = await prisma.conversationMessage.findMany({
      where: {
        direction: "inbound",
        createdAt: { gte: start },
        conversation: {
          orgId,
          contactId: { in: [...earliestSendByContact.keys()] },
        },
      },
      select: { createdAt: true, conversation: { select: { contactId: true } } },
    });
    const repliedContacts = new Set<string>();
    for (const m of inboundAfter) {
      const sendAt = earliestSendByContact.get(m.conversation.contactId);
      if (sendAt !== undefined && m.createdAt.getTime() > sendAt) {
        repliedContacts.add(m.conversation.contactId);
      }
    }
    replied = repliedContacts.size;
  }

  return {
    totals: {
      sent,
      delivered,
      read,
      failed,
      recipients,
      replied,
      inbound,
      outboundConversation,
      costMinorUnits,
    },
    deliveredRate: ratio(delivered, sent),
    readRate: ratio(read, delivered),
    replyRate: ratio(replied, recipients),
  };
}

export interface CampaignPerfRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  costMinorUnits: number;
}

/** Per-campaign send stats for the period, sorted by sent desc. */
export async function campaignPerformance(
  orgId: string,
  days: RangeDays
): Promise<CampaignPerfRow[]> {
  const { start, end } = windowFor(days);
  const groups = await prisma.message.groupBy({
    by: ["campaignId", "status"],
    where: { campaign: { orgId }, ...sendWindow(start, end) },
    _count: { _all: true },
    _sum: { costMinorUnits: true },
  });
  if (groups.length === 0) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: [...new Set(groups.map((g) => g.campaignId))] }, orgId },
    select: { id: true, name: true, status: true },
  });
  const rows = new Map<string, CampaignPerfRow>(
    campaigns.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        status: c.status,
        sent: 0,
        delivered: 0,
        read: 0,
        clicked: 0,
        failed: 0,
        costMinorUnits: 0,
      },
    ])
  );
  for (const g of groups) {
    const row = rows.get(g.campaignId);
    if (!row) continue; // org-scope: campaign lookup already filtered by orgId
    const n = g._count._all;
    row.costMinorUnits += g._sum.costMinorUnits ?? 0;
    if (g.status === "FAILED") row.failed += n;
    if (SENT_STATUSES.includes(g.status)) row.sent += n;
    if (DELIVERED_STATUSES.includes(g.status)) row.delivered += n;
    if (READ_STATUSES.includes(g.status)) row.read += n;
    if (g.status === "CLICKED") row.clicked += n;
  }
  return [...rows.values()].sort((a, b) => b.sent - a.sent);
}

export interface AgentPerfRow {
  userId: string;
  name: string;
  role: OrgRole;
  /** Conversations assigned to this member with activity in the period. */
  assigned: number;
  /** Of those, how many are currently resolved. */
  resolved: number;
  /** Avg minutes from a customer message to the next team reply (capped 24h). */
  avgFirstResponseMinutes: number | null;
}

/** Per-membership workload + responsiveness, sorted by assigned desc. */
export async function agentPerformance(
  orgId: string,
  days: RangeDays
): Promise<AgentPerfRow[]> {
  const { start } = windowFor(days);
  const [members, conversations] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, email: true, displayName: true, role: true },
    }),
    prisma.conversation.findMany({
      where: {
        orgId,
        assignedToUserId: { not: null },
        OR: [{ lastMessageAt: { gte: start } }, { createdAt: { gte: start } }],
      },
      select: { id: true, assignedToUserId: true, status: true },
    }),
  ]);

  const messages =
    conversations.length > 0
      ? await prisma.conversationMessage.findMany({
          where: {
            conversationId: { in: conversations.map((c) => c.id) },
            createdAt: { gte: start },
          },
          orderBy: { createdAt: "asc" },
          select: { conversationId: true, direction: true, createdAt: true },
        })
      : [];
  const byConversation = new Map<
    string,
    Array<{ direction: string; createdAt: Date }>
  >();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId);
    if (list) list.push(m);
    else byConversation.set(m.conversationId, [m]);
  }

  const rows = members.map((member) => {
    const assigned = conversations.filter(
      (c) => c.assignedToUserId === member.userId
    );
    const gaps = assigned.flatMap((c) =>
      firstResponseGaps(byConversation.get(c.id) ?? [])
    );
    return {
      userId: member.userId,
      name: member.displayName || member.email,
      role: member.role,
      assigned: assigned.length,
      // Legacy "closed" rows count as resolved (spec §3.2).
      resolved: assigned.filter(
        (c) => c.status === "resolved" || c.status === "closed"
      ).length,
      avgFirstResponseMinutes: average(gaps),
    };
  });
  return rows.sort((a, b) => b.assigned - a.assigned);
}

export interface FunnelStage {
  stage: LeadStage;
  label: string;
  count: number;
}

const STAGE_ORDER: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  WON: "Won",
  LOST: "Lost",
};

/** Contacts per pipeline stage — a current snapshot, not range-filtered. */
export async function leadFunnel(orgId: string): Promise<FunnelStage[]> {
  const groups = await prisma.contact.groupBy({
    by: ["leadStage"],
    where: { orgId },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((g) => [g.leadStage, g._count._all]));
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    count: counts.get(stage) ?? 0,
  }));
}

export interface TopTag {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** Most-used contact tags (current snapshot), highest count first. */
export async function topTags(orgId: string, limit = 8): Promise<TopTag[]> {
  const tags = await prisma.tag.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { contacts: true } },
    },
  });
  return tags
    .map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.contacts }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
