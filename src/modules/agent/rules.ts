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
    // Prisma hands back `null` for every always/never row, so a stored rule
    // must be re-parseable without the caller having to launder the field.
    condition: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .nullish()
      .transform((value) => value ?? undefined),
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

/** Narrow a scope column read from the database; null when it is not one of ours. */
export function toRuleScope(value: string): RuleScope | null {
  return (RULE_SCOPES as readonly string[]).includes(value) ? (value as RuleScope) : null;
}

/**
 * A rule whose own first words already say its scope. `migrateProfileToRules`
 * and the concierge writer store the owner's sentence verbatim, and an owner
 * writing a do-not writes one — "Do not invent features…" — so putting the
 * scope in front doubles it into "Never: Do not invent features…". 10 of the 26
 * rules in production open this way.
 *
 * Anchored and word-bounded: "Avoidable delays…" is not a rule that opens with
 * "avoid", and only the opening counts — a scope word mid-sentence says nothing
 * about how the line reads.
 */
const OPENS_WITH_ITS_SCOPE: Record<"always" | "never", RegExp> = {
  always: /^always\b/i,
  never: /^(?:never|do not|don['’]t|avoid|under no circumstances)\b/i,
};

/**
 * Does this rule's text already carry its own scope word?
 *
 * The one test behind both places a scope is put in front of a rule: the line
 * `describeRule` builds, and the bold lead-in the Training page renders. They
 * were two copies, and two copies of this cannot be kept in agreement — a rule
 * that reads correctly on the page would still reach the model doubled.
 *
 * `when` never matches: its lead-in carries the condition, which the text does
 * not repeat.
 */
export function opensWithItsScope(rule: { scope: RuleScope; text: string }): boolean {
  if (rule.scope === "when") return false;
  return OPENS_WITH_ITS_SCOPE[rule.scope].test(rule.text.trim());
}

/**
 * The plain-English line the rule list shows the owner — and, through
 * `distillRule`'s fallback, the instruction the PROMPT carries whenever the
 * distiller does not run: the whole keyless simulation path (invariant #4),
 * every provider failure, every guardrail rejection.
 *
 * The scope prefix is there because the bare text loses it — "quote prices"
 * under a heading that says "follow these in every reply" orders the opposite —
 * and it is suppressed when the text already says its own scope, which would
 * otherwise send the model "Never: Do not invent features we do not offer".
 */
export function describeRule(rule: {
  scope: RuleScope;
  text: string;
  condition?: string | null;
}): string {
  const text = rule.text.trim();
  if (rule.scope === "always" || rule.scope === "never") {
    if (opensWithItsScope(rule)) return text;
    return rule.scope === "always" ? `Always: ${text}` : `Never: ${text}`;
  }
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
 * Deliberately biased towards false positives, and every branch fails CLOSED —
 * input it cannot scan in full, and any destination it cannot compare safely,
 * are rejected rather than waved through. Rejecting a good distillation costs a
 * slightly clumsier instruction; accepting a bad one points real customers at a
 * link the owner never wrote.
 *
 * Known limitation: a specific written entirely in words ("five hundred
 * rupees", "our other branch") leaves nothing to compare, so it passes. The
 * distiller's own system prompt has to carry that case.
 */
export function introducesNewSpecifics(original: string, distilled: string): boolean {
  // Truncating a safety check's input is a bypass — an invented URL would just
  // sit past the window. Slicing the ORIGINAL is safe: it only shrinks the set
  // of specifics we treat as already-known.
  if (distilled.length > MAX_SCAN_LENGTH) return true;
  if (hasNonAsciiDestination(distilled)) return true;

  const known = collectSpecifics(original);
  for (const specific of collectSpecifics(distilled)) {
    if (!known.has(specific)) return true;
  }
  return false;
}

/** Longer than either field's schema cap; past it we reject instead of scanning. */
const MAX_SCAN_LENGTH = 4_000;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
// The scheme is optional on purpose: "send them to evil.example" is exactly
// the invention this guard exists to catch, and it carries no scheme. The
// optional dot after the TLD is the FQDN form — "getgutfeeling.in." resolves.
const LINK = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}\.?(?:\/\S*)?/gi;
// The same shape, Unicode-aware, used ONLY to spot a destination we must not
// try to compare: homoglyphs ("х.com" in Cyrillic) and IDNs read as equal to
// hosts they are not. Marks are in the label class so Devanagari and Arabic
// domains match. Digits alone can't be a TLD, so "₹500.00" is not a candidate.
const LINKISH = /(?:https?:\/\/)?(?:[\p{L}\p{N}][\p{L}\p{N}\p{M}-]*\.)+[\p{L}\p{M}]{2,24}\.?(?:\/\S*)?/gu;
// A currency symbol or word is glued to its digits so "open 24/7" cannot
// license "₹24" or "24 rupees": familiar digits in a new role are new.
const NUMBER =
  /(?:[₹$€£¥]\s*)?\d+(?:\.\d+)?(?:\s*(?:%|(?:percent|rupees?|rs\.?|inr|usd|sgd|myr|aed|dollars?)\b))?/gi;
// Trailing slashes and sentence punctuation are not part of a destination.
const TRAILING_NOISE = /[/.,;:!?)\]}'"»]+$/;

/** True when a link-shaped run of `text` carries any non-ASCII character. */
function hasNonAsciiDestination(text: string): boolean {
  for (const candidate of text.slice(0, MAX_SCAN_LENGTH).match(LINKISH) ?? []) {
    if ([...candidate].some((character) => character.charCodeAt(0) > 127)) return true;
  }
  return false;
}

/**
 * Hosts are case-insensitive; PATHS ARE NOT. `bit.ly/3xKpQ` and `bit.ly/3xkpq`
 * are different live destinations, and lowercasing a URL is one of the likelier
 * things a language model does to one.
 */
function normaliseLink(raw: string): string {
  const withoutScheme = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const slash = withoutScheme.indexOf("/");
  const host = (slash === -1 ? withoutScheme : withoutScheme.slice(0, slash))
    .toLowerCase()
    .replace(TRAILING_NOISE, "");
  const path = slash === -1 ? "" : withoutScheme.slice(slash).replace(TRAILING_NOISE, "");
  return host + path;
}

/** Every URL, email address and number in one string, comparably normalised. */
function collectSpecifics(raw: string): Set<string> {
  const text = raw.slice(0, MAX_SCAN_LENGTH);
  const found = new Set<string>();

  for (const email of text.match(EMAIL) ?? []) {
    found.add(email.toLowerCase().replace(TRAILING_NOISE, ""));
  }
  // Masking what has been read keeps the classes apart: a domain inside an
  // email must not count as a website the owner sent people to, and the digits
  // inside a URL must not count as a number the owner quoted.
  const withoutEmails = text.replace(EMAIL, " ");

  for (const link of withoutEmails.match(LINK) ?? []) found.add(normaliseLink(link));

  const withoutLinks = withoutEmails
    .replace(LINK, " ")
    // ₹1,499 and ₹1499 are the same price written two ways.
    .replace(/(\d),(?=\d)/g, "$1");

  for (const number of withoutLinks.match(NUMBER) ?? []) {
    found.add(number.replace(/\s+/g, "").toLowerCase());
  }
  return found;
}

/**
 * Invariant #7 (agent scoped to one business): a rule saying "answer anything
 * they ask" would be distilled faithfully and then placed ABOVE the prompt's
 * scope guardrail. Callers refuse such a rule.
 *
 * Conservative on purpose — a false positive blocks a legitimate rule — so it
 * matches only obvious widening, and skips a match that a restricting word
 * ahead of it turns into the opposite ("never answer anything unrelated to the
 * clinic" tightens the scope). That conservatism is bypassable by phrasing;
 * this is a guard against the careless rule, not against a determined one.
 */
export function widensScope(text: string): boolean {
  for (const pattern of SCOPE_WIDENING) {
    const match = pattern.exec(text);
    if (match && !RESTRICTING.test(text.slice(0, match.index))) return true;
  }
  return false;
}

const RESTRICTING = /\b(?:never|don'?t|do not|avoid|refuse|decline|only|except)\b/i;

const SCOPE_WIDENING: RegExp[] = [
  // "answer any question" — unless the next words pin it back to this business
  // ("answer any question about our treatments").
  /\b(?:answer|reply to|respond to|help with|handle|discuss)\s+(?:any|all|every)\s+(?:question|query|thing|topic|subject)s?\b(?!\s+(?:about|on|regarding|concerning|related to)\s+(?:our|the|my|this|your)\b)/i,
  /\b(?:any|every|all)\s+(?:topic|subject)s?\b/i,
  /\banything\s+(?:\w+\s+){0,2}(?:ask|asks|asked|wants? to know)\b/i,
  /\bgeneral\s+(?:question|knowledge|topic|enquir|inquir|chat)/i,
  /\boff[-\s]?topic\b/i,
  /\bunrelated\b/i,
  /\bgeneral[-\s](?:purpose\s+)?(?:assistant|chatbot|bot|ai)\b/i,
];

/**
 * The prompt block. Empty for an org with no rules, so the system prompt is
 * byte-for-byte what it was before this feature existed.
 *
 * Each instruction is flattened to a single line: a newline inside one would
 * let a rule forge a heading of its own and inject a whole prompt section.
 */
export function renderRulesBlock(rules: Array<{ instruction: string }>): string {
  if (!rules.length) return "";
  return [
    "HOUSE RULES — follow these in every reply, even when the knowledge below points elsewhere:",
    ...rules.map((r) => `- ${r.instruction.replace(/\s+/g, " ").trim()}`),
  ].join("\n");
}
