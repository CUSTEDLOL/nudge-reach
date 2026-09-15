import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { envSchema } from "@/lib/env-schema";
import type { Attribution } from "@/lib/model-router/usage";
import type { DriverUsage } from "@/lib/model-router/types";
import { MICRO_USD_PER_CREDIT, RATE_CARD_VERSION, priceCall } from "@/modules/billing/credit-rates";
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

/** A type alias, not an interface, so the list is storable as Prisma Json. */
export type Allocation = {
  grantId: string;
  microUsd: number;
};

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

// ---------------------------------------------------------------------------
// Preflight: the doorway asks before every platform-paid call
// ---------------------------------------------------------------------------

export const CREDITS_EXHAUSTED_MESSAGE =
  "Your AI credits are used up, so AI replies, drafts, summaries and campaign copy are paused. Your inbox, campaigns and follow-ups keep working. Top up in Settings → Billing.";

export class CreditsExhaustedError extends Error {
  constructor(public readonly orgId: string) {
    super(CREDITS_EXHAUSTED_MESSAGE);
    this.name = "CreditsExhaustedError";
  }
}

/**
 * What one platform-paid call means to the ledger:
 * - metered: preflighted, then debited against the org's grants;
 * - unmetered: legacy plan — recorded as absorbed, never paused (decision 5);
 * - shadow: SEND_MODE=simulation, no provider was paid — recorded, no grant;
 * - absorbed: concierge ingest/distill — Nudge pays, never preflighted.
 */
export type MeteringClass = "metered" | "unmetered" | "shadow" | "absorbed";

/** Plan decision 8: concierge setup work is never charged to the customer. */
export function isAbsorbedPurpose(purpose: string): boolean {
  return purpose === "ingest" || purpose === "distill";
}

/**
 * Plan decision 6: a zero check, not a reservation — cost is unknown until
 * the provider answers, so the org may overdraw by at most one call. At ≤ 0
 * the current period's included grant is issued if it is missing (a comped
 * org the cron has not reached yet) before refusing.
 */
export async function assertCreditsAvailable(
  attribution: Attribution,
  now: Date = new Date()
): Promise<MeteringClass> {
  if (env.SEND_MODE === "simulation") return "shadow";
  if (isAbsorbedPurpose(attribution.purpose)) return "absorbed";
  const org = await prisma.org.findUnique({
    where: { id: attribution.orgId },
    select: INCLUDED_GRANT_SELECT,
  });
  if (!org) throw new Error(`assertCreditsAvailable: unknown org ${attribution.orgId}`);
  if (meteringFor(org, now).kind === "unmetered") return "unmetered";
  let balance = await creditBalance(org.id, now);
  if (balance <= 0) {
    await ensureIncludedGrant(org, now);
    balance = await creditBalance(org.id, now);
  }
  if (balance <= 0) throw new CreditsExhaustedError(org.id);
  return "metered";
}

// ---------------------------------------------------------------------------
// Debit: exact, post-hoc, idempotent on the usage row
// ---------------------------------------------------------------------------

export interface DebitAiUsageArgs {
  orgId: string;
  aiUsageId: string;
  purpose: string;
  model: string;
  usage: DriverUsage;
  /** No provider was paid (SEND_MODE=simulation). */
  simulated: boolean;
  /** Provider was paid but Nudge eats it (ingest/distill, legacy unmetered plans). */
  absorbed: boolean;
}

interface LockedGrant extends GrantSlice {
  expiresAt: Date;
}

/**
 * Price the call from the rate card (an unpriced model throws — the doorway
 * refuses those before the provider is called) and write one CreditDebit.
 * Simulated and absorbed debits touch no grant. A metered debit locks the
 * org's unexpired grants (`FOR UPDATE` serialises concurrent debits per org;
 * other orgs never contend) and spends them soonest-expiring first. A
 * duplicate aiUsageId (retry, reconciler race) is "already debited": quiet.
 */
export async function debitAiUsage(a: DebitAiUsageArgs): Promise<void> {
  const amountMicroUsd = priceCall(a.model, a.usage);
  const data = {
    orgId: a.orgId,
    amountMicroUsd,
    purpose: a.purpose,
    model: a.model,
    rateCardVersion: RATE_CARD_VERSION,
    aiUsageId: a.aiUsageId,
    simulated: a.simulated,
    absorbed: a.absorbed,
  };
  try {
    if (a.simulated || a.absorbed) {
      await prisma.creditDebit.create({ data: { ...data, allocations: [] } });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const grants = await tx.$queryRaw<LockedGrant[]>`
        SELECT id, "remainingMicroUsd", "expiresAt" FROM "CreditGrant"
        WHERE "orgId" = ${a.orgId} AND "expiresAt" > now()
        ORDER BY "expiresAt" ASC, "issuedAt" ASC
        FOR UPDATE`;
      const { allocations, overdraftOn } = allocateFifo(grants, amountMicroUsd);
      // The debit row first, so a duplicate fails before any grant is touched.
      await tx.creditDebit.create({ data: { ...data, allocations } });
      for (const alloc of overdraftOn ? [...allocations, overdraftOn] : allocations) {
        await tx.creditGrant.update({
          where: { id: alloc.grantId },
          data: { remainingMicroUsd: { decrement: alloc.microUsd } },
        });
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // already debited
    throw err;
  }
}

/** Shadow when no provider was paid; absorbed when Nudge pays (concierge work, legacy unmetered plans). */
function debitFlags(metering: MeteringClass): Pick<DebitAiUsageArgs, "simulated" | "absorbed"> {
  return {
    simulated: metering === "shadow",
    absorbed: metering === "absorbed" || metering === "unmetered",
  };
}

export interface SettleDebitArgs {
  attribution: Attribution;
  model: string;
  usage: DriverUsage;
  /** From recordUsage; null when the usage row could not be written. */
  aiUsageId: string | null;
  metering: MeteringClass;
}

/**
 * The doorway's post-call debit. Never throws: the customer's reply exists
 * and the provider is already paid. Never silent either: a failed write is
 * logged with a stable tag and re-driven by `reconcileCreditDebits` on the
 * next cron tick. A missing usage row has nothing to anchor on and is the
 * one accepted loss (the same failure class as the analytics row).
 */
export async function settleDebit(a: SettleDebitArgs): Promise<void> {
  const { orgId, purpose } = a.attribution;
  if (!a.aiUsageId) {
    console.error("[credits] usage row missing — nothing to anchor the debit on", { orgId, purpose });
    return;
  }
  try {
    await debitAiUsage({
      orgId,
      aiUsageId: a.aiUsageId,
      purpose,
      model: a.model,
      usage: a.usage,
      ...debitFlags(a.metering),
    });
  } catch (err) {
    console.error(
      "[credits] debit failed — reconciler will retry",
      { orgId, aiUsageId: a.aiUsageId, purpose },
      err
    );
  }
}

// ---------------------------------------------------------------------------
// Reconciler (cron): re-debit what the doorway could not
// ---------------------------------------------------------------------------

const RECONCILE_BATCH = 200;

const METERING_SELECT = {
  id: true,
  plan: true,
  featureOverrides: true,
  includedCreditsOverride: true,
  trialEndsAt: true,
} as const;

/**
 * Every platform, non-synthetic AiUsage row since CREDIT_LEDGER_EPOCH with no
 * CreditDebit, oldest first in a bounded batch. Idempotent on aiUsageId, so
 * racing the doorway is harmless. A row that keeps failing (no grant, an
 * unpriced model) stays visible here every tick rather than being dropped.
 */
export async function reconcileCreditDebits(
  now: Date = new Date()
): Promise<{ debited: number; failed: number }> {
  const rows = await prisma.aiUsage.findMany({
    where: {
      byok: false,
      synthetic: false,
      createdAt: { gte: new Date(env.CREDIT_LEDGER_EPOCH) },
      creditDebit: null,
    },
    orderBy: { createdAt: "asc" },
    take: RECONCILE_BATCH,
    select: {
      id: true,
      orgId: true,
      purpose: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
  });
  const counts = { debited: 0, failed: 0 };
  if (rows.length === 0) return counts;

  // Same classification as the doorway's preflight, per org instead of per call.
  const orgs = await prisma.org.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.orgId))] } },
    select: METERING_SELECT,
  });
  const unmetered = new Set(
    orgs.filter((o) => meteringFor(o, now).kind === "unmetered").map((o) => o.id)
  );
  const classify = (r: { orgId: string; purpose: string }): MeteringClass => {
    if (env.SEND_MODE === "simulation") return "shadow";
    if (isAbsorbedPurpose(r.purpose)) return "absorbed";
    return unmetered.has(r.orgId) ? "unmetered" : "metered";
  };

  for (const r of rows) {
    try {
      await debitAiUsage({
        orgId: r.orgId,
        aiUsageId: r.id,
        purpose: r.purpose,
        model: r.model,
        usage: {
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          cacheReadTokens: r.cacheReadTokens,
          cacheWriteTokens: r.cacheWriteTokens,
        },
        ...debitFlags(classify(r)),
      });
      counts.debited++;
    } catch (err) {
      counts.failed++;
      console.error(
        "[credits] reconcile failed — will retry next tick",
        { orgId: r.orgId, aiUsageId: r.id, purpose: r.purpose },
        err
      );
    }
  }
  return counts;
}
