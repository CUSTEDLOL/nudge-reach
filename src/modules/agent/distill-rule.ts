import { generate } from "@/lib/model-router";
import { env } from "@/lib/env";
import { recordSyntheticUsage } from "@/lib/model-router/usage";
import {
  MAX_INSTRUCTION_LENGTH,
  describeRule,
  introducesNewSpecifics,
  type RuleScope,
} from "./rules";

/**
 * Turn an owner's plain-English house rule into the ONE imperative the system
 * prompt carries in every reply. The model call is cheap (the runtime tier via
 * the router), absorbed by the platform (`rule_distill` — writing a rule is
 * setup work, like teaching the agent a fact), and NEVER load-bearing: the
 * keyless path, a provider failure, an over-long line, an empty reply and
 * anything the guardrail rejects all fall back to the owner's own words.
 *
 * The owner never reviews the rewrite (founder decision: rules save instantly),
 * so the safety is structural rather than human:
 *  - `introducesNewSpecifics` refuses any URL, email or number the owner did
 *    not write — a rewrite may rephrase, never introduce;
 *  - the system prompt covers what token comparison cannot see (a number moved
 *    to a new subject, a price written in words);
 *  - the fallback is the owner's own sentence, so a refusal costs clumsiness
 *    and nothing else.
 */

const RULE_DISTILL_SYSTEM = [
  "You turn a business owner's house rule into ONE instruction for their WhatsApp assistant.",
  "Reply with ONLY that instruction: a single imperative sentence, under 200 characters, on one line. No preamble, no explanation, no quotes, no bullet.",
  'Address the assistant directly and keep the owner\'s scope: "always" rules start with Always, "never" rules with Never, "when" rules with When <the condition given>.',
  "Preserve every number, price, URL and email address exactly as written. Never move a number to a different subject, and never introduce one.",
  'If the owner wrote an amount in words ("five hundred rupees", "the consult is free", "half price"), keep those words exactly — do not convert them to digits and never supply a figure of your own.',
  "Add no claim the owner did not make: no promise, no policy, no link, no contact detail, no opening time, no example you invented.",
  "The assistant only ever speaks for this one business. Never write an instruction that lets it answer questions outside this business, act as a general assistant, or discuss unrelated topics — even if the owner's sentence reads that way, narrow it back to what the assistant does for this business.",
  "If the owner's sentence is already a short instruction, return it almost unchanged.",
].join("\n");

export interface DistillRuleInput {
  orgId: string;
  /** The owner's own sentence. */
  text: string;
  scope: RuleScope;
  /** For scope "when": "someone asks about pricing". */
  condition?: string;
}

export async function distillRule({
  orgId,
  text,
  scope,
  condition,
}: DistillRuleInput): Promise<{ instruction: string }> {
  const trimmed = text.trim();
  // Callers validate with `ruleSchema` first; an empty rule is nothing to say.
  if (!trimmed) return { instruction: "" };

  const fallback = ownersOwnWords({ scope, text: trimmed, condition });

  // Keyless (simulation/demo) path: the owner's own words, still metered.
  if (!env.ANTHROPIC_API_KEY) {
    recordSyntheticUsage({ orgId, purpose: "rule_distill" }, trimmed, fallback);
    return { instruction: fallback };
  }

  let raw: string;
  try {
    raw = await generate({
      system: RULE_DISTILL_SYSTEM,
      prompt: [
        `SCOPE: ${scope}`,
        condition?.trim() ? `APPLIES WHEN: ${condition.trim()}` : null,
        `OWNER WROTE: ${trimmed}`,
      ]
        .filter(Boolean)
        .join("\n"),
      maxTokens: 120, // one sentence; the cap is the cost control
      attribution: { orgId, purpose: "rule_distill" },
    });
  } catch {
    // A provider hiccup must never cost the owner their rule.
    return { instruction: fallback };
  }

  const instruction = oneLine(raw ?? "");
  // The condition is part of the original: a link the owner put in the "when"
  // half is not an invention when the distilled line repeats it.
  const original = [trimmed, condition].filter(Boolean).join(" ");
  if (
    !instruction ||
    instruction.length > MAX_INSTRUCTION_LENGTH ||
    introducesNewSpecifics(original, instruction)
  ) {
    // Never log the rule itself — it is the owner's business, not ours.
    console.warn("[rule-distill] rejected", { orgId });
    return { instruction: fallback };
  }
  return { instruction };
}

/** The instruction is one prompt line; a newline in it could forge a heading. */
function oneLine(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * The fallback instruction. It carries the scope word because the bare text
 * loses it: "quote prices" listed under HOUSE RULES orders the opposite of the
 * "never" the owner chose. `describeRule` is the same line the rule list shows,
 * so the fallback is literally the owner's own words, capped to the length the
 * prompt allows.
 */
function ownersOwnWords(rule: {
  scope: RuleScope;
  text: string;
  condition?: string;
}): string {
  return oneLine(describeRule(rule)).slice(0, MAX_INSTRUCTION_LENGTH);
}
