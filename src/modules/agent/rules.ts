import { z } from "zod";

/**
 * House rules: how the AI should BEHAVE, as opposed to what is true
 * (KnowledgeEntry). Rules outrank facts in the prompt — see
 * docs/plans/2026-09-22-house-rules-design.md.
 *
 * Pure (zod + string helpers only, no db/env) so the authoring UI, the server
 * actions and the prompt builder all share one vocabulary.
 */

export const RULE_SCOPES = ["always", "never", "when"] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

/** The distilled line rides in every reply, so it stays short. */
export const MAX_INSTRUCTION_LENGTH = 200;
/** The owner's own sentence is only ever shown in the UI, so it can breathe. */
export const MAX_RULE_TEXT_LENGTH = 500;
/**
 * Active rules per org. Rules ride in the cached part of the system prompt, so
 * the cap is about answer quality, not cost: past a handful of competing
 * instructions a model starts silently dropping some.
 */
export const MAX_ACTIVE_RULES = { trial: 5, full: 20 } as const;
/** Where the UI starts warning that more rules means less reliable obedience. */
export const RULE_QUALITY_NUDGE_AT = 10;

export const ruleSchema = z
  .object({
    /** The owner's own sentence — this is what the UI shows. */
    text: z.string().trim().min(1).max(MAX_RULE_TEXT_LENGTH),
    /** The distilled line the prompt carries. Never surfaced to the owner. */
    instruction: z.string().trim().min(1).max(MAX_INSTRUCTION_LENGTH),
    scope: z.enum(RULE_SCOPES),
    condition: z.string().trim().min(2).max(120).optional(),
  })
  .refine((rule) => (rule.scope === "when") === (rule.condition !== undefined), {
    message: 'A "when" rule needs a condition, and the other scopes take none.',
    path: ["condition"],
  });

export type RuleDraft = z.infer<typeof ruleSchema>;

/** A stored rule as the list renders it (Prisma hands back `condition: null`). */
export interface RuleListItem {
  id: string;
  text: string;
  scope: RuleScope;
  condition?: string | null;
}

/** The plain-English line the rule list shows the owner. */
export function describeRule(rule: {
  scope: RuleScope;
  text: string;
  condition?: string | null;
}): string {
  const text = rule.text.trim();
  if (rule.scope === "always") return `Always: ${text}`;
  if (rule.scope === "never") return `Never: ${text}`;
  const condition = rule.condition?.trim();
  // A "when" rule with no condition can only come from a bad migration.
  // Stating it plainly is honest; "Always:" would claim a scope it lacks.
  return condition ? `When ${condition}: ${text}` : text;
}

/**
 * The distiller guardrail.
 *
 * An owner's rule is rewritten by the AI and stored WITHOUT the owner ever
 * seeing the rewrite, so the rewrite may rephrase but never introduce: if the
 * distilled line carries a URL, email address or number the original did not,
 * it is rejected and the owner's own words are stored instead.
 *
 * Deliberately biased towards false positives. Rejecting a good distillation
 * costs a slightly clumsier instruction; accepting a bad one points real
 * customers at a link the owner never wrote.
 */
export function introducesNewSpecifics(original: string, distilled: string): boolean {
  const known = collectSpecifics(original);
  for (const specific of collectSpecifics(distilled)) {
    if (!known.has(specific)) return true;
  }
  return false;
}

/**
 * Both sides are schema-capped far below this; the slice exists only so a
 * pathological string can never make the scan slow.
 */
const MAX_SCAN_LENGTH = 4_000;

// Text is lowercased before matching, so none of these need the `i` flag.
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
// The scheme is optional on purpose: "send them to evil.example" is exactly
// the invention this guard exists to catch, and it carries no scheme.
const LINK = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s]*)?/g;
// A currency symbol is glued to its digits so "open 24/7" cannot license "₹24":
// familiar digits in a new role are still a new specific.
const NUMBER = /(?:[₹$€£¥]\s*)?\d+(?:\.\d+)?/g;
// Trailing slashes and sentence punctuation are not part of a destination.
const TRAILING_NOISE = /[/.,;:!?)\]}'"»]+$/;

/** Every URL, email address and number in one string, comparably normalised. */
function collectSpecifics(raw: string): Set<string> {
  const text = raw.slice(0, MAX_SCAN_LENGTH).toLowerCase();
  const found = new Set<string>();

  for (const email of text.match(EMAIL) ?? []) {
    found.add(email.replace(TRAILING_NOISE, ""));
  }
  // Masking what has been read keeps the classes apart: a domain inside an
  // email must not count as a website the owner sent people to, and the digits
  // inside a URL must not count as a number the owner quoted.
  const withoutEmails = text.replace(EMAIL, " ");

  for (const link of withoutEmails.match(LINK) ?? []) {
    found.add(
      link
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(TRAILING_NOISE, "")
    );
  }
  const withoutLinks = withoutEmails
    .replace(LINK, " ")
    // ₹1,499 and ₹1499 are the same price written two ways.
    .replace(/(\d),(?=\d)/g, "$1");

  for (const number of withoutLinks.match(NUMBER) ?? []) {
    found.add(number.replace(/\s+/g, ""));
  }
  return found;
}

/**
 * The prompt block. Empty for an org with no rules, so the system prompt is
 * byte-for-byte what it was before this feature existed.
 */
export function renderRulesBlock(rules: Array<{ instruction: string }>): string {
  if (!rules.length) return "";
  return [
    "HOUSE RULES — follow these in every reply, even when the knowledge below points elsewhere:",
    ...rules.map((r) => `- ${r.instruction}`),
  ].join("\n");
}
