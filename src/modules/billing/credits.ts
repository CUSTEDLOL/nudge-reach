import { prisma } from "@/lib/db";
import { envSchema } from "@/lib/env-schema";
import { MICRO_USD_PER_CREDIT, priceCall } from "@/modules/billing/credit-rates";
import { applyFeatureOverrides } from "@/modules/billing/limits";
import { getPlan } from "@/modules/billing/plans";

/**
 * Credit ledger (docs/superpowers/plans/2026-09-15-credit-ledger.md). Every
 * platform-paid LLM call that serves the customer debits an org-scoped
 * balance held as CreditGrant rows; a zero balance pauses platform-paid AI
 * only. Unit of account is micro-USD (see credit-rates.ts). Every query here
 * is org-scoped (invariant #5).
 */

export { MICRO_USD_PER_CREDIT };

// ---------------------------------------------------------------------------
// FIFO-by-expiry allocation (pure)
// ---------------------------------------------------------------------------

/** A grant row as locked by the debit transaction. */
export interface GrantSlice {
  id: string;
  remainingMicroUsd: number;
}

export interface Allocation {
  grantId: string;
  microUsd: number;
}

export interface FifoResult {
  /** In FIFO order; stored on the debit row. */
  allocations: Allocation[];
  /** The part no grant could cover, charged to the latest-expiring grant. */
  overdraftOn?: Allocation;
}

/**
 * Spend `amountMicroUsd` across `grants`, which the caller has already
 * filtered to unexpired and ordered soonest-expiring first. When the grants
 * are short, the remainder overdraws the LAST grant (plan decision 6: at most
 * one call per org goes negative, so the next preflight blocks). Works when
 * the only grant is 0 (Enterprise without an override); throws when there is
 * no grant at all, because a debit with nothing to anchor it would be lost.
 */
export function allocateFifo(
  grants: readonly GrantSlice[],
  amountMicroUsd: number
): FifoResult {
  const allocations: Allocation[] = [];
  let left = amountMicroUsd;
  for (const g of grants) {
    if (left <= 0) break;
    const take = Math.min(left, g.remainingMicroUsd);
    if (take <= 0) continue; // drained or already overdrawn
    allocations.push({ grantId: g.id, microUsd: take });
    left -= take;
  }
  if (left <= 0) return { allocations };
  const last = grants[grants.length - 1];
  if (!last) throw new Error("allocateFifo: no grant to charge the debit against");
  return { allocations, overdraftOn: { grantId: last.id, microUsd: left } };
}

// ---------------------------------------------------------------------------
// Metering class (pure)
// ---------------------------------------------------------------------------

export type Metering =
  /** Legacy front_desk: shadow debits only, never paused ("never silently reprice"). */
  | { kind: "unmetered" }
  /** Credits per paid period; 0 means AI pauses until credits are granted or bought. */
  | { kind: "metered"; includedCredits: number };

export interface MeteringOrg {
  plan: string;
  featureOverrides: unknown;
  includedCreditsOverride: number | null;
  trialEndsAt: Date | null;
}

/**
 * Plan decision 5. Feature overrides are applied for parity with limits.ts
 * but cannot touch credits (they carry no credit key): the only per-org
 * credit knob is `includedCreditsOverride`, and only Enterprise reads it. A
 * live trial is metered against the trial grant alone, so it has no
 * included amount until a payment starts a period.
 */
export function meteringFor(org: MeteringOrg, now: Date = new Date()): Metering {
  const plan = applyFeatureOverrides(getPlan(org.plan), org.featureOverrides);
  if (plan.includedCredits === null && !plan.contactOnly) return { kind: "unmetered" };
  if (org.trialEndsAt && org.trialEndsAt > now) return { kind: "metered", includedCredits: 0 };
  if (plan.contactOnly) {
    return { kind: "metered", includedCredits: org.includedCreditsOverride ?? 0 };
  }
  return { kind: "metered", includedCredits: plan.includedCredits ?? 0 };
}

// ---------------------------------------------------------------------------
// Remaining-work estimate (pure)
// ---------------------------------------------------------------------------

/** The platform model when RUNTIME_MODEL is unset — read from the env schema so it can't drift. */
const DEFAULT_RUNTIME_MODEL = envSchema.shape.RUNTIME_MODEL.parse(undefined);

/**
 * "≈ n more AI replies" for the billing page. Uses the org's recent average
 * debit per reply; with no history, a typical 2,000-in / 300-out reply on
 * the default runtime model at rate-card prices.
 */
export function estimateRemainingReplies(
  balanceMicroUsd: number,
  avgReplyMicroUsd: number | null
): number {
  const perReply =
    avgReplyMicroUsd && avgReplyMicroUsd > 0
      ? avgReplyMicroUsd
      : priceCall(DEFAULT_RUNTIME_MODEL, { inputTokens: 2_000, outputTokens: 300 });
  return Math.max(0, Math.floor(balanceMicroUsd / perReply));
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/** Micro-USD across the org's unexpired grants; may be slightly negative after an overdraft. */
export async function creditBalance(orgId: string, now: Date = new Date()): Promise<number> {
  const r = await prisma.creditGrant.aggregate({
    _sum: { remainingMicroUsd: true },
    where: { orgId, expiresAt: { gt: now } },
  });
  return r._sum.remainingMicroUsd ?? 0;
}
