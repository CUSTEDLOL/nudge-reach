import { prisma } from "@/lib/db";
import { getPlan, PLANS, type Plan, type PlanLimits } from "@/modules/billing/plans";

/** Lowest sold tier that includes the agent's real actions — used in upsells. */
export const AI_FRONT_DESK_PLAN = PLANS.find(
  (p) => !p.contactOnly && !p.legacy && p.limits.aiFrontDesk
)!;

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

/** Keys a founder may override per org (Org.featureOverrides). */
const OVERRIDABLE_FLAGS = [
  "aiFrontDesk",
  "publicApi",
  "customActions",
  "byoLlm",
  "multiNumber",
  "webWidget",
  "leadScoring",
  "voiceAgent",
] as const satisfies readonly (keyof PlanLimits)[];
const OVERRIDABLE_COUNTS = [
  "contacts",
  "teamMembers",
  "automations",
  "messagesPerMonth",
  "whatsappNumbers",
] as const satisfies readonly (keyof PlanLimits)[];

export type FeatureOverrides = Partial<
  Pick<PlanLimits, (typeof OVERRIDABLE_FLAGS)[number] | (typeof OVERRIDABLE_COUNTS)[number]>
>;

/**
 * Bespoke deals (founder panel): a JSON blob on the org merged OVER the plan's
 * limits. Only known keys with the right type are honoured — a malformed blob
 * can never widen access by accident. Counts accept a number or null
 * (unlimited). Pure; unit-tested.
 */
export function sanitizeFeatureOverrides(raw: unknown): FeatureOverrides {
  const out: FeatureOverrides = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  // Own properties only — never read through the prototype chain.
  for (const k of OVERRIDABLE_FLAGS) {
    if (!Object.hasOwn(obj, k)) continue;
    if (typeof obj[k] === "boolean") out[k] = obj[k] as boolean;
  }
  for (const k of OVERRIDABLE_COUNTS) {
    if (!Object.hasOwn(obj, k)) continue;
    const v = obj[k];
    if (v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0)) {
      out[k] = v as number | null;
    }
  }
  return out;
}

export function applyFeatureOverrides(plan: Plan, raw: unknown): Plan {
  const overrides = sanitizeFeatureOverrides(raw);
  if (Object.keys(overrides).length === 0) return plan;
  return { ...plan, limits: { ...plan.limits, ...overrides } };
}

async function planFor(orgId: string): Promise<Plan> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { plan: true, featureOverrides: true },
  });
  return applyFeatureOverrides(getPlan(org?.plan ?? "free"), org?.featureOverrides);
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
    message: `Calendar booking, payment links and the follow-up engine are available from the ${AI_FRONT_DESK_PLAN.name} plan. Upgrade in Settings → Billing to switch them on.`,
  };
}

/**
 * Connected WhatsApp numbers. A count, not a flag: Starter gets one, Growth
 * two, Pro five. `have` is the number already connected.
 */
export async function checkWhatsappNumbers(
  orgId: string,
  have: number
): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  const limit = plan.limits.whatsappNumbers;
  if (limit === null || have < limit) {
    return { allowed: true, message: "", used: have, limit };
  }
  const lowest = PLANS.find(
    (p) =>
      !p.contactOnly &&
      !p.legacy &&
      (p.limits.whatsappNumbers === null || p.limits.whatsappNumbers > limit)
  );
  const next = lowest ? `Upgrade to ${lowest.name} for more.` : "Talk to us about Enterprise for more.";
  return {
    allowed: false,
    used: have,
    limit,
    message: `The ${plan.name} plan includes ${limit} WhatsApp ${limit === 1 ? "number" : "numbers"}. ${next}`,
  };
}

/**
 * Enterprise-track feature gates (E0, docs/plans/2026-09-04-enterprise-track.md
 * F4). Same shape and usage as checkAiFrontDesk: call right before the gated
 * mutation, return the message on failure.
 */
type FeatureFlag =
  | "publicApi"
  | "customActions"
  | "byoLlm"
  | "multiNumber"
  | "webWidget"
  | "leadScoring"
  | "voiceAgent";

const FEATURE_LABEL: Record<FeatureFlag, string> = {
  publicApi: "API keys + webhooks",
  customActions: "Custom agent actions",
  byoLlm: "Bring-your-own LLM",
  multiNumber: "Multiple WhatsApp numbers",
  webWidget: "The website widget",
  leadScoring: "Lead scoring",
  voiceAgent: "The voice front desk",
};

async function checkFeature(orgId: string, flag: FeatureFlag): Promise<LimitCheck> {
  const plan = await planFor(orgId);
  if (plan.limits[flag]) {
    return { allowed: true, message: "", used: 0, limit: null };
  }
  // Lowest tier that includes the feature, for an honest upsell message.
  const lowest = PLANS.find((p) => !p.contactOnly && p.limits[flag]);
  const tier = lowest ? lowest.name : "Enterprise";
  return {
    allowed: false,
    used: 0,
    limit: 0,
    message: `${FEATURE_LABEL[flag]} is available from the ${tier} plan. Upgrade in Settings → Billing to switch it on.`,
  };
}

/** Developer API keys + outbound webhooks (Growth+). */
export const checkPublicApi = (orgId: string) => checkFeature(orgId, "publicApi");
/** Per-org custom HTTP actions the agent can call (Enterprise). */
export const checkCustomActions = (orgId: string) => checkFeature(orgId, "customActions");
/** Bring-your-own LLM key (Enterprise). */
export const checkByoLlm = (orgId: string) => checkFeature(orgId, "byoLlm");
/** Multiple WhatsApp numbers per org (Enterprise). */
export const checkMultiNumber = (orgId: string) => checkFeature(orgId, "multiNumber");
/** Embeddable website WhatsApp button widget (paid tiers). */
export const checkWebWidget = (orgId: string) => checkFeature(orgId, "webWidget");
/** Predictive lead scoring + churn risk (Pro+). */
export const checkLeadScoring = (orgId: string) => checkFeature(orgId, "leadScoring");
/** Voice front desk — the AI answers the phone (front_desk/enterprise). */
export const checkVoiceAgent = (orgId: string) => checkFeature(orgId, "voiceAgent");

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
