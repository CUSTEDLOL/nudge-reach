import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Cross-org platform aggregates for the founder panel. This module (and its
 * siblings under modules/admin) is the ONLY place in the repo allowed to
 * query without an orgId scope — everything else is tenant-scoped
 * (invariant 5). Reads only; no customer message bodies, ever.
 */

export interface OverviewStats {
  orgsTotal: number;
  orgsByPlan: { plan: string; count: number }[];
  liveOrgs: number;
  testOrgs: number;
  signupsInRange: number;
  /** Daily counts for the range, oldest first. */
  signupsByDay: { label: string; count: number }[];
  activeOrgs: number; // distinct orgs with an inbound message in range
  messagesInbound: number;
  messagesOutbound: number;
  aiCostMicroUsd: number;
  aiCostByokMicroUsd: number;
  bookings: number;
  paymentsPaid: number;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export async function overviewStats(days: number): Promise<OverviewStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    orgsTotal,
    planGroups,
    simGroups,
    signups,
    inboundOrgs,
    msgGroups,
    aiGroups,
    bookings,
    paymentsPaid,
  ] = await Promise.all([
    prisma.org.count(),
    prisma.org.groupBy({ by: ["plan"], _count: true }),
    prisma.org.groupBy({ by: ["simulated"], _count: true }),
    prisma.org.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.conversationMessage.findMany({
      where: { direction: "inbound", createdAt: { gte: since } },
      select: { conversation: { select: { orgId: true } } },
      distinct: ["conversationId"],
    }),
    prisma.conversationMessage.groupBy({
      by: ["direction"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.aiUsage.groupBy({
      by: ["byok"],
      where: { createdAt: { gte: since } },
      _sum: { costMicroUsd: true },
    }),
    prisma.bookingRequest.count({ where: { createdAt: { gte: since } } }),
    prisma.paymentRequest.count({
      where: { status: "paid", paidAt: { gte: since } },
    }),
  ]);

  // Fill every day in range so the chart has no gaps.
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(dayLabel(new Date(Date.now() - i * 24 * 60 * 60 * 1000)), 0);
  }
  for (const s of signups) {
    const label = dayLabel(s.createdAt);
    if (byDay.has(label)) byDay.set(label, (byDay.get(label) ?? 0) + 1);
  }

  const count = (g: { _count: number | { _all?: number } }): number =>
    typeof g._count === "number" ? g._count : (g._count._all ?? 0);

  return {
    orgsTotal,
    orgsByPlan: planGroups
      .map((g) => ({ plan: g.plan, count: count(g) }))
      .sort((a, b) => b.count - a.count),
    liveOrgs: simGroups.filter((g) => !g.simulated).reduce((s, g) => s + count(g), 0),
    testOrgs: simGroups.filter((g) => g.simulated).reduce((s, g) => s + count(g), 0),
    signupsInRange: signups.length,
    signupsByDay: [...byDay].map(([label, c]) => ({ label, count: c })),
    activeOrgs: new Set(inboundOrgs.map((r) => r.conversation.orgId)).size,
    messagesInbound: msgGroups
      .filter((g) => g.direction === "inbound")
      .reduce((s, g) => s + count(g), 0),
    messagesOutbound: msgGroups
      .filter((g) => g.direction === "outbound")
      .reduce((s, g) => s + count(g), 0),
    aiCostMicroUsd: aiGroups.reduce((s, g) => s + (g._sum.costMicroUsd ?? 0), 0),
    aiCostByokMicroUsd: aiGroups
      .filter((g) => g.byok)
      .reduce((s, g) => s + (g._sum.costMicroUsd ?? 0), 0),
    bookings,
    paymentsPaid: paymentsPaid,
  };
}

/* ------------------------------------------------------------------ */
/* Orgs table                                                          */
/* ------------------------------------------------------------------ */

export interface OrgRow {
  id: string;
  name: string;
  plan: string;
  simulated: boolean;
  suspended: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string;
  vertical: string | null;
  ownerEmail: string | null;
  numbers: number;
  contacts: number;
  members: number;
  aiCostMicroUsd30d: number;
  lastInboundAt: Date | null;
  readiness: OrgReadinessStatus;
  readinessIssues: string[];
  createdAt: Date;
}

export interface OrgsPage {
  rows: OrgRow[];
  page: number;
  pageCount: number;
  total: number;
}

const ORGS_PAGE_SIZE = 50;
const ORGS_QUERY_LIMIT = 500;

export const ORG_STATES = ["all", "trial", "paying", "past_due", "cancelled", "suspended", "ended_trial"] as const;
export type OrgState = (typeof ORG_STATES)[number];
export const ORG_MODES = ["all", "live", "test"] as const;
export type OrgMode = (typeof ORG_MODES)[number];
export const ORG_READINESS = ["all", "ready", "blocked", "degraded"] as const;
export type OrgReadiness = (typeof ORG_READINESS)[number];
export type OrgReadinessStatus = Exclude<OrgReadiness, "all">;
export const ORG_SORTS = ["newest", "name", "last_activity", "trial_end", "cost"] as const;
export type OrgSort = (typeof ORG_SORTS)[number];

export interface OrgsFilter {
  search?: string;
  plan?: string;
  mode?: OrgMode;
  state?: OrgState;
  readiness?: OrgReadiness;
  sort?: OrgSort;
  page?: number;
}

/** Pure: the Prisma where-clause for the org list filters. Exported for tests. */
export function orgsWhere(f: OrgsFilter, now = new Date()): Prisma.OrgWhereInput {
  const and: Prisma.OrgWhereInput[] = [];
  const search = f.search?.trim();
  if (search) {
    and.push({
      OR: [
        { id: search },
        { name: { contains: search, mode: "insensitive" } },
        { memberships: { some: { email: { contains: search, mode: "insensitive" } } } },
        { whatsappAccounts: { some: { phoneNumberId: search } } },
      ],
    });
  }
  if (f.plan && f.plan !== "all") and.push({ plan: f.plan });
  if (f.mode === "live") and.push({ simulated: false });
  if (f.mode === "test") and.push({ simulated: true });
  switch (f.state) {
    case "trial":
      and.push({ trialEndsAt: { gte: now }, subscriptionStatus: { not: "active" } });
      break;
    case "ended_trial":
      and.push({ trialEndsAt: { lt: now }, subscriptionStatus: { not: "active" } });
      break;
    case "paying":
      and.push({ subscriptionStatus: "active" });
      break;
    case "past_due":
      and.push({ subscriptionStatus: "past_due" });
      break;
    case "cancelled":
      and.push({ subscriptionStatus: "cancelled" });
      break;
    case "suspended":
      and.push({ suspendedAt: { not: null } });
      break;
  }
  return and.length === 0 ? {} : and.length === 1 ? and[0] : { AND: and };
}

function validOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function dateValue(value: Date | null): number | null {
  return value ? value.getTime() : null;
}

/** Pure, deterministic ordering for derived fields that Prisma cannot sort. */
export function sortOrgRows(rows: OrgRow[], sort: OrgSort): OrgRow[] {
  return [...rows].sort((a, b) => {
    let result = 0;
    if (sort === "name") result = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (sort === "cost") result = b.aiCostMicroUsd30d - a.aiCostMicroUsd30d;
    if (sort === "newest") result = b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "last_activity") {
      const aTime = dateValue(a.lastInboundAt);
      const bTime = dateValue(b.lastInboundAt);
      if (aTime === null && bTime !== null) result = 1;
      else if (aTime !== null && bTime === null) result = -1;
      else result = (bTime ?? 0) - (aTime ?? 0);
    }
    if (sort === "trial_end") {
      const aTime = dateValue(a.trialEndsAt);
      const bTime = dateValue(b.trialEndsAt);
      if (aTime === null && bTime !== null) result = 1;
      else if (aTime !== null && bTime === null) result = -1;
      else result = (aTime ?? 0) - (bTime ?? 0);
    }
    return result || a.id.localeCompare(b.id);
  });
}

/** Pure numeric pagination with safe clamping for manually edited query strings. */
export function paginate<T>(rows: T[], requestedPage: number, pageSize: number) {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const requested = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(pageCount, Math.max(1, requested));
  const start = (page - 1) * safePageSize;
  return { rows: rows.slice(start, start + safePageSize), page, pageCount, total };
}

export async function orgsList(opts: OrgsFilter): Promise<OrgsPage> {
  const readiness = validOption(opts.readiness, ORG_READINESS, "all");
  const sort = validOption(opts.sort, ORG_SORTS, "newest");
  const orgs = await prisma.org.findMany({
    where: orgsWhere(opts),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: ORGS_QUERY_LIMIT,
    select: {
      id: true,
      name: true,
      plan: true,
      simulated: true,
      suspendedAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      vertical: true,
      createdAt: true,
      memberships: {
        where: { role: "OWNER" },
        select: { email: true },
        take: 1,
      },
      whatsappAccounts: {
        where: { status: "connected" },
        select: { id: true },
        take: 1,
      },
      agentProfile: { select: { enabled: true, businessInfo: true } },
      calendarAccount: { select: { status: true } },
      knowledgeEntries: {
        where: { status: "active" },
        select: { id: true },
        take: 1,
      },
      templates: {
        where: { campaignId: null, metaStatus: "APPROVED" },
        select: { id: true },
        take: 1,
      },
      followUpConfig: { select: { enabled: true } },
      _count: {
        select: { contacts: true, whatsappAccounts: true, memberships: true },
      },
    },
  });

  const ids = orgs.map((o) => o.id);

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [costGroups, inboundGroups] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["orgId"],
      where: { orgId: { in: ids }, createdAt: { gte: since30 } },
      _sum: { costMicroUsd: true },
    }),
    prisma.conversation.groupBy({
      by: ["orgId"],
      where: { orgId: { in: ids } },
      _max: { lastInboundAt: true },
    }),
  ]);
  const costBy = new Map(costGroups.map((g) => [g.orgId, g._sum.costMicroUsd ?? 0]));
  const inboundBy = new Map(
    inboundGroups.map((g) => [g.orgId, g._max.lastInboundAt ?? null])
  );

  const rows: OrgRow[] = orgs.map((o) => {
    const readinessIssues = [
      o.whatsappAccounts.length === 0 ? "WhatsApp not connected" : null,
      !o.agentProfile?.businessInfo.trim() && o.knowledgeEntries.length === 0
        ? "Knowledge not configured"
        : null,
      !o.agentProfile?.enabled ? "AI Front Desk disabled" : null,
      o.calendarAccount?.status !== "connected" ? "Calendar not connected" : null,
      o.templates.length === 0 ? "No approved follow-up template" : null,
      !o.followUpConfig?.enabled ? "Follow-ups disabled" : null,
    ].filter((issue): issue is string => issue !== null);
    const readinessStatus: OrgReadinessStatus =
      readinessIssues.length === 0 ? "ready" : o.simulated ? "blocked" : "degraded";

    return {
      id: o.id,
      name: o.name,
      plan: o.plan,
      simulated: o.simulated,
      suspended: Boolean(o.suspendedAt),
      trialEndsAt: o.trialEndsAt,
      subscriptionStatus: o.subscriptionStatus,
      vertical: o.vertical,
      ownerEmail: o.memberships[0]?.email || null,
      numbers: o._count.whatsappAccounts,
      contacts: o._count.contacts,
      members: o._count.memberships,
      aiCostMicroUsd30d: costBy.get(o.id) ?? 0,
      lastInboundAt: inboundBy.get(o.id) ?? null,
      readiness: readinessStatus,
      readinessIssues,
      createdAt: o.createdAt,
    };
  });

  const visibleRows = readiness === "all" ? rows : rows.filter((o) => o.readiness === readiness);
  return paginate(sortOrgRows(visibleRows, sort), opts.page ?? 1, ORGS_PAGE_SIZE);
}
