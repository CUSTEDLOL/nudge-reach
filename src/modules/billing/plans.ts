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
}

export type PlanId = "free" | "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
}

/**
 * Monthly price per plan per currency, in MAJOR units (0 = free). Rounded
 * market prices per region — deliberately not live FX, so a Dubai salon sees
 * "AED 249", not "AED 247.63".
 */
export const PLAN_PRICES: Record<PlanId, Record<Currency, number>> = {
  free: { INR: 0, USD: 0, AED: 0, SAR: 0, SGD: 0, IDR: 0, BRL: 0, MXN: 0, GBP: 0 },
  starter: {
    INR: 999, USD: 29, AED: 99, SAR: 109, SGD: 39,
    IDR: 449_000, BRL: 149, MXN: 549, GBP: 25,
  },
  growth: {
    INR: 2499, USD: 69, AED: 249, SAR: 259, SGD: 95,
    IDR: 1_099_000, BRL: 349, MXN: 1299, GBP: 59,
  },
  pro: {
    INR: 5999, USD: 159, AED: 579, SAR: 599, SGD: 219,
    IDR: 2_499_000, BRL: 799, MXN: 2999, GBP: 135,
  },
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
    },
  },
];

export function getPlan(id: string): Plan {
  // "scale" was Pro's pre-launch id; map it forward for any stored value.
  if (id === "scale") id = "pro";
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
