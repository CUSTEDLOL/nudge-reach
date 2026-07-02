/**
 * Automation vocabulary + pure helpers (spec §M6). ZERO server imports — this
 * module is shared by the engine (server), the builder UI (client) and the
 * unit tests, so it must stay free of Prisma/env/messaging dependencies.
 */

export const AUTOMATION_TRIGGERS = [
  "message_received",
  "keyword",
  "contact_created",
  "tag_added",
  "campaign_reply",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const STEP_KINDS = [
  "send_message",
  "send_template",
  "add_tag",
  "assign_agent",
  "update_lead_stage",
  "wait",
  "resolve_conversation",
  "handoff_to_human",
] as const;

export type StepKind = (typeof STEP_KINDS)[number];

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "WON",
  "LOST",
] as const;

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  message_received: "Message received",
  keyword: "Keyword",
  contact_created: "Contact created",
  tag_added: "Tag added",
  campaign_reply: "Campaign reply",
};

export const STEP_LABELS: Record<StepKind, string> = {
  send_message: "Send message",
  send_template: "Send template",
  add_tag: "Add tag",
  assign_agent: "Assign teammate",
  update_lead_stage: "Update lead stage",
  wait: "Wait",
  resolve_conversation: "Resolve conversation",
  handoff_to_human: "Hand off to human",
};

/** At most this many automations run for a single trigger event. */
export const MAX_AUTOMATIONS_PER_EVENT = 3;

/** Wait steps are clamped to a week so a typo can't park a run for a year. */
export const MAX_WAIT_MINUTES = 7 * 24 * 60;

// ---------------------------------------------------------------------------
// Keyword matching (pure, unit-tested)
// ---------------------------------------------------------------------------

export interface KeywordConfig {
  keywords: string[];
  match: "contains" | "exact";
}

/** Coerce an untyped triggerConfig JSON blob into a safe KeywordConfig. */
export function parseKeywordConfig(raw: unknown): KeywordConfig {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords.filter(
        (k): k is string => typeof k === "string" && k.trim().length > 0
      )
    : [];
  return { keywords, match: obj.match === "exact" ? "exact" : "contains" };
}

/**
 * Case-insensitive keyword match. "contains" = any keyword appears anywhere
 * in the text; "exact" = the whole (trimmed) text equals a keyword.
 */
export function matchesKeyword(text: string, config: unknown): boolean {
  const { keywords, match } = parseKeywordConfig(config);
  const haystack = text.trim().toLowerCase();
  if (!haystack || keywords.length === 0) return false;
  return keywords.some((keyword) => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return false;
    return match === "exact" ? haystack === needle : haystack.includes(needle);
  });
}

// ---------------------------------------------------------------------------
// Event matching (pure)
// ---------------------------------------------------------------------------

export interface MatchContext {
  /** Inbound message text — required for keyword triggers to match. */
  text?: string;
  /** Tag name that was just added — for tag_added triggers. */
  tagName?: string;
}

/**
 * Does an automation's trigger + config accept this event? Keyword triggers
 * match on text; tag_added triggers scoped to a tagName (seeded config) only
 * fire for that tag, while an empty config fires for any tag.
 */
export function automationMatchesEvent(
  automation: { trigger: string; triggerConfig: unknown },
  trigger: AutomationTrigger,
  ctx: MatchContext = {}
): boolean {
  if (automation.trigger !== trigger) return false;
  if (trigger === "keyword") {
    return matchesKeyword(ctx.text ?? "", automation.triggerConfig);
  }
  if (trigger === "tag_added") {
    const config =
      automation.triggerConfig && typeof automation.triggerConfig === "object"
        ? (automation.triggerConfig as Record<string, unknown>)
        : {};
    const wanted =
      typeof config.tagName === "string" ? config.tagName.trim().toLowerCase() : "";
    if (!wanted) return true; // no tag configured → fires for any tag
    return (ctx.tagName ?? "").trim().toLowerCase() === wanted;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Run log entries (pure, unit-tested)
// ---------------------------------------------------------------------------

/** The shape the engine appends to AutomationRun.log for every step. */
export interface RunLogEntry {
  step: number;
  kind: string;
  ok: boolean;
  detail: string;
  at: string; // ISO timestamp
}

/**
 * Coerce a raw AutomationRun.log JSON value into typed entries. Accepts both
 * the engine shape ({ ok: boolean }) and the seeded demo shape
 * ({ status: "ok" | "error" }) so the runs UI renders either.
 */
export function normalizeLogEntries(raw: unknown): RunLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const obj =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    return {
      step: typeof obj.step === "number" ? obj.step : index + 1,
      kind: typeof obj.kind === "string" ? obj.kind : "unknown",
      ok: typeof obj.ok === "boolean" ? obj.ok : obj.status === "ok",
      detail: typeof obj.detail === "string" ? obj.detail : "",
      at: typeof obj.at === "string" ? obj.at : "",
    };
  });
}

/** Wait-step config → sane minutes: default 1, rounded, clamped to a week. */
export function readWaitMinutes(raw: unknown): number {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const minutes = Number(obj.minutes);
  if (!Number.isFinite(minutes) || minutes < 1) return 1;
  return Math.min(Math.round(minutes), MAX_WAIT_MINUTES);
}
