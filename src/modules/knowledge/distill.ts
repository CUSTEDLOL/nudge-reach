import { z } from "zod";
import { chat } from "@/lib/model-router";
import { env } from "@/lib/env";
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from "./digest";

/**
 * Turn a free-text owner answer into structured knowledge facts. The model
 * call is cheap (Haiku via the router) and NEVER load-bearing: any parse or
 * API failure — and the keyless simulation path — falls back to storing the
 * raw answer as a single "other" fact, so the learn-on-the-job loop works
 * end-to-end with zero external keys.
 */

export interface DistilledFact {
  category: KnowledgeCategory;
  fact: string;
  condition?: string;
}

export const factSchema = z.object({
  category: z.enum(KNOWLEDGE_CATEGORIES),
  fact: z.string().min(3).max(300),
  condition: z.string().min(2).max(120).optional(),
});
const factsSchema = z.array(factSchema).min(1).max(8);

const MAX_FACTS = 8;

/** Pure parse of the model's output; on ANY failure returns the raw answer as one fact. */
export function parseDistilled(
  raw: string,
  fallbackAnswer: string
): DistilledFact[] {
  const fallback: DistilledFact[] = [
    { category: "other", fact: fallbackAnswer.trim().slice(0, 300) },
  ];
  const withoutFences = raw.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1 || end <= start) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    return fallback;
  }
  // Cap runaway lists BEFORE validation so a 20-item answer still distills.
  const capped = Array.isArray(parsed) ? parsed.slice(0, MAX_FACTS) : parsed;
  const result = factsSchema.safeParse(capped);
  if (!result.success) return fallback;
  return result.data;
}

const DISTILL_SYSTEM = [
  "You turn a business owner's answer into knowledge-base facts for their WhatsApp assistant.",
  "Reply with ONLY a JSON array, no prose. Each item: {\"category\", \"fact\", \"condition\"?}.",
  `category must be one of: ${KNOWLEDGE_CATEGORIES.join(", ")}.`,
  "fact: one short, self-contained statement a customer-facing assistant can rely on. Write it as a fact about the business, not as a reply to this customer.",
  "condition: ONLY if the fact applies at limited times or cases (e.g. \"weekends only\", \"for orders above ₹2000\"). Omit otherwise.",
  "Split multi-part answers into separate facts. Never invent anything not stated by the owner.",
].join("\n");

export async function distillAnswer(
  question: string,
  answer: string
): Promise<DistilledFact[]> {
  const trimmed = answer.trim();
  if (!trimmed) return [];
  // Keyless (simulation/demo) path: deterministic, still useful.
  if (!env.ANTHROPIC_API_KEY) return parseDistilled("", trimmed);

  try {
    const raw = await chat({
      system: DISTILL_SYSTEM,
      messages: [
        {
          role: "user",
          text: `CUSTOMER ASKED: ${question}\nOWNER ANSWERED: ${trimmed}`,
        },
      ],
      maxTokens: 500,
    });
    return parseDistilled(raw ?? "", trimmed);
  } catch {
    return parseDistilled("", trimmed);
  }
}
