import type { Currency } from "./money";

/**
 * Subscription plans (spec §M8 billing). Pure config — no server imports — so
 * both server and client can render the pricing grid. Each market pays in its
 * LOCAL currency (PLAN_PRICES below — rounded market prices, founder-tunable,
 * not live FX); the WhatsApp per-message cost is separate and passed through
 * from Meta. Limits are enforced server-side in lib/billing/limits.ts.
 */

export interface PlanLimits {
  contacts: number | null; // null = unlimited
  teamMembers: number | null;
  automations: number | null;
  /** Campaign messages per calendar month. */
  messagesPerMonth: number | null;
  /**
   * AI Front Desk capability: calendar booking, the Revenue-Recovery follow-up
   * engine, and the agent's real-action tools. The single flag every
   * flagship-only feature gates on (see `checkAiFrontDesk` in limits.ts).
   */
  aiFrontDesk: boolean;
  /**
   * Enterprise-track feature flags (docs/plans/2026-09-04-enterprise-track.md
   * F4). Same precedent as aiFrontDesk: booleans here, `check*` wrappers in
   * limits.ts, enforced server-side right before the gated mutation.
   */
  /** Developer API keys + outbound webhooks (Growth+). */
  publicApi: boolean;
  /** Agent calls the customer's own backend via configured HTTP actions. */
  customActions: boolean;
  /** Bring-your-own LLM key (OpenAI / Google / Anthropic). */
  byoLlm: boolean;
  /** Multiple WhatsApp numbers on one org. */
  multiNumber: boolean;
  /** Embeddable website WhatsApp button widget (paid tiers). */
  webWidget: boolean;
  /** Predictive lead scoring + churn risk (Pro+). */
  leadScoring: boolean;
  /** Voice front desk — the AI answers the phone (front_desk/enterprise). */
  voiceAgent: boolean;
  /**
   * Call minutes included per calendar month. 0 = no voice, null = unlimited.
   * When they run out the AI stops answering for that org (enforced in the
   * call-initiation webhook), so a runaway number can't outrun the package.
   * An org can override this for a bespoke deal — see `npm run voice:minutes`.
   */
  voiceMinutesPerMonth: number | null;
}

export type PlanId =
  | "free"
  | "starter"
  | "growth"
  | "pro"
  | "front_desk"
  | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  /** Highlighted self-serve tier in the pricing grid. */
  highlighted?: boolean;
  /** The done-for-you flagship — the hero of the marketing site. */
  flagship?: boolean;
  /**
   * Not self-serve purchasable: hidden from the billing grid and rejected by
   * checkout — founder assigns it via `npm run plan:set`.
   */
  contactOnly?: boolean;
}

/**
 * Monthly price per plan per currency, in MAJOR units (0 = free). Rounded
 * market prices per region — deliberately not live FX, so a Dubai salon sees
 * "AED 249", not "AED 247.63".
 */
export const PLAN_PRICES: Record<PlanId, Record<Currency, number>> = {
  free: { INR: 0, USD: 0, AED: 0, SAR: 0, SGD: 0, MYR: 0, IDR: 0, BRL: 0, MXN: 0, GBP: 0 },
  starter: {
    INR: 999, USD: 29, AED: 99, SAR: 109, SGD: 39, MYR: 49,
    IDR: 449_000, BRL: 149, MXN: 549, GBP: 25,
  },
  growth: {
    INR: 2499, USD: 69, AED: 249, SAR: 259, SGD: 95, MYR: 139,
    IDR: 1_099_000, BRL: 349, MXN: 1299, GBP: 59,
  },
  pro: {
    INR: 5999, USD: 159, AED: 579, SAR: 599, SGD: 219, MYR: 329,
    IDR: 2_499_000, BRL: 799, MXN: 2999, GBP: 135,
  },
  // Flagship "AI Front Desk" — priced against the ₹18–25k human it replaces,
  // in each market's local currency (founder-tunable, not live FX).
  front_desk: {
    INR: 14_999, USD: 179, AED: 659, SAR: 679, SGD: 599, MYR: 1_199,
    IDR: 2_999_000, BRL: 899, MXN: 3_499, GBP: 149,
  },
  // Contact-us tier — 0 everywhere because it is never sold through checkout.
  enterprise: { INR: 0, USD: 0, AED: 0, SAR: 0, SGD: 0, MYR: 0, IDR: 0, BRL: 0, MXN: 0, GBP: 0 },
};

/** Major-unit monthly price in the given currency. */
export function planPrice(plan: Plan, currency: Currency): number {
  return PLAN_PRICES[plan.id][currency];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try the whole product in simulation.",
    features: [
      "1 WhatsApp number",
      "Up to 250 contacts",
      "500 campaign messages / month",
      "Shared inbox + AI drafts",
      "2 automations · 2 team seats",
    ],
    limits: {
      contacts: 250,
      teamMembers: 2,
      automations: 2,
      messagesPerMonth: 500,
      aiFrontDesk: false,
      publicApi: false,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: false,
      leadScoring: false,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    },
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For a shop going live on WhatsApp.",
    features: [
      "Everything in Free",
      "Up to 2,500 contacts",
      "3,000 campaign messages / month",
      "5 team seats",
      "Unlimited automations",
      "Broadcasts + scheduling",
    ],
    limits: {
      contacts: 2500,
      teamMembers: 5,
      automations: null,
      messagesPerMonth: 3000,
      aiFrontDesk: false,
      publicApi: false,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: true,
      leadScoring: false,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    },
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For a growing team running real campaigns.",
    features: [
      "Everything in Starter",
      "Up to 25,000 contacts",
      "30,000 campaign messages / month",
      "15 team seats",
      "Webhooks + API access",
      "Analytics & agent performance",
    ],
    limits: {
      contacts: 25000,
      teamMembers: 15,
      automations: null,
      messagesPerMonth: 30000,
      aiFrontDesk: false,
      publicApi: true,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: true,
      leadScoring: false,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    },
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "High volume, multiple teams, priority support.",
    features: [
      "Everything in Growth",
      "Unlimited contacts",
      "Unlimited team members",
      "Unlimited campaign messages",
      "Priority support",
    ],
    limits: {
      contacts: null,
      teamMembers: null,
      automations: null,
      messagesPerMonth: null,
      aiFrontDesk: false,
      publicApi: true,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: true,
      leadScoring: true,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    },
  },
  {
    id: "front_desk",
    name: "AI Front Desk",
    tagline: "Your AI employee — books, chases, collects. Set up for you.",
    features: [
      "Everything in Pro, unlimited",
      "AI agent that books into your real Google Calendar",
      "Revenue-Recovery follow-ups (chases quiet leads, no-shows, reminders)",
      "Payment links + real actions in your systems",
      "Concierge onboarding — we set it all up",
      "Priority human support",
    ],
    limits: {
      contacts: null,
      teamMembers: null,
      automations: null,
      messagesPerMonth: null,
      aiFrontDesk: true,
      publicApi: true,
      customActions: true,
      byoLlm: true,
      multiNumber: true,
      webWidget: true,
      leadScoring: true,
      voiceAgent: true,
      voiceMinutesPerMonth: 100,
    },
    flagship: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For teams that need Nudge to fit their stack.",
    features: [
      "Everything in AI Front Desk",
      "Developer API + webhooks",
      "Custom agent actions into your backend",
      "Bring your own LLM (OpenAI / Google / Anthropic)",
      "Multiple WhatsApp numbers",
      "Predictive lead scoring",
    ],
    limits: {
      contacts: null,
      teamMembers: null,
      automations: null,
      messagesPerMonth: null,
      aiFrontDesk: true,
      publicApi: true,
      customActions: true,
      byoLlm: true,
      multiNumber: true,
      webWidget: true,
      leadScoring: true,
      voiceAgent: true,
      voiceMinutesPerMonth: null,
    },
    contactOnly: true,
  },
];

/** The tiers sold through the self-serve billing grid (contact-only tiers excluded). */
export function selfServePlans(): Plan[] {
  return PLANS.filter((p) => !p.contactOnly);
}

export function getPlan(id: string): Plan {
  // "scale" was Pro's pre-launch id; map it forward for any stored value.
  if (id === "scale") id = "pro";
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/**
 * Alert threshold (PLAN.md WS2): flag an org when its monthly AI cost
 * exceeds this percentage of its plan price. Per-org override lives in
 * Org.settings.aiCostAlertPct.
 */
export const PLAN_COST_ALERT_PCT = 35;
