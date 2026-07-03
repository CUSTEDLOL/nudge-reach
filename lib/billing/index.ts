import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import {
  CURRENCY_INFO,
  formatMoney,
  isCurrency,
  type Currency,
} from "@/lib/billing/money";

/**
 * Platform module: billing. Cost estimation + real usage metering in the
 * org's currency; payments run through Razorpay (INR) or Stripe (USD),
 * plans in lib/billing/plans.ts, currency config in lib/billing/money.ts.
 */

export interface CostEstimate {
  recipients: number;
  ratePerMessageMinorUnits: number; // minor units of `currency`
  totalMinorUnits: number;
  currency: Currency;
  isEstimate: true;
}

export function getMarketingRateInr(): number {
  return env.WHATSAPP_MARKETING_RATE_INR ?? 0.99;
}

/**
 * Per-message marketing rate in minor units for a billing currency. INR
 * honors the WHATSAPP_MARKETING_RATE_INR env override; other currencies use
 * the config default. Live-mode actual prices from Meta's webhook override
 * these estimates per message.
 */
export function getMessageRateMinor(currency: Currency): number {
  if (currency === "INR") return Math.round(getMarketingRateInr() * 100);
  return CURRENCY_INFO[currency].defaultMessageRateMinor;
}

/** recipients × per-message marketing rate (PRD §8). Labelled an estimate. */
export function estimateCampaignCost(
  recipients: number,
  currency: Currency = "INR"
): CostEstimate {
  const rateMinor = getMessageRateMinor(currency);
  return {
    recipients,
    ratePerMessageMinorUnits: rateMinor,
    totalMinorUnits: recipients * rateMinor,
    currency,
    isEstimate: true,
  };
}

/** Legacy INR formatter — new code should use formatMoney(minor, currency). */
export function formatInr(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

export { formatMoney };

/**
 * Real usage for the current calendar month (spec §M8 billing): messages sent
 * and their billable cost, computed from the Message table. Powers the billing
 * page's "usage this month" and any plan-limit checks.
 */
export interface MonthlyUsage {
  messagesSent: number;
  costMinorUnits: number;
  currency: Currency;
  contacts: number;
  periodStart: Date;
}

export async function getMonthlyUsage(orgId: string): Promise<MonthlyUsage> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [org, agg, contacts] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      select: { currency: true },
    }),
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

  const currency: Currency =
    org && isCurrency(org.currency) ? org.currency : "INR";

  return {
    messagesSent: agg._count,
    // Fall back to the estimated marketing rate when Meta hasn't reported an
    // actual cost yet (simulation, or receipts still in flight).
    costMinorUnits:
      agg._sum.costMinorUnits ?? agg._count * getMessageRateMinor(currency),
    currency,
    contacts,
    periodStart,
  };
}
