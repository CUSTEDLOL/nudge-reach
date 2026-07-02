/**
 * Subscription plans (spec §M8 billing). Pure config — no server imports — so
 * both server and client can render the pricing grid. Prices are the product's
 * own tiers (₹, monthly); the WhatsApp per-message cost is separate and passed
 * through from Meta.
 */

export interface Plan {
  id: "free" | "starter" | "growth" | "scale";
  name: string;
  priceInr: number; // monthly, ₹ (0 = free)
  tagline: string;
  features: string[];
  /** Soft limits surfaced in the UI (enforcement is post-MVP). */
  limits: {
    contacts: number | null; // null = unlimited
    teamMembers: number | null;
    automations: number | null;
  };
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
      "Shared inbox + AI drafts",
      "2 automations",
    ],
    limits: { contacts: 250, teamMembers: 2, automations: 2 },
  },
  {
    id: "starter",
    name: "Starter",
    priceInr: 999,
    tagline: "For a shop going live on WhatsApp.",
    features: [
      "Everything in Free",
      "Up to 2,500 contacts",
      "5 team members",
      "Unlimited automations",
      "Broadcast campaigns",
    ],
    limits: { contacts: 2500, teamMembers: 5, automations: null },
  },
  {
    id: "growth",
    name: "Growth",
    priceInr: 2499,
    tagline: "For a growing team running real campaigns.",
    features: [
      "Everything in Starter",
      "Up to 25,000 contacts",
      "15 team members",
      "Webhooks + API access",
      "Analytics & agent performance",
    ],
    limits: { contacts: 25000, teamMembers: 15, automations: null },
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    priceInr: 5999,
    tagline: "High volume, multiple numbers, priority support.",
    features: [
      "Everything in Growth",
      "Unlimited contacts",
      "Unlimited team members",
      "Priority support",
    ],
    limits: { contacts: null, teamMembers: null, automations: null },
  },
];

export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
