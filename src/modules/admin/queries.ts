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
  vertical: string | null;
  ownerEmail: string | null;
  numbers: number;
  contacts: number;
  members: number;
  aiCostMicroUsd30d: number;
  lastInboundAt: Date | null;
  createdAt: Date;
}

export interface OrgsPage {
  rows: OrgRow[];
  /** Pass back as ?cursor= to fetch the next page; null = no more. */
  nextCursor: string | null;
}

const ORGS_PAGE_SIZE = 50;

export async function orgsList(opts: {
  search?: string;
  cursor?: string;
}): Promise<OrgsPage> {
  const search = opts.search?.trim();
  const orgs = await prisma.org.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              memberships: {
                some: { email: { contains: search, mode: "insensitive" } },
              },
            },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: ORGS_PAGE_SIZE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      plan: true,
      simulated: true,
      vertical: true,
      createdAt: true,
      memberships: {
        where: { role: "OWNER" },
        select: { email: true },
        take: 1,
      },
      _count: {
        select: { contacts: true, whatsappAccounts: true, memberships: true },
      },
    },
  });

  const hasMore = orgs.length > ORGS_PAGE_SIZE;
  const page = hasMore ? orgs.slice(0, ORGS_PAGE_SIZE) : orgs;
  const ids = page.map((o) => o.id);

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

  return {
    rows: page.map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.plan,
      simulated: o.simulated,
      vertical: o.vertical,
      ownerEmail: o.memberships[0]?.email ?? null,
      numbers: o._count.whatsappAccounts,
      contacts: o._count.contacts,
      members: o._count.memberships,
      aiCostMicroUsd30d: costBy.get(o.id) ?? 0,
      lastInboundAt: inboundBy.get(o.id) ?? null,
      createdAt: o.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
