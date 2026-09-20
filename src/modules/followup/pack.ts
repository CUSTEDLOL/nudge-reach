import type { CampaignContent } from "@/modules/campaign/schema";
import type { FollowUpSpec } from "@/modules/followup/spec";

/**
 * Revenue-Recovery pack — the outbound moat, as DATA (no engine). Each template
 * is a single-{{1}} (first name) body so it rides the existing consent+approval
 * send path unchanged; the timing lives in the copy (a T-24h reminder says
 * "tomorrow"). MARKETING templates are consent-gated at send; the transactional
 * reminders are UTILITY (a customer who just booked expects them).
 */

export interface PackTemplate {
  name: string;
  category: "MARKETING" | "UTILITY";
  content: CampaignContent;
}

const OPT_OUT = "Reply STOP to unsubscribe";

function tpl(
  name: string,
  category: "MARKETING" | "UTILITY",
  header: string,
  body: string,
  footer: string,
  buttons: CampaignContent["buttons"] = []
): PackTemplate {
  return {
    name,
    category,
    content: {
      productName: name,
      campaignAngle: "Revenue-Recovery follow-up.",
      header,
      body,
      footer,
      buttons,
      sampleName: "Priya",
      imageTreatment: "",
      notes: "Installed by the Revenue-Recovery pack.",
    },
  };
}

/** The pack's approved templates. Names are Meta-safe (lowercase + underscores). */
export const PACK_TEMPLATES: PackTemplate[] = [
  tpl(
    "appt_reminder_24h",
    "UTILITY",
    "Appointment reminder",
    "Hi {{1}}, a friendly reminder about your appointment with us tomorrow. Looking forward to seeing you! Need to change it? Just reply here.",
    "See you soon"
  ),
  tpl(
    "appt_reminder_2h",
    "UTILITY",
    "Coming up soon",
    "Hi {{1}}, your appointment is coming up in a couple of hours. See you shortly! Running late or need to reschedule? Reply here.",
    "See you soon"
  ),
  tpl(
    "no_show_rebook",
    "MARKETING",
    "We missed you",
    "Hi {{1}}, we missed you today — no worries at all! Reply here and we'll find you a new slot that works.",
    OPT_OUT,
    [{ type: "QUICK_REPLY", text: "Rebook me" }]
  ),
  tpl(
    "review_ask",
    "MARKETING",
    "How did we do?",
    "Hi {{1}}, thank you for coming in! We'd love to hear how it went — just reply with a quick word, it really helps us.",
    OPT_OUT,
    [{ type: "QUICK_REPLY", text: "Leave feedback" }]
  ),
  tpl(
    "lead_nudge_1",
    "MARKETING",
    "Still thinking it over?",
    "Hi {{1}}, still thinking it over? We'd love to help — reply here with any questions and we'll get you sorted right away.",
    OPT_OUT
  ),
  tpl(
    "lead_nudge_2",
    "MARKETING",
    "One message away",
    "Hi {{1}}, one last note from us — if now isn't the right time, no problem at all. Whenever you're ready, we're just a message away.",
    OPT_OUT
  ),
];

/**
 * The pack's follow-ups as the owner sees them: each row is one FollowUpConfig
 * switch plus the templates whose copy it sends, so the UI can list what runs
 * and link straight to the editable template. Pure data — no server imports.
 */
export const FOLLOW_UP_FLAGS = [
  "bookingReminders",
  "noShowRebook",
  "postServiceReview",
] as const;

export type FollowUpFlag = (typeof FOLLOW_UP_FLAGS)[number];

export const TIMING_FIELDS = [
  "reminder1Hours",
  "reminder2Hours",
  "reviewDelayHours",
] as const;

export type TimingField = (typeof TIMING_FIELDS)[number];

export interface FollowUpTiming {
  reminder1Hours: number;
  reminder2Hours: number;
  reviewDelayHours: number;
}

export const TIMING_DEFAULTS: FollowUpTiming = {
  reminder1Hours: 24,
  reminder2Hours: 2,
  reviewDelayHours: 2,
};

/** An hour figure a small business would plausibly want: at least one, at most
 *  a week out (past that the reminder is noise and the tick window is silly). */
export const MIN_TIMING_HOURS = 1;
export const MAX_TIMING_HOURS = 7 * 24;

export interface FollowUpKind {
  flag: FollowUpFlag;
  label: string;
  /** Shown when the schedule isn't a number the owner can set here. */
  timing: string;
  description: string;
  templateNames: string[];
  timingFields: Array<{ field: TimingField; label: string }>;
}

export const FOLLOW_UP_KINDS: FollowUpKind[] = [
  {
    flag: "bookingReminders",
    label: "Appointment reminders",
    timing: "Before every confirmed booking",
    description:
      "Two nudges before every confirmed booking, so fewer people forget they're coming.",
    templateNames: ["appt_reminder_24h", "appt_reminder_2h"],
    timingFields: [
      { field: "reminder1Hours", label: "First reminder" },
      { field: "reminder2Hours", label: "Second reminder" },
    ],
  },
  {
    flag: "noShowRebook",
    label: "No-show rebooking",
    timing: "As soon as staff mark a no-show",
    description:
      "Chases once to win the slot back. Marketing, so consent still gates it.",
    templateNames: ["no_show_rebook"],
    timingFields: [],
  },
  {
    flag: "postServiceReview",
    label: "Review ask",
    timing: "After the appointment",
    description: "Asks how it went while the visit is still fresh.",
    templateNames: ["review_ask"],
    timingFields: [{ field: "reviewDelayHours", label: "Ask this long after" }],
  },
];

/**
 * Coerce owner input into a schedule the tick can actually run. The early
 * reminder has to stay further out than the late one: the tick reads the gap
 * between them as the first reminder's window, so an inverted pair would mean
 * that reminder silently never sends.
 */
export function normalizeTiming(raw: Partial<FollowUpTiming>): FollowUpTiming {
  const clamp = (value: unknown, fallback: number) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, MIN_TIMING_HOURS), MAX_TIMING_HOURS);
  };
  const reminder2Hours = clamp(raw.reminder2Hours, TIMING_DEFAULTS.reminder2Hours);
  const reminder1Hours = clamp(raw.reminder1Hours, TIMING_DEFAULTS.reminder1Hours);
  return {
    reminder1Hours: Math.max(reminder1Hours, reminder2Hours + 1),
    reminder2Hours,
    reviewDelayHours: clamp(
      raw.reviewDelayHours,
      TIMING_DEFAULTS.reviewDelayHours
    ),
  };
}

export const PACK_LEAD_NUDGE_TEMPLATE_NAMES = ["lead_nudge_1", "lead_nudge_2"];

/** The quiet-lead chase, as a spec: same object an AI draft or the owner's
 *  own follow-up is, so it gets cancel-on-reply and the card UI for free. */
export const PACK_LEAD_NUDGE_SPEC: FollowUpSpec = {
  name: "Quiet-lead nudge",
  situation: { kind: "went_quiet", afterDays: 3 },
  messages: PACK_TEMPLATES.filter((t) => PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name)).map((t, i) => ({
    afterDays: i === 0 ? 0 : 3,
    category: t.category,
    header: t.content.header,
    body: t.content.body,
    footer: t.content.footer,
    buttons: t.content.buttons,
  })),
  stopOn: ["reply", "booking", "payment"],
};
