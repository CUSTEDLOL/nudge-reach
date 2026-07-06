import { prisma } from "@/lib/db";
import { getPlan, PLANS, type Plan } from "@/modules/billing/plans";

/** The flagship plan (AI Front Desk) — surfaced in gate messages + upsells. */
export const AI_FRONT_DESK_PLAN = PLANS.find((p) => p.flagship)!;

/** Pure: does this stored plan id include the AI Front Desk capability? */
export function planHasAiFrontDesk(planId: string): boolean {
  return getPlan(planId).limits.aiFrontDesk;
}

/**
 * Plan-limit enforcement (spec phase 6). One clean pattern everywhere:
 * call a check right before the mutation; on failure return its friendly
 * message (which always tells the user how to upgrade). Checks are
 * intentionally read-then-write (no locking) — a tiny race overshoot is
 * acceptable; the goal is honest product limits, not billing-grade fencing.
 */

export interface LimitCheck {
  allowed: boolean;
  /** Friendly, actionable message when not allowed. */
  message: string;
  used: number;
  limit: number | null;
}

const UPGRADE_HINT = "Upgrade in Settings → Billing to raise your limits.";

/** Pure core, unit-tested: compare usage (+ how many we want to add) to a cap. */
export function evaluateLimit(
  used: number,
  adding: number,
  limit: number | null,
  noun: string,
  planName: string
): LimitCheck {
  if (limit === null || used + adding <= limit) {
    return { allowed: true, message: "", used, limit };
  }
  const remaining = Math.max(0, limit - used);
  return {
    allowed: false,
    used,
    limit,
    message:
      remaining > 0
        ? `That would pass the ${planName} plan's limit of ${limit.toLocaleString("en-IN")} ${noun} (you can add ${remaining.toLocaleString("en-IN")} more). ${UPGRADE_HINT}`
        : `You've reached the ${planName} plan's limit of ${limit.toLocaleString("en-IN")} ${noun}. ${UPGRADE_HINT}`,
  };
}

async function planFor(orgId: string): Promise<Plan> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  return getPlan(org?.plan ?? "free");
}

/** Can this org add `adding` more contacts? */
export async function checkContactLimit(
  orgId: string,
  adding = 1
): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  const used = await prisma.contact.count({ where: { orgId } });
  return evaluateLimit(used, adding, plan.limits.contacts, "contacts", plan.name);
}

/** Can this org add one more seat (members + pending invites both count)? */
export async function checkTeamLimit(orgId: string): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { orgId } }),
    prisma.invite.count({ where: { orgId, status: "pending" } }),
  ]);
  return evaluateLimit(
    members + pending,
    1,
    plan.limits.teamMembers,
    "team seats",
    plan.name
  );
}

/** Can this org create one more automation? */
export async function checkAutomationLimit(orgId: string): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  const used = await prisma.automation.count({ where: { orgId } });
  return evaluateLimit(used, 1, plan.limits.automations, "automations", plan.name);
}

/**
 * Flagship-only gate: calendar booking, the Revenue-Recovery follow-up engine,
 * and the agent's real-action tools require the AI Front Desk plan. Single
 * choke point — call it right before enabling any of those, exactly like the
 * campaign-limit checks.
 */
export async function checkAiFrontDesk(orgId: string): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  if (plan.limits.aiFrontDesk) {
    return { allowed: true, message: "", used: 0, limit: null };
  }
  return {
    allowed: false,
    used: 0,
    limit: 0,
    message: `The AI Front Desk — calendar booking, the follow-up engine and agent actions — is on the ${AI_FRONT_DESK_PLAN.name} plan. Upgrade in Settings → Billing to switch it on.`,
  };
}

/** Can this org queue `recipients` more campaign messages this month? */
export async function checkMessageLimit(
  orgId: string,
  recipients: number
): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const used = await prisma.message.count({
    where: { campaign: { orgId }, createdAt: { gte: periodStart } },
  });
  return evaluateLimit(
    used,
    recipients,
    plan.limits.messagesPerMonth,
    "campaign messages this month",
    plan.name
  );
}
