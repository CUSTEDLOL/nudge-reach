import type { QItem } from "@/modules/knowledge/questionnaire";
import type { PackTemplate } from "@/modules/followup/pack";

/**
 * Vertical Pack framework (PLAN.md WS3). A pack is versioned DATA — pure,
 * serializable, no prisma/React/engine imports — consumed by the agent
 * prompt, the onboarding questionnaire, the template installer, follow-ups,
 * /inbox/try and the eval harness. Adding a vertical = one new pack file +
 * one registry line (enforced by tests/verticals-pack.test.ts).
 */

export const TEMPLATE_KINDS = [
  "booking_confirmation",
  "reminder",
  "ghosted_followup",
  "deadline_nudge",
  "payment_request",
  "no_show_recovery",
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface BookingType {
  key: string;
  label: string;
  minutes: number;
}

export interface SampleConversation {
  title: string;
  /** First turn must be role "customer" (it seeds /inbox/try). */
  turns: { role: "customer" | "ai"; text: string }[];
}

/**
 * Declarative eval checks — compiled onto the harness's combinators by
 * modules/verticals/eval-compile.ts. Data-only so packs stay serializable.
 */
export interface EvalChecks {
  /** Last reply contains at least one (case-insensitive). */
  mustContainAny?: string[];
  mustNotContainAny?: string[];
  noPromptLeak?: boolean;
  noHallucinatedPrice?: boolean;
  expectBooking?: { namePart?: string };
  expectNoBooking?: boolean;
  expectToolCalled?: string;
  expectHandoff?: boolean;
  expectNoHandoff?: boolean;
  expectLeadQualified?: boolean;
  expectLeadNotForced?: boolean;
  notSaidNotDone?: boolean;
}

export interface EvalCase {
  id: string;
  category:
    | "Grounding"
    | "Booking"
    | "Lead"
    | "Scope"
    | "Adversarial"
    | "Multilingual"
    | "Handoff";
  turns: string[];
  checks: EvalChecks;
}

export interface PackFollowUpConfig {
  /**
   * Waits before lead-nudge 1 and 2 (minutes). Booking-reminder cadence is
   * NOT pack-configurable: T-24h/T-2h is fixed by followup/reminders.ts and
   * the BookingRequest reminder stamp columns — a documented simplification.
   */
  leadNudgeWaitsMinutes: [number, number];
  recoveryDefaults: {
    bookingReminders: boolean;
    noShowRebook: boolean;
    postServiceReview: boolean;
    leadNudge: boolean;
  };
}

export interface VerticalPack {
  /** Must be a VERTICALS value (dashboard/verticals.ts). */
  id: string;
  /** Bump on ANY content change — evals cite it. */
  version: number;
  label: string;
  /** Consumed by agentIdentity(): "a {noun}" + WHAT-YOU-HELP-WITH scope. */
  identity: { noun: string; scope: string };
  /** Industry rules block appended to the system prompt (after RULES). */
  promptFragment: string;
  /** Structured onboarding questions (same shape the questionnaire renders). */
  knowledgeSchema: QItem[];
  /** Exactly the six TEMPLATE_KINDS, Meta-review-safe copy. */
  templates: PackTemplate[];
  templateKindByName: Record<string, TemplateKind>;
  followUp: PackFollowUpConfig;
  bookingTypes: BookingType[];
  /** ≥5; first turns seed the /inbox/try starters. */
  sampleConversations: SampleConversation[];
  evalProfile: {
    businessName: string;
    businessInfo: string;
    allowedPrices: number[];
  };
  /** ≥15 cases; the pack's definition of done is ≥90% through the harness. */
  evalCases: EvalCase[];
}
