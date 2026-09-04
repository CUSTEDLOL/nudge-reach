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
