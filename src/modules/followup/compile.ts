import { MAX_WAIT_MINUTES, type AutomationTrigger } from "@/modules/automation/definitions";
import type { CampaignContent } from "@/modules/campaign/schema";
import type { FollowUpSpec } from "@/modules/followup/spec";

/**
 * Spec → the pieces the automation engine already runs. Pure and total: the
 * only step kinds it can emit are `wait` and `send_template`, so a follow-up
 * can never send free-form text outside the 24-hour window (invariant #6) —
 * the guarantee is in the type of this function, not in a review.
 */

const MINUTES_PER_DAY = 24 * 60;
/** One wait step per chunk, sized by the engine's clamp so a longer gap is
 *  chained rather than silently truncated. */
const MAX_WAIT_DAYS = MAX_WAIT_MINUTES / MINUTES_PER_DAY;

export interface CompiledStep {
  kind: "wait" | "send_template";
  config: Record<string, unknown>;
}

export interface CompiledTemplate {
  name: string;
  category: "MARKETING" | "UTILITY";
  content: CampaignContent;
}

export interface CompiledFollowUp {
  trigger: AutomationTrigger;
  triggerConfig: Record<string, unknown>;
  templates: CompiledTemplate[];
  /** send_template steps carry `templateName`; the installer swaps in the id. */
  steps: CompiledStep[];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function waitChunksMinutes(days: number): number[] {
  const out: number[] = [];
  let remaining = days;
  while (remaining > 0) {
    const chunk = Math.min(remaining, MAX_WAIT_DAYS);
    out.push(chunk * MINUTES_PER_DAY);
    remaining -= chunk;
  }
  return out;
}

function triggerFor(situation: FollowUpSpec["situation"]): Pick<CompiledFollowUp, "trigger" | "triggerConfig"> {
  switch (situation.kind) {
    case "went_quiet":
      return {
        trigger: "conversation_quiet",
        triggerConfig: { hours: situation.afterDays * 24, ...(situation.stage ? { stage: situation.stage } : {}) },
      };
    case "booked":
      return { trigger: "booking_created", triggerConfig: {} };
    case "campaign_reply":
      return { trigger: "campaign_reply", triggerConfig: {} };
    case "keyword":
      return { trigger: "keyword", triggerConfig: { keywords: situation.keywords, match: "contains" } };
    case "new_lead":
      return { trigger: "contact_created", triggerConfig: {} };
  }
}

export function compileFollowUp(
  spec: FollowUpSpec,
  opts: { templateNames?: string[] } = {}
): CompiledFollowUp {
  const slug = slugify(spec.name) || "follow_up";
  const templates: CompiledTemplate[] = [];
  const steps: CompiledStep[] = [];

  spec.messages.forEach((m, i) => {
    const name = opts.templateNames?.[i] ?? `fu_${slug}_${i + 1}`;
    templates.push({
      name,
      category: m.category,
      content: {
        productName: spec.name.slice(0, 120),
        campaignAngle: "Follow-up.",
        header: m.header,
        body: m.body,
        // campaignContentSchema requires a non-empty footer.
        footer: m.footer || (m.category === "MARKETING" ? "Reply STOP to unsubscribe" : "See you soon"),
        buttons: m.buttons,
        sampleName: "Priya",
        imageTreatment: "",
        notes: "Created from a follow-up.",
      },
    });
    for (const minutes of waitChunksMinutes(m.afterDays)) steps.push({ kind: "wait", config: { minutes } });
    steps.push({ kind: "send_template", config: { templateName: name } });
  });

  return { ...triggerFor(spec.situation), templates, steps };
}
