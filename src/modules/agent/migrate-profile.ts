import { prisma } from "@/lib/db";
import { storeKnowledgeFacts } from "@/modules/knowledge/store";
import type { DistilledFact } from "@/modules/knowledge/distill";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import { TRIAL_KNOWLEDGE_LIMITS } from "@/modules/trial/knowledge";
import {
  MAX_ACTIVE_RULES,
  MAX_INSTRUCTION_LENGTH,
  MAX_RULE_TEXT_LENGTH,
  ruleSchema,
  widensScope,
  type RuleScope,
} from "./rules";

/**
 * One-time migration of the two legacy `AgentProfile` free-text boxes into the
 * vocabulary that replaced them.
 *
 * - `doNots` was already a primitive house rule — every sentence becomes a
 *   `never` rule.
 * - `businessInfo` was labelled "What should the assistant know?" and is a bag:
 *   owners put facts in it, instructions in it, and usually both. The
 *   instruction half is why this project exists — the founder typed "push
 *   everyone to the waitlist" into it and the AI ignored it, because the prompt
 *   reads that box as background knowledge. So each line is classified:
 *   instruction-shaped lines become rules, the rest become knowledge facts in
 *   the existing `draft` (awaiting-review) state.
 *
 * **Neither legacy column is cleared, and both are now dead to the agent.**
 * `buildAgentSystemPrompt` no longer renders `businessInfo` or `doNots` — the
 * reply prompt carries only the rules and facts this migration writes, so a
 * migrated org's text reaches the model exactly once. (Two other builders,
 * `ai/suggest-reply` and `followup/draft`, still read the columns for their own
 * prompts; they are not the agent's reply path.)
 *
 * They stay in the database anyway, indefinitely, because they are the owner's
 * untouched original. The classifier below is a regex and will sometimes file
 * an instruction as a fact or the reverse; this project has no migration
 * rollback, so re-reading the original and redoing that line by hand is the
 * only repair there is. Do not clear these columns, and do not render them.
 *
 * The distiller is deliberately NOT used. These lines are already one sentence
 * long, and a model call per line for every org at migration time would be a
 * slow, metered no-op. The owner's own words are stored as both `text` and
 * `instruction` (the latter trimmed to `MAX_INSTRUCTION_LENGTH`) — exactly what
 * `distillRule` itself falls back to.
 *
 * It applies the two guards that `rules-actions.ts` (until now the only writer
 * of `AgentRule`) enforces, because bypassing them here would be a hole in
 * both: the active-rule cap, and `widensScope` (invariant #7). Nothing is
 * thrown away on the way — a line the guards turn back becomes a draft fact,
 * and a line past the cap becomes an archived rule.
 */

export interface ProfileMigrationResult {
  /**
   * LIVE rules created — `status: "active"` — and only those. Never more than
   * the org's remaining active-rule allowance. Lines written past that
   * allowance are counted in `archived`, not here, so a caller that says "N
   * rules are live" stays true.
   */
  rules: number;
  /**
   * Rules created past the active cap, written as `status: "archived"`. The
   * agent does not follow them; they exist so the line is not lost.
   */
  archived: number;
  /** Draft knowledge facts created. */
  facts: number;
}

const NOTHING: ProfileMigrationResult = { rules: 0, archived: 0, facts: 0 };

/** `factSchema`'s own ceiling; the legacy column keeps the untruncated text. */
const MAX_FACT_LENGTH = 300;
/** A pathological blob must not turn into hundreds of writes. */
const MAX_LINES = 60;

/**
 * The advisory-lock wait below counts against the transaction's own budget, so
 * Prisma's defaults (2 s to get a connection, 5 s for the whole transaction)
 * are too tight for a queue of writers on one org. The same pair
 * `createRuleAction` uses — it queues on the same key.
 */
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

export async function migrateProfileToRules(orgId: string): Promise<ProfileMigrationResult> {
  // "Has this org been migrated?" is a yes/no, and this runs on every cold
  // /agent load. It used to be answered by reading every rule the org ever had,
  // archived included, with no `take` — the whole row set fetched to look at
  // one boolean, for the ~100% of loads whose answer is yes. One indexed row
  // is enough; the full set is loaded below, only on the path that writes.
  //
  // This is a FAST PATH, not the guard: it answers the common case without
  // opening a transaction or taking a lock. The guard is the identical read
  // inside the lock below, which is the only one a concurrent run can trust.
  const migrated = await prisma.agentRule.findFirst({
    where: { orgId, source: { startsWith: "migrated_" } },
    select: { id: true },
  });
  if (migrated) return NOTHING;

  // The owner's untouched legacy boxes and the org's plan. Read outside the
  // lock deliberately: neither can change under us in a way that matters (this
  // never clears the columns), and both would otherwise sit in the critical
  // section that every other writer for this org is queued behind.
  const profile = await prisma.agentProfile.findUnique({
    where: { orgId },
    select: { businessInfo: true, doNots: true },
  });
  if (!profile) return NOTHING;

  const onTrial = await isRestrictedAcquisitionTrial(orgId);
  const limit = onTrial ? MAX_ACTIVE_RULES.trial : MAX_ACTIVE_RULES.full;

  /**
   * Everything that decides what to write, and the write itself, under one
   * per-org advisory lock — the same key and the same shape `createRuleAction`
   * uses, so a migration and an owner's Add button cannot interleave either.
   *
   * This used to be a bare `createMany` after an unprotected read. The
   * `migrated_` guard, the cap arithmetic and the dedupe set were all built
   * from that one read, and nothing serialised it: two first loads of /agent
   * for one org — two tabs, or two lambda instances, since `attempted` below is
   * per-instance — both saw `existing = []`, both planned the identical rows,
   * and both wrote them. Every rule duplicated, `order` colliding from 0, and
   * up to twice the cap live. There is no unique constraint to catch it and
   * `createMany` is not `skipDuplicates`.
   *
   * $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns void and Prisma
   * cannot deserialize a void column. The key is a bound parameter.
   */
  const plan = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`agentrule:${orgId}`}, 0))`;

    // The real guard. The loser of a race reads the winner's committed rows
    // here and writes nothing at all.
    const already = await tx.agentRule.findFirst({
      where: { orgId, source: { startsWith: "migrated_" } },
      select: { id: true },
    });
    if (already) return null;

    // How many active rules the org already has, and where `order` continues.
    const existing = await tx.agentRule.findMany({
      where: { orgId },
      select: { text: true, status: true, order: true },
    });
    const planned = planMigration(orgId, profile, existing, limit);
    if (planned.rules.length) await tx.agentRule.createMany({ data: planned.rules });
    return planned;
  }, TRANSACTION_OPTIONS);
  if (!plan) return NOTHING;

  const stored = plan.facts.length
    ? await storeKnowledgeFacts(orgId, plan.facts, {
        source: "manual",
        status: "draft",
        // The trial's 50-fact ceiling is the same one its imports honour.
        ...(onTrial ? { activeDraftCap: TRIAL_KNOWLEDGE_LIMITS.facts } : {}),
      })
    : { created: 0 };

  const live = plan.rules.filter((rule) => rule.status === "active").length;
  return { rules: live, archived: plan.rules.length - live, facts: stored.created };
}

interface MigrationPlan {
  rules: RuleRow[];
  facts: DistilledFact[];
}

/**
 * Pure: the owner's two legacy boxes, plus the rules the org already has, plus
 * its active-rule limit → exactly the rows to write. No database access, so the
 * caller can run it inside the lock it holds and keep the critical section to
 * two reads and a write.
 */
function planMigration(
  orgId: string,
  profile: { businessInfo: string; doNots: string },
  existing: { text: string; status: string; order: number }[],
  limit: number
): MigrationPlan {
  const active = existing.filter((rule) => rule.status === "active").length;
  let slots = Math.max(0, limit - active);
  let order = existing.reduce((max, rule) => Math.max(max, rule.order), -1) + 1;
  // Per-line dedupe under the `migrated_` guard. It is a belt to the guard's
  // braces — a line the org already carries under another `source` is not
  // written twice — and NOT the thing that makes a concurrent run safe: two
  // runs that both read an empty table both see an empty `seen` set. That is
  // the advisory lock's job, above.
  const seen = new Set(existing.map((rule) => dedupeKey(rule.text)));

  const rules: RuleRow[] = [];
  const facts: DistilledFact[] = [];

  const addFact = (line: string): void => {
    facts.push({ category: "other", fact: line.slice(0, MAX_FACT_LENGTH) });
  };

  const addRule = (line: string, scope: RuleScope, source: RuleSource): void => {
    // Invariant #7: a legacy line can easily read as "answer anything they
    // ask", and a rule sits ABOVE the prompt's scope guardrail. Such a line
    // becomes a draft fact instead of being dropped — the owner's words are
    // kept, a human has to approve it, and a fact is a claim the agent may
    // state rather than an instruction that outranks its scope.
    if (widensScope(line)) return addFact(line);
    // Slicing a rule to fit would change what the owner wrote; a line this long
    // is a paragraph, not an instruction, so it goes to review instead.
    if (line.length > MAX_RULE_TEXT_LENGTH) return addFact(line);

    const key = dedupeKey(line);
    if (seen.has(key)) return;

    const parsed = ruleSchema.safeParse({
      text: line,
      instruction: line.slice(0, MAX_INSTRUCTION_LENGTH),
      scope,
    });
    if (!parsed.success) return addFact(line);

    // Past the cap the line is still written — as an `archived` rule, not a
    // dropped one. It used to be dropped, on the grounds that the legacy
    // column still held it; the prompt no longer reads that column, so a
    // dropped line would now exist nowhere. Archived keeps the owner's exact
    // words and inferred scope, is the same row `archiveRuleAction` already
    // produces (nothing new has to understand it), can be restored by flipping
    // `status`, and cannot breach the cap because every read path filters
    // `status: "active"`. An archived row consumes no slot.
    const live = slots > 0;
    if (live) slots -= 1;

    seen.add(key);
    rules.push({
      orgId,
      text: parsed.data.text,
      instruction: parsed.data.instruction,
      scope: parsed.data.scope,
      condition: null,
      status: live ? "active" : "archived",
      source,
      // `order` climbs through archived rows too, exactly as `createRuleAction`
      // assumes: restoring one later must not collide with a live rule.
      order: order++,
    });
  };

  // `doNots` is negative by construction — every line is a "never", whatever
  // shape it takes.
  for (const line of splitLegacyLines(profile.doNots)) {
    addRule(line, "never", "migrated_donots");
  }
  for (const line of splitLegacyLines(profile.businessInfo)) {
    if (classifyLegacyLine(line) === "instruction") {
      addRule(line, inferLegacyScope(line), "migrated_businessinfo");
    } else {
      addFact(line);
    }
  }

  return { rules, facts };
}

/**
 * The lazy trigger behind the Training page. The durable guard lives in
 * `migrateProfileToRules`; this one stops a warm server instance asking the
 * database again on every page load, and swallows failures — a migration that
 * cannot run (an un-pushed `AgentRule` table, say) must never blank the page it
 * runs behind. A failure forgets the org so the next load retries; with the
 * guard above now a single indexed `findFirst`, a persistently failing org
 * costs one small query per load rather than a full rule scan.
 *
 * The map holds the in-flight PROMISE, not a bare "we started this". It held
 * the latter, and the marker went in before the await — so a second concurrent
 * load in the same instance skipped the migration outright and could render an
 * empty rules list while the first was still committing. Awaiting the same work
 * makes both loads see the same finished state, which is the whole point of
 * running this ahead of the page's reads.
 */
const attempted = new Map<string, Promise<void>>();

export async function migrateProfileOnce(orgId: string): Promise<void> {
  const inFlight = attempted.get(orgId);
  if (inFlight) return inFlight;
  const run = migrateProfileToRules(orgId).then(
    () => undefined,
    (err: unknown) => {
      attempted.delete(orgId);
      console.error("[migrate-profile] failed", err);
    }
  );
  attempted.set(orgId, run);
  return run;
}

type RuleSource = "migrated_donots" | "migrated_businessinfo";

interface RuleRow {
  orgId: string;
  text: string;
  instruction: string;
  scope: RuleScope;
  condition: null;
  /** `archived` only when the line arrived past the active-rule cap. */
  status: "active" | "archived";
  source: RuleSource;
  order: number;
}

/**
 * How two rule texts are compared for "the org already has this one". Exported
 * because the concierge writer dedupes its own do-not lines the same way — two
 * writers with two notions of "the same rule" would duplicate across each other.
 */
export function dedupeKey(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Bullets and list numbering an owner typed into a textarea. */
const BULLET = /^\s*(?:[-*•–—]+|\d+[.)])\s+/;
/**
 * A sentence end followed by something that starts a new sentence. The
 * abbreviation guard keeps "e.g. ₹500" in one piece, and requiring whitespace
 * keeps "https://getgutfeeling.in/" — whose dots have no space after them —
 * whole.
 */
const SENTENCE_END =
  /(?<=[.!?])(?<!\b(?:e\.g|i\.e|etc|vs|approx|Dr|Mr|Mrs|Ms|No)\.)\s+(?=[A-Z0-9₹"'(])/;

/** The lines of a legacy textarea: one per bullet, newline or sentence. */
export function splitLegacyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(SENTENCE_END))
    .map((line) => line.replace(BULLET, "").trim())
    .filter((line) => line.length >= 3)
    .slice(0, MAX_LINES);
}

/**
 * Does this line tell the assistant how to behave, or state something true?
 *
 * Deliberately crude — a regex, not a model call. It is biased towards
 * "instruction": a wrong rule is visible on the Training page and archived in
 * one click, while an instruction filed as a fact is the exact bug this whole
 * feature exists to fix. Its known error is a declarative sentence that happens
 * to carry "always" or "never" ("We never work on Sundays") reading as a rule.
 */
export function classifyLegacyLine(line: string): "instruction" | "fact" {
  if (STRONG_INSTRUCTION.test(line)) return "instruction";
  if (ADDRESSED_TO_CUSTOMERS.test(line)) return "instruction";
  return IMPERATIVE_START.test(line) ? "instruction" : "fact";
}

// Words that only appear when an owner is directing the assistant.
const STRONG_INSTRUCTION =
  /\b(?:always|never|make sure|makes sure|be sure to|ensure|must|do not|don[’']?t|action item|remember to)\b/i;
// "tell them", "push everyone", "remind each customer" — a transitive verb
// aimed at the people the assistant talks to. The object is what makes it an
// instruction rather than a description ("patients ask about downtime").
const ADDRESSED_TO_CUSTOMERS =
  /\b(?:push|tell|remind|offer|ask|send|show|point|direct|redirect|encourage|invite|give)\s+(?:them|him|her|everyone|everybody|people|customers|clients|patients|leads|each|every|all)\b/i;
// An imperative in the grammatical sense: the line opens with a bare verb.
// "Open Mon–Sat" and "Closed Sunday" are excluded on purpose — in a business
// info box they are opening hours, not orders.
const IMPERATIVE_START =
  /^(?:please\s+|kindly\s+|also\s+|then\s+|and\s+)*(?:push|tell|remind|offer|ask|send|share|mention|direct|point|redirect|escalate|encourage|invite|suggest|recommend|collect|greet|confirm|check|quote|explain|highlight|upsell|include|avoid|keep|use|book)\b/i;

/**
 * `never` when the line is phrased as a prohibition, `always` otherwise. It
 * never infers `when`: extracting a reliable condition from a legacy sentence
 * is guesswork, and a `when` rule with a wrong condition fires at the wrong
 * moment — whereas an `always` rule is at least visibly wrong.
 */
export function inferLegacyScope(line: string): RuleScope {
  if (LEADING_NEGATION.test(line)) return "never";
  // "Always tell them we don't do refunds" is an instruction to say a negative
  // thing, not a prohibition — the leading word decides.
  if (/\balways\b/i.test(line)) return "always";
  return ANY_NEGATION.test(line) ? "never" : "always";
}

const LEADING_NEGATION =
  /^(?:please\s+|kindly\s+|also\s+|then\s+|and\s+)*(?:never|do not|don[’']?t|avoid|under no circumstances)\b/i;
const ANY_NEGATION =
  /\b(?:never|do not|don[’']?t|avoid|must not|cannot|can[’']?t|shouldn[’']?t|won[’']?t|under no circumstances)\b/i;
