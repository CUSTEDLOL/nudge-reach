import { MAX_WAIT_MINUTES, type AutomationTrigger } from "@/modules/automation/definitions";
import { repairOptOutFooter } from "@/modules/campaign/guardrails";
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

export type CompiledStep =
  | { kind: "wait"; config: { minutes: number } }
  | { kind: "send_template"; config: { templateName: string } };

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

/** Like `slugifyTemplateName` (whatsapp/template.ts) but capped at 40 so a
 *  key and index still fit after it; the empty-slug fallback is the caller's. */
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

/**
 * Template names are deterministic for a spec, and per-automation when `key`
 * is given (`fu_<slug>_<key>_<n>`; the installer passes the automation id's
 * last 8 chars) so two follow-ups with the same name never share templates.
 * `templateNames` pins a name per index and wins over the derived one; an
 * empty pin falls through.
 */
export function compileFollowUp(
  spec: FollowUpSpec,
  opts: { templateNames?: string[]; key?: string } = {}
): CompiledFollowUp {
  const slug = slugify(spec.name) || "follow_up";
  const keySlug = opts.key ? slugify(opts.key) : "";
  const templates: CompiledTemplate[] = [];
  const steps: CompiledStep[] = [];

  spec.messages.forEach((m, i) => {
    const derived = keySlug ? `fu_${slug}_${keySlug}_${i + 1}` : `fu_${slug}_${i + 1}`;
    const name = opts.templateNames?.[i] || derived;
    templates.push({
      name,
      category: m.category,
      content: {
        productName: spec.messages.length > 1 ? `${spec.name} — message ${i + 1}` : spec.name,
        campaignAngle: "Follow-up.",
        header: m.header,
        body: m.body,
        // buildTemplatePayload always emits a FOOTER component, so it must be non-empty.
        footer: m.category === "MARKETING" ? repairOptOutFooter(m.footer) : m.footer || "See you soon",
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
