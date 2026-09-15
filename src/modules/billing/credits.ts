import { Prisma } from "@prisma/client";
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

// ---------------------------------------------------------------------------
// Grants: trial, included per paid period, same-period top-up
// ---------------------------------------------------------------------------

export const TRIAL_CREDITS = 100;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** The trial grant's row (minus orgId): 100 credits that die with the trial. */
export function trialGrant(expiresAt: Date) {
  const micro = TRIAL_CREDITS * MICRO_USD_PER_CREDIT;
  return { kind: "trial", sourceKey: "trial", amountMicroUsd: micro, remainingMicroUsd: micro, expiresAt };
}

/** Issue the trial grant once per org (the unique key makes a repeat quiet). */
export async function issueTrialGrant(orgId: string, trialEndsAt: Date): Promise<void> {
  try {
    await prisma.creditGrant.create({ data: { orgId, ...trialGrant(trialEndsAt) } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

export interface IncludedGrantOrg extends MeteringOrg {
  id: string;
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
}

const INCLUDED_GRANT_SELECT = {
  id: true,
  plan: true,
  featureOverrides: true,
  includedCreditsOverride: true,
  trialEndsAt: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
} as const;

/** Idempotency key of a period's included grant: the day it ends. */
function periodKey(periodEnd: Date): string {
  return periodEnd.toISOString().slice(0, 10);
}

/**
 * Plan decision 4: the micro-USD owed for the org's current paid period, or
 * null when no grant is due — not active, no period or a lapsed one, a live
 * trial (metered on the trial grant alone), or an unmetered legacy plan.
 * 0 is a real amount (Enterprise without an override) so the debit has an
 * anchor and the admin card can show the forgotten override.
 */
function includedGrantAmount(org: IncludedGrantOrg, now: Date): number | null {
  if (org.subscriptionStatus !== "active") return null;
  if (!org.currentPeriodEnd || org.currentPeriodEnd <= now) return null;
  if (org.trialEndsAt && org.trialEndsAt > now) return null;
  const metering = meteringFor(org, now);
  if (metering.kind !== "metered") return null;
  return metering.includedCredits * MICRO_USD_PER_CREDIT;
}

/**
 * Issue the included grant for the org's current paid period, keyed on
 * `currentPeriodEnd` and expiring there — a renewal is a new period end,
 * hence a fresh grant (founder decision: reset on the payment date). Safe to
 * call from every activation path and the cron; returns whether it created one.
 */
export async function ensureIncludedGrant(org: IncludedGrantOrg, now: Date = new Date()): Promise<boolean> {
  const amount = includedGrantAmount(org, now);
  if (amount === null) return false;
  const periodEnd = org.currentPeriodEnd as Date;
  try {
    await prisma.creditGrant.create({
      data: {
        orgId: org.id,
        kind: "included",
        sourceKey: periodKey(periodEnd),
        amountMicroUsd: amount,
        remainingMicroUsd: amount,
        expiresAt: periodEnd,
      },
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false; // already issued for this period
    throw err;
  }
}

/** `ensureIncludedGrant` for callers that only hold the org id (webhooks). */
export async function ensureIncludedGrantFor(orgId: string, now: Date = new Date()): Promise<boolean> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: INCLUDED_GRANT_SELECT });
  return org ? ensureIncludedGrant(org, now) : false;
}

/**
 * Cron back-fill: every active org in a paid period with no grant for it yet.
 * This is how comped and Enterprise orgs (no checkout) get their credits after
 * the founder marks them active in admin. Returns the number issued.
 */
export async function issueIncludedCredits(now: Date = new Date()): Promise<number> {
  const orgs = await prisma.org.findMany({
    where: {
      subscriptionStatus: "active",
      currentPeriodEnd: { gt: now },
      OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: now } }],
    },
    select: INCLUDED_GRANT_SELECT,
  });
  if (orgs.length === 0) return 0;
  // Skip the ones already covered rather than paying for a P2002 each tick.
  const covered = await prisma.creditGrant.findMany({
    where: { orgId: { in: orgs.map((o) => o.id) }, kind: "included", expiresAt: { gt: now } },
    select: { orgId: true, sourceKey: true },
  });
  const has = new Set(covered.map((g) => `${g.orgId}:${g.sourceKey}`));
  let issued = 0;
  for (const org of orgs) {
    if (org.currentPeriodEnd && has.has(`${org.id}:${periodKey(org.currentPeriodEnd)}`)) continue;
    if (await ensureIncludedGrant(org, now)) issued++;
  }
  return issued;
}

/**
 * Same-period plan change (an Enterprise override, a founder-set plan): raise
 * the current included grant to the new plan's amount, adding only the
 * difference to both issued and remaining. A downgrade leaves it alone. With
 * no current grant, this period's grant is issued instead.
 */
export async function topUpIncludedGrant(orgId: string, now: Date = new Date()): Promise<boolean> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: INCLUDED_GRANT_SELECT });
  if (!org) return false;
  const amount = includedGrantAmount(org, now);
  if (amount === null) return false;
  const topped = await prisma.$transaction(async (tx) => {
    // Locked so a concurrent debit's decrement and this increment serialise.
    const [grant] = await tx.$queryRaw<{ id: string; amountMicroUsd: number }[]>`
      SELECT id, "amountMicroUsd" FROM "CreditGrant"
      WHERE "orgId" = ${orgId} AND kind = 'included' AND "expiresAt" > ${now}
      ORDER BY "expiresAt" DESC LIMIT 1
      FOR UPDATE`;
    if (!grant) return null;
    const diff = amount - grant.amountMicroUsd;
    if (diff <= 0) return false;
    await tx.creditGrant.update({
      where: { id: grant.id },
      data: { amountMicroUsd: { increment: diff }, remainingMicroUsd: { increment: diff } },
    });
    return true;
  });
  return topped ?? ensureIncludedGrant(org, now);
}
