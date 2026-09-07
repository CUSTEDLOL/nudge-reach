import { prisma } from "@/lib/db";
import { getPlan, planPrice, PLANS } from "@/modules/billing/plans";
import type { Currency } from "@/modules/billing/money";
import { buildCostAlerts, type CostAlertRow } from "@/modules/admin/ops";

/**
 * Money view for founders. MRR is BOOK VALUE — the plan's list price in the
 * org's own currency for every org whose subscription is active — not cash
 * collected (that lives in Razorpay/Stripe). No FX: one row per currency.
 */
export interface MrrRow {
  currency: string;
  plan: string;
  planName: string;
  orgs: number;
  monthly: number;
}

export interface RevenueOverview {
  activeSubscriptions: number;
  mrr: MrrRow[];
  /** Totals per currency, sorted largest org count first. */
  mrrByCurrency: { currency: string; monthly: number; orgs: number }[];
  trialsExpiring: { id: string; name: string; plan: string; trialEndsAt: Date; ownerEmail: string | null }[];
  trialsExpired: number;
  pastDue: { id: string; name: string; plan: string; currency: string; currentPeriodEnd: Date | null }[];
  cancelled: number;
  quietLiveOrgs: { id: string; name: string; plan: string; lastInboundAt: Date | null }[];
  costAlerts: CostAlertRow[];
}

/** Pure: aggregate active orgs into MRR rows. Exported for tests. */
export function aggregateMrr(
  orgs: { plan: string; currency: string }[]
): { rows: MrrRow[]; byCurrency: RevenueOverview["mrrByCurrency"] } {
  const rows = new Map<string, MrrRow>();
  const byCur = new Map<string, { currency: string; monthly: number; orgs: number }>();
  for (const o of orgs) {
    const plan = getPlan(o.plan);
    const price = planPrice(plan, o.currency as Currency) ?? 0;
    const key = `${o.currency}:${plan.id}`;
    const row = rows.get(key) ?? { currency: o.currency, plan: plan.id, planName: plan.name, orgs: 0, monthly: 0 };
    row.orgs += 1;
    row.monthly += price;
    rows.set(key, row);
    const c = byCur.get(o.currency) ?? { currency: o.currency, monthly: 0, orgs: 0 };
    c.orgs += 1;
    c.monthly += price;
    byCur.set(o.currency, c);
  }
  const planOrder = new Map<string, number>(PLANS.map((p, i) => [p.id, i]));
  return {
    rows: [...rows.values()].sort(
      (a, b) => a.currency.localeCompare(b.currency) || (planOrder.get(a.plan) ?? 99) - (planOrder.get(b.plan) ?? 99)
    ),
    byCurrency: [...byCur.values()].sort((a, b) => b.orgs - a.orgs),
  };
}

export async function revenueOverview(now = new Date()): Promise<RevenueOverview> {
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const ago14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [active, trialsExpiring, trialsExpired, pastDue, cancelled, liveOrgs, costAlerts] = await Promise.all([
    prisma.org.findMany({ where: { subscriptionStatus: "active" }, select: { plan: true, currency: true } }),
    prisma.org.findMany({
      where: { trialEndsAt: { gte: now, lte: in7 }, subscriptionStatus: { not: "active" } },
      select: {
        id: true,
        name: true,
        plan: true,
        trialEndsAt: true,
        memberships: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
      },
      orderBy: { trialEndsAt: "asc" },
      take: 50,
    }),
    prisma.org.count({ where: { trialEndsAt: { lt: now }, subscriptionStatus: { not: "active" } } }),
    prisma.org.findMany({
      where: { subscriptionStatus: "past_due" },
      select: { id: true, name: true, plan: true, currency: true, currentPeriodEnd: true },
      orderBy: { currentPeriodEnd: "asc" },
      take: 50,
    }),
    prisma.org.count({ where: { subscriptionStatus: "cancelled" } }),
    prisma.org.findMany({
      where: { simulated: false, suspendedAt: null },
      select: {
        id: true,
        name: true,
        plan: true,
        conversations: { select: { lastInboundAt: true }, orderBy: { lastInboundAt: "desc" }, take: 1 },
      },
      take: 200,
    }),
    buildCostAlertsForRange(now),
  ]);
  const { rows, byCurrency } = aggregateMrr(active);
  const quietLiveOrgs = liveOrgs
    .map((o) => ({ id: o.id, name: o.name, plan: o.plan, lastInboundAt: o.conversations[0]?.lastInboundAt ?? null }))
    .filter((o) => !o.lastInboundAt || o.lastInboundAt < ago14)
    .sort((a, b) => (a.lastInboundAt?.getTime() ?? 0) - (b.lastInboundAt?.getTime() ?? 0))
    .slice(0, 50);
  return {
    activeSubscriptions: active.length,
    mrr: rows,
    mrrByCurrency: byCurrency,
    trialsExpiring: trialsExpiring.map((t) => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      trialEndsAt: t.trialEndsAt!,
      ownerEmail: t.memberships[0]?.email ?? null,
    })),
    trialsExpired,
    pastDue,
    cancelled,
    quietLiveOrgs,
    costAlerts,
  };
}

/** Last-30-day platform-paid AI cost per org vs plan price (same rule as Ops). */
async function buildCostAlertsForRange(now: Date): Promise<CostAlertRow[]> {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [usage, orgs] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: since30 }, byok: false },
      _sum: { costMicroUsd: true },
    }),
    prisma.org.findMany({ select: { id: true, name: true, plan: true, currency: true } }),
  ]);
  const cost = new Map(usage.map((u) => [u.orgId, u._sum.costMicroUsd ?? 0]));
  return buildCostAlerts(
    orgs.map((o) => ({
      orgId: o.id,
      orgName: o.name,
      plan: o.plan,
      currency: o.currency,
      costMicroUsd30d: cost.get(o.id) ?? 0,
    }))
  );
}
