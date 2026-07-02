import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

/**
 * Platform module: billing. Cost estimation + real usage metering; payments
 * run through Razorpay when keys are present (lib/billing/razorpay.ts), plans
 * in lib/billing/plans.ts.
 */

export interface CostEstimate {
  recipients: number;
  ratePerMessageMinorUnits: number; // paise
  totalMinorUnits: number; // paise
  currency: "INR";
  isEstimate: true;
}

export function getMarketingRateInr(): number {
  return env.WHATSAPP_MARKETING_RATE_INR ?? 0.99;
}

/** recipients × per-message marketing rate (PRD §8). Labelled an estimate. */
export function estimateCampaignCost(recipients: number): CostEstimate {
  const rateMinor = Math.round(getMarketingRateInr() * 100);
  return {
    recipients,
    ratePerMessageMinorUnits: rateMinor,
    totalMinorUnits: recipients * rateMinor,
    currency: "INR",
    isEstimate: true,
  };
}

export function formatInr(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

/**
 * Real usage for the current calendar month (spec §M8 billing): messages sent
 * and their billable cost, computed from the Message table. Powers the billing
 * page's "usage this month" and any plan-limit checks.
 */
export interface MonthlyUsage {
  messagesSent: number;
  costMinorUnits: number;
  contacts: number;
  periodStart: Date;
}

export async function getMonthlyUsage(orgId: string): Promise<MonthlyUsage> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agg, contacts] = await Promise.all([
    prisma.message.aggregate({
      where: {
        campaign: { orgId },
        createdAt: { gte: periodStart },
        status: { not: "FAILED" },
      },
      _count: true,
      _sum: { costMinorUnits: true },
    }),
    prisma.contact.count({ where: { orgId } }),
  ]);

  return {
    messagesSent: agg._count,
    // Fall back to the estimated marketing rate when Meta hasn't reported an
    // actual cost yet (simulation, or receipts still in flight).
    costMinorUnits:
      agg._sum.costMinorUnits ??
      agg._count * Math.round(getMarketingRateInr() * 100),
    contacts,
    periodStart,
  };
}
