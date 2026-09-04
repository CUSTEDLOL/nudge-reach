import { prisma } from "@/lib/db";
import { getPlan, PLAN_COST_ALERT_PCT, planPrice } from "@/modules/billing/plans";
import { approxMicroUsd, type Currency, CURRENCY_INFO } from "@/modules/billing/money";
import { aiCostAlert } from "@/modules/analytics/compute";

/**
 * Platform-health queries for the founder panel (cross-org module rules
 * apply — see queries.ts). Answers one question: is anything broken or
 * burning money right now?
 */

export interface CostAlertRow {
  orgId: string;
  orgName: string;
  plan: string;
  costMicroUsd30d: number;
  pctOfPlan: number;
}

/** Pure: join per-org cost onto plan prices and keep the over-threshold rows. */
export function buildCostAlerts(
  rows: {
    orgId: string;
    orgName: string;
    plan: string;
    currency: string;
    costMicroUsd30d: number;
  }[]
): CostAlertRow[] {
  const alerts: CostAlertRow[] = [];
  for (const r of rows) {
    const currency = (r.currency in CURRENCY_INFO ? r.currency : "INR") as Currency;
    const priceMicroUsd = approxMicroUsd(planPrice(getPlan(r.plan), currency), currency);
    const alert = aiCostAlert(r.costMicroUsd30d, priceMicroUsd, PLAN_COST_ALERT_PCT);
    if (alert?.over) {
      alerts.push({
        orgId: r.orgId,
        orgName: r.orgName,
        plan: r.plan,
        costMicroUsd30d: r.costMicroUsd30d,
        pctOfPlan: Math.round(alert.pct),
      });
    }
  }
  return alerts.sort((a, b) => b.pctOfPlan - a.pctOfPlan);
}

export async function opsOverview() {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [webhookFailures, stuckTemplates, lastAutomationRun, lastOutbound, lastAiCall, topCost] =
    await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { ok: false, createdAt: { gte: since7 } },
        select: {
          event: true,
          status: true,
          error: true,
          createdAt: true,
          endpoint: { select: { url: true, org: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.template.findMany({
        where: {
          campaignId: null,
          OR: [
            { metaStatus: "REJECTED" },
            { metaStatus: "PENDING", submittedAt: { lt: since24h } },
          ],
        },
        select: {
          name: true,
          metaStatus: true,
          rejectionReason: true,
          submittedAt: true,
          org: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 25,
      }),
      prisma.automationRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.conversationMessage.findFirst({
        where: { direction: "outbound" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.aiUsage.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.aiUsage.groupBy({
        by: ["orgId"],
        where: { createdAt: { gte: since30 } },
        _sum: { costMicroUsd: true },
        orderBy: { _sum: { costMicroUsd: "desc" } },
        take: 50,
      }),
    ]);

  const costOrgs = await prisma.org.findMany({
    where: { id: { in: topCost.map((g) => g.orgId) } },
    select: { id: true, name: true, plan: true, currency: true },
  });
  const orgById = new Map(costOrgs.map((o) => [o.id, o]));
  const costAlerts = buildCostAlerts(
    topCost.flatMap((g) => {
      const org = orgById.get(g.orgId);
      return org
        ? [
            {
              orgId: org.id,
              orgName: org.name,
              plan: org.plan,
              currency: org.currency,
              costMicroUsd30d: g._sum.costMicroUsd ?? 0,
            },
          ]
        : [];
    })
  );

  return {
    webhookFailures,
    // Campaign-less template rows should always carry an org; drop any
    // legacy row that doesn't rather than rendering a broken link.
    stuckTemplates: stuckTemplates.flatMap((t) =>
      t.org ? [{ ...t, org: t.org }] : []
    ),
    lastActivity: {
      automationRunAt: lastAutomationRun?.createdAt ?? null,
      outboundMessageAt: lastOutbound?.createdAt ?? null,
      aiCallAt: lastAiCall?.createdAt ?? null,
    },
    costAlerts,
  };
}
