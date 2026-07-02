/**
 * Subscription plans (spec §M8 billing). Pure config — no server imports — so
 * both server and client can render the pricing grid. Prices are the product's
 * own tiers (₹, monthly); the WhatsApp per-message cost is separate and passed
 * through from Meta. Limits are enforced server-side in lib/billing/limits.ts.
 */

export interface PlanLimits {
  contacts: number | null; // null = unlimited
  teamMembers: number | null;
  automations: number | null;
  /** Campaign messages per calendar month. */
  messagesPerMonth: number | null;
}

export interface Plan {
  id: "free" | "starter" | "growth" | "pro";
  name: string;
  priceInr: number; // monthly, ₹ (0 = free)
  tagline: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceInr: 0,
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
    priceInr: 999,
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
    priceInr: 2499,
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
    priceInr: 5999,
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
