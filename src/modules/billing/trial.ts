import { prisma } from "@/lib/db";

/** Every new workspace starts on the AI Front Desk for this long — the only
 * self-serve way to reach calendar booking, follow-ups and agent actions
 * before a subscription exists. */
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN = "front_desk";

const DAY_MS = 24 * 60 * 60 * 1000;

export function trialEndDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}

/** Whole days left (0 once it's over); null when the org has no trial. */
export function trialDaysLeft(
  trialEndsAt: Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

/** Cron: trials that ended fall back to Free unless a subscription took over. */
export async function expireTrials(now: Date = new Date()): Promise<number> {
  const result = await prisma.org.updateMany({
    where: { trialEndsAt: { lt: now }, subscriptionStatus: { not: "active" } },
    data: { plan: "free", trialEndsAt: null },
  });
  return result.count;
}
