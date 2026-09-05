import { prisma } from "@/lib/db";
import { getPlan } from "@/modules/billing/plans";
import { evaluateLimit, type LimitCheck } from "@/modules/billing/limits";

/**
 * Voice minute allowance. Every package includes a number of call minutes;
 * when they run out the AI stops taking calls for that org (the initiation
 * webhook refuses, so the call never becomes a billable conversation).
 *
 * Minutes come from the plan (`PlanLimits.voiceMinutesPerMonth`), and an org
 * can carry a founder-set override for a bespoke package
 * (`npm run voice:minutes`). `null` on either means unlimited.
 */

/** A call bills as whole minutes, rounded up — the telecom convention. */
export function roundCallMinutes(durationSecs: number | null): number {
  if (!durationSecs || durationSecs <= 0) return 0;
  return Math.ceil(durationSecs / 60);
}

export function sumCallMinutes(calls: { durationSecs: number | null }[]): number {
  return calls.reduce((total, c) => total + roundCallMinutes(c.durationSecs), 0);
}

/** The org override wins when set (including a deliberate 0); else the plan. */
export function resolveIncludedMinutes(
  override: number | null,
  planMinutes: number | null
): number | null {
  return override ?? planMinutes;
}

/** First of the current month — same window convention as campaign messages. */
export function periodStartOf(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface VoiceUsage extends LimitCheck {
  /** Minutes left this month; null when the allowance is unlimited. */
  remaining: number | null;
  exhausted: boolean;
  periodStart: Date;
}

/**
 * Where the org stands this month. `adding` is the minutes we are about to
 * commit to (1 = "may we start another call?").
 */
export async function voiceUsage(orgId: string, adding = 0, now = new Date()): Promise<VoiceUsage> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { plan: true, voiceMinutesOverride: true },
  });
  const plan = getPlan(org?.plan ?? "free");
  const included = resolveIncludedMinutes(
    org?.voiceMinutesOverride ?? null,
    plan.limits.voiceMinutesPerMonth
  );
  const periodStart = periodStartOf(now);
  const calls = await prisma.voiceCall.findMany({
    where: { orgId, startedAt: { gte: periodStart } },
    select: { durationSecs: true },
  });
  const used = sumCallMinutes(calls);
  const check = evaluateLimit(used, adding, included, "call minutes this month", plan.name);
  return {
    ...check,
    remaining: included === null ? null : Math.max(0, included - used),
    exhausted: !check.allowed,
    periodStart,
  };
}
