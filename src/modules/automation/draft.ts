import { z } from "zod";
import {
  AUTOMATION_TRIGGERS,
  LEAD_STAGES,
  STEP_KINDS,
  STEP_LABELS,
  parseKeywordConfig,
  type StepKind,
} from "@/modules/automation/definitions";

/**
 * Builder → server payload validation (spec §M6). Pure (zod only) so the
 * per-kind config rules are unit-testable without a database; org-scoped
 * referential checks (template/tag/member existence) live in the action.
 */

const jsonObject = z.record(z.string(), z.unknown());

const draftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the automation a name.")
    .max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(300, "Keep the description short.").default(""),
  enabled: z.boolean().default(false),
  trigger: z.enum(AUTOMATION_TRIGGERS),
  triggerConfig: jsonObject.default({}),
  steps: z
    .array(z.object({ kind: z.enum(STEP_KINDS), config: jsonObject.default({}) }))
    .min(1, "Add at least one step.")
    .max(20, "An automation can have at most 20 steps."),
});

export type AutomationDraft = z.infer<typeof draftSchema>;

/**
 * Is a step's config complete enough to save? Returns a human-readable
 * problem (sentence fragment) or null when valid. Pure + unit-tested.
 */
export function validateStepConfig(
  kind: StepKind,
  config: Record<string, unknown>
): string | null {
  switch (kind) {
    case "send_message":
      // `body` is the legacy seeded key; the engine reads text ?? body.
      return String(config.text ?? config.body ?? "").trim()
        ? null
        : "add the message text.";
    case "send_template":
      return typeof config.templateId === "string" && config.templateId
        ? null
        : "pick an approved template.";
    case "add_tag":
      return typeof config.tagId === "string" && config.tagId
        ? null
        : "pick a tag.";
    case "assign_agent":
      return typeof config.userId === "string" && config.userId
        ? null
        : "pick a teammate.";
    case "update_lead_stage":
      return (LEAD_STAGES as readonly string[]).includes(String(config.stage))
        ? null
        : "pick a lead stage.";
    case "wait": {
      const minutes = Number(config.minutes);
      return Number.isFinite(minutes) && minutes >= 1
        ? null
        : "set how many minutes to wait (at least 1).";
    }
    // No config needed.
    case "resolve_conversation":
    case "handoff_to_human":
      return null;
  }
}

export type DraftParseResult =
  | { ok: true; draft: AutomationDraft }
  | { ok: false; error: string };

/**
 * Parse + validate a full builder payload: shape, ≥1 step, keyword trigger
 * needs keywords, every step config complete. Normalizes keyword configs to
 * exactly { keywords, match }.
 */
export function parseAutomationDraft(input: unknown): DraftParseResult {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That automation isn't valid.",
    };
  }
  const draft = parsed.data;

  if (draft.trigger === "keyword") {
    const keywordConfig = parseKeywordConfig(draft.triggerConfig);
    if (keywordConfig.keywords.length === 0) {
      return { ok: false, error: "Add at least one keyword for the keyword trigger." };
    }
    draft.triggerConfig = {
      keywords: keywordConfig.keywords,
      match: keywordConfig.match,
    };
  }

  for (let i = 0; i < draft.steps.length; i++) {
    const step = draft.steps[i];
    const problem = validateStepConfig(step.kind, step.config);
    if (problem) {
      return {
        ok: false,
        error: `Step ${i + 1} (${STEP_LABELS[step.kind]}): ${problem}`,
      };
    }
  }

  return { ok: true, draft };
}
