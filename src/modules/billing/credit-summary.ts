import { prisma } from "@/lib/db";
import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credit-rates";
import {
  creditBalance,
  estimateRemainingReplies,
  meteringFor,
  type Metering,
  type MeteringOrg,
} from "@/modules/billing/credits";

/**
 * The customer's view of the credit ledger (plan Task 8), shared by the
 * billing page and the low-balance email so both show the same numbers.
 * Every query is org-scoped (invariant #5).
 */

export const REPLY_AVERAGE_WINDOW_DAYS = 30;

export interface CreditSummary {
  metering: Metering;
  /** Across unexpired grants; slightly negative after an overdraft. 0 when unmetered. */
  balanceMicroUsd: number;
  /** This paid period's included grant; null on a trial, or before the first payment. */
  included: { amountMicroUsd: number; issuedAt: Date } | null;
  /** Soonest expiry among purchased grants that still have credits. */
  purchasedExpiresAt: Date | null;
  /** Average real agent reply over the window; null with no history. */
  avgReplyMicroUsd: number | null;
  estimatedReplies: number;
}

/** Mean cost of this org's real (not shadow, not absorbed) agent replies in the window. */
export async function avgAgentReplyMicroUsd(orgId: string, now: Date = new Date()): Promise<number | null> {
  const since = new Date(now.getTime() - REPLY_AVERAGE_WINDOW_DAYS * 86_400_000);
  const r = await prisma.creditDebit.aggregate({
    _avg: { amountMicroUsd: true },
    where: { orgId, purpose: "agent_reply", simulated: false, absorbed: false, createdAt: { gte: since } },
  });
  return r._avg.amountMicroUsd ?? null;
}

export async function creditSummary(
  org: MeteringOrg & { id: string },
  now: Date = new Date()
): Promise<CreditSummary> {
  const metering = meteringFor(org, now);
  if (metering.kind === "unmetered") {
    return {
      metering,
      balanceMicroUsd: 0,
      included: null,
      purchasedExpiresAt: null,
      avgReplyMicroUsd: null,
      estimatedReplies: 0,
    };
  }
  const [balanceMicroUsd, included, purchase, avgReplyMicroUsd] = await Promise.all([
    creditBalance(org.id, now),
    prisma.creditGrant.findFirst({
      where: { orgId: org.id, kind: "included", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: { amountMicroUsd: true, issuedAt: true },
    }),
    prisma.creditGrant.findFirst({
      where: { orgId: org.id, kind: "purchase", expiresAt: { gt: now }, remainingMicroUsd: { gt: 0 } },
      orderBy: { expiresAt: "asc" },
      select: { expiresAt: true },
    }),
    avgAgentReplyMicroUsd(org.id, now),
  ]);
  return {
    metering,
    balanceMicroUsd,
    included,
    purchasedExpiresAt: purchase?.expiresAt ?? null,
    avgReplyMicroUsd,
    estimatedReplies: estimateRemainingReplies(balanceMicroUsd, avgReplyMicroUsd),
  };
}

/** Micro-USD as credits with one decimal, e.g. "1,234.6". */
export function formatCredits(microUsd: number): string {
  return (microUsd / MICRO_USD_PER_CREDIT).toLocaleString("en-IN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
