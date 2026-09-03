import type { CampaignContent } from "@/modules/campaign/schema";

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

export const OPT_OUT = "Reply STOP to unsubscribe";

/** Shared factory for pack templates (Revenue-Recovery + Vertical Packs). */
export function makePackTemplate(
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
  makePackTemplate(
    "appt_reminder_24h",
    "UTILITY",
    "Appointment reminder",
    "Hi {{1}}, a friendly reminder about your appointment with us tomorrow. Looking forward to seeing you! Need to change it? Just reply here.",
    "See you soon"
  ),
  makePackTemplate(
    "appt_reminder_2h",
    "UTILITY",
    "Coming up soon",
    "Hi {{1}}, your appointment is coming up in a couple of hours. See you shortly! Running late or need to reschedule? Reply here.",
    "See you soon"
  ),
  makePackTemplate(
    "no_show_rebook",
    "MARKETING",
    "We missed you",
    "Hi {{1}}, we missed you today — no worries at all! Reply here and we'll find you a new slot that works.",
    OPT_OUT,
    [{ type: "QUICK_REPLY", text: "Rebook me" }]
  ),
  makePackTemplate(
    "review_ask",
    "MARKETING",
    "How did we do?",
    "Hi {{1}}, thank you for coming in! We'd love to hear how it went — just reply with a quick word, it really helps us.",
    OPT_OUT,
    [{ type: "QUICK_REPLY", text: "Leave feedback" }]
  ),
  makePackTemplate(
    "lead_nudge_1",
    "MARKETING",
    "Still thinking it over?",
    "Hi {{1}}, still thinking it over? We'd love to help — reply here with any questions and we'll get you sorted right away.",
    OPT_OUT
  ),
  makePackTemplate(
    "lead_nudge_2",
    "MARKETING",
    "One message away",
    "Hi {{1}}, one last note from us — if now isn't the right time, no problem at all. Whenever you're ready, we're just a message away.",
    OPT_OUT
  ),
];

/**
 * The lead-quiet nudge, composed from automation primitives: someone who
 * replied to a campaign (showed intent) then went quiet gets exactly two
 * template nudges, three days apart, then stops (encoded structurally — the
 * engine has no per-contact lifetime cap). Reminders/no-show/review are
 * time-absolute and handled by the reminder tick, not the event engine.
 */
export interface PackAutomation {
  key: string;
  name: string;
  description: string;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  steps: Array<{ kind: string; config: Record<string, unknown> }>;
}

const THREE_DAYS_MIN = 3 * 24 * 60;

export function leadNudgeAutomation(
  nudge1TemplateId: string,
  nudge2TemplateId: string
): PackAutomation {
  return {
    key: "lead_quiet_nudge",
    name: "Revenue Recovery — quiet-lead nudge",
    description:
      "A lead who replied to a campaign then went quiet gets two gentle template nudges (3 days apart), then we stop.",
    trigger: "campaign_reply",
    triggerConfig: {},
    steps: [
      { kind: "wait", config: { minutes: THREE_DAYS_MIN } },
      { kind: "send_template", config: { templateId: nudge1TemplateId } },
      { kind: "wait", config: { minutes: THREE_DAYS_MIN } },
      { kind: "send_template", config: { templateId: nudge2TemplateId } },
    ],
  };
}
