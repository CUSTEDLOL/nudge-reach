import type { Currency } from "./money";

/**
 * Subscription plans. Pure config — no server imports — so both server and
 * client can render the pricing grid. Each market pays in its LOCAL currency
 * (PLAN_PRICES below — rounded market prices, founder-tunable, not live FX);
 * the WhatsApp per-message cost is separate and passed through from Meta.
 * Limits are enforced server-side in billing/limits.ts.
 *
 * Tiering approved 2026-09-11, amended with a permanent Entry plan
 * (docs/plans/2026-09-11-tiered-pricing-design.md): Entry / Starter / Growth /
 * Pro / custom Enterprise, replacing the old single flagship plus mandatory
 * setup fee. Entry answers questions but never acts. Starter adds the full
 * workspace. Growth adds the real actions (booking, payment links,
 * follow-ups). Pro adds voice and the bring-your-own-key options.
 *
 * ENTRY IS PROVISIONAL. The founder record leaves its seats, numbers, credits
 * and Singapore price undecided, and "Entry" is a working name. The caps below
 * are deliberately conservative placeholders so the tier can be enforced at
 * all — they need sign-off before Entry is promoted anywhere but India.
 *
 * `free` and `front_desk` remain as LEGACY plans: not sold, hidden from the
 * grid, kept so existing workspaces keep exactly what they already had. Never
 * silently reprice or downgrade someone who is already on one.
 */

export interface PlanLimits {
  contacts: number | null; // null = unlimited
  teamMembers: number | null;
  automations: number | null;
  /** Campaign messages per calendar month. */
  messagesPerMonth: number | null;
  /** Connected WhatsApp numbers. null = unlimited. */
  whatsappNumbers: number | null;
  /**
   * The agent's real actions: calendar booking, the Revenue-Recovery
   * follow-up engine, payment links and concierge setup. Growth and above.
   * (Plain AI replies and lead capture are NOT gated on this — they are
   * included on every tier.)
   */
  aiFrontDesk: boolean;
  /** Developer API keys + outbound webhooks. */
  publicApi: boolean;
  /** Agent calls the customer's own backend via configured HTTP actions. */
  customActions: boolean;
  /** Bring-your-own LLM key (OpenAI / Google / Anthropic). */
  byoLlm: boolean;
  /** More than one WhatsApp number. Mirrors `whatsappNumbers`. */
  multiNumber: boolean;
  /** Embeddable website WhatsApp button widget. */
  webWidget: boolean;
  /** Lead scoring + churn risk. */
  leadScoring: boolean;
  /** Voice front desk — the AI answers the phone. */
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
  | "entry"
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
  /**
   * Not self-serve purchasable: hidden from the billing grid and rejected by
   * checkout — founder assigns it via `npm run plan:set`.
   */
  contactOnly?: boolean;
  /**
   * Retired tier kept only so existing workspaces resolve. Hidden from the
   * grid and refused by checkout, exactly like contactOnly.
   */
  legacy?: boolean;
}

/**
 * Monthly price per plan per currency, in MAJOR units. Rounded market prices
 * per region — deliberately not live FX, so a Dubai clinic sees "AED 329",
 * not "AED 327.41".
 *
 * India is the approved figure for every tier; Singapore is approved for
 * Starter, Growth and Pro. Everything else is DERIVED from each market's
 * previously tuned flagship price (which becomes Pro), holding the India
 * ladder shape: Entry a tenth, Starter three tenths, Growth a half. Those are
 * sane placeholders, not signed-off market prices — review before promoting
 * those markets. Entry's Singapore price is explicitly undecided, so the
 * public pricing page does not print one.
 */
export const PLAN_PRICES: Record<PlanId, Record<Currency, number>> = {
  entry: {
    INR: 1_499, USD: 19, AED: 69, SAR: 69, SGD: 49, MYR: 119,
    IDR: 299_000, BRL: 89, MXN: 349, GBP: 15,
  },
  starter: {
    INR: 4_499, USD: 49, AED: 199, SAR: 209, SGD: 79, MYR: 359,
    IDR: 899_000, BRL: 269, MXN: 1_049, GBP: 45,
  },
  growth: {
    INR: 7_499, USD: 89, AED: 329, SAR: 339, SGD: 249, MYR: 599,
    IDR: 1_499_000, BRL: 449, MXN: 1_749, GBP: 75,
  },
  pro: {
    INR: 14_999, USD: 179, AED: 659, SAR: 679, SGD: 499, MYR: 1_199,
    IDR: 2_999_000, BRL: 899, MXN: 3_499, GBP: 149,
  },
  // Contact-us tier — 0 everywhere because it is never sold through checkout.
  enterprise: { INR: 0, USD: 0, AED: 0, SAR: 0, SGD: 0, MYR: 0, IDR: 0, BRL: 0, MXN: 0, GBP: 0 },
  // ---- legacy, never sold; prices retained so revenue reporting is stable ----
  free: { INR: 0, USD: 0, AED: 0, SAR: 0, SGD: 0, MYR: 0, IDR: 0, BRL: 0, MXN: 0, GBP: 0 },
  front_desk: {
    INR: 14_999, USD: 179, AED: 659, SAR: 679, SGD: 599, MYR: 1_199,
    IDR: 2_999_000, BRL: 899, MXN: 3_499, GBP: 149,
  },
};

/** Major-unit monthly price in the given currency. */
export function planPrice(plan: Plan, currency: Currency): number {
  return PLAN_PRICES[plan.id][currency];
}

export const PLANS: Plan[] = [
  {
    id: "entry",
    name: "Entry",
    tagline: "A chatbot that knows your business. It answers, it doesn't act.",
    features: [
      "AI chatbot trained on your business",
      "Answers customer questions around the clock",
      "Marketing message templates",
      "No bookings, payments or follow-ups",
    ],
    limits: {
      // Provisional. The founder record leaves these undecided.
      contacts: 1_000,
      teamMembers: 2,
      automations: 2,
      messagesPerMonth: 2_000,
      whatsappNumbers: 1,
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
    tagline: "The whole workspace, with the AI answering every message.",
    features: [
      "Everything in Entry",
      "AI replies to every customer, 24/7",
      "Captures and qualifies leads on its own",
      "Shared team inbox with AI reply drafts",
      "Contacts, tags, segments and notes",
      "Broadcast campaigns with AI-written copy",
      "Conversation summaries",
      "WhatsApp button for your website",
      "1 WhatsApp number · 3 team seats",
    ],
    limits: {
      contacts: 5_000,
      teamMembers: 3,
      automations: null,
      messagesPerMonth: 5_000,
      whatsappNumbers: 1,
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
    tagline: "It books, collects and chases — not just replies.",
    features: [
      "Everything in Starter",
      "Books into your real Google Calendar",
      "Sends payment links in chat",
      "Chases quiet leads, no-shows and reminders",
      "Lead scoring and churn risk",
      "CRM sync to Zoho or Salesforce",
      "Developer API and webhooks",
      "Staff access limited by number",
      "2 WhatsApp numbers · 10 team seats",
    ],
    limits: {
      contacts: 25_000,
      teamMembers: 10,
      automations: null,
      messagesPerMonth: 30_000,
      whatsappNumbers: 2,
      aiFrontDesk: true,
      publicApi: true,
      customActions: false,
      byoLlm: false,
      multiNumber: true,
      webWidget: true,
      leadScoring: true,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    },
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "It picks up the phone too.",
    features: [
      "Everything in Growth",
      "Voice front desk — the AI answers calls",
      "100 call minutes a month",
      "Custom actions into your own systems",
      "Bring your own AI provider key",
      "Unlimited contacts and campaign messages",
      "5 WhatsApp numbers · 25 team seats",
    ],
    limits: {
      contacts: null,
      teamMembers: 25,
      automations: null,
      messagesPerMonth: null,
      whatsappNumbers: 5,
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
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Agreed capacity and service, scoped with you.",
    features: [
      "Everything in Pro",
      "Capacity agreed to your volume",
      "Numbers and seats to your requirement",
      "Voice minutes to your requirement",
      "Named support contact",
    ],
    limits: {
      contacts: null,
      teamMembers: null,
      automations: null,
      messagesPerMonth: null,
      whatsappNumbers: null,
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

  // ------------------------------------------------------------------
  // Legacy. Not sold, hidden from the grid, refused by checkout. Kept so
  // workspaces already on them resolve and keep what they were given.
  // ------------------------------------------------------------------
  {
    id: "free",
    name: "Free",
    tagline: "Retired. Also where an expired trial rests.",
    features: ["Read and export your history", "Manual replies stay available"],
    limits: {
      contacts: 250,
      teamMembers: 2,
      automations: 2,
      messagesPerMonth: 500,
      whatsappNumbers: 1,
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
    legacy: true,
  },
  {
    id: "front_desk",
    name: "AI Front Desk (legacy)",
    tagline: "Retired flagship. Existing workspaces keep everything.",
    features: ["Everything in Pro, with no seat or number cap"],
    limits: {
      contacts: null,
      teamMembers: null,
      automations: null,
      messagesPerMonth: null,
      whatsappNumbers: null,
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
    legacy: true,
  },
];

/** The tiers sold through the self-serve billing grid. */
export function selfServePlans(): Plan[] {
  return PLANS.filter((p) => !p.contactOnly && !p.legacy);
}

/** Everything shown on the public pricing page, Enterprise included. */
export function publicPlans(): Plan[] {
  return PLANS.filter((p) => !p.legacy);
}

const FALLBACK_PLAN: Plan = PLANS.find((p) => p.id === "free")!;

export function getPlan(id: string): Plan {
  // "scale" was Pro's pre-launch id; map it forward for any stored value.
  if (id === "scale") id = "pro";
  return PLANS.find((p) => p.id === id) ?? FALLBACK_PLAN;
}

/**
 * Alert threshold (PLAN.md WS2): flag an org when its monthly AI cost
 * exceeds this percentage of its plan price. Per-org override lives in
 * Org.settings.aiCostAlertPct.
 */
export const PLAN_COST_ALERT_PCT = 35;
