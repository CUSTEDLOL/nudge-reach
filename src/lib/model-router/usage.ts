import { prisma } from "@/lib/db";
import type { DriverUsage } from "@/lib/model-router/types";

/**
 * AI usage metering (PLAN.md WS2). Every routed LLM call records model,
 * tokens and computed cost, attributed to an org (+ conversation when there
 * is one). Never throws — metering must never break a customer reply; callers
 * may await the row id (the credit ledger anchors its debit on it) or fire
 * and forget. Simulation / keyless paths record synthetic estimates so the
 * meter works with zero external keys (invariant 4).
 */

export type UsagePurpose =
  | "agent_reply"
  | "suggest"
  | "distill"
  | "ingest"
  | "campaign_copy"
  | "followup_draft"
  /** Founder-side concierge setup work — absorbed, never charged to the client. */
  | "concierge_draft"
  | "summary";

export interface Attribution {
  orgId: string;
  conversationId?: string;
  purpose: UsagePurpose;
}

/**
 * Micro-USD per million tokens, hand-set from the public price sheets.
 * Matched by substring against the model id (E3: multi-provider). BYO usage
 * is still priced for visibility — the customer pays their provider, but the
 * dashboard should show what their AI costs.
 */
const PRICES_MICRO_USD_PER_MTOK: [match: string, price: { input: number; output: number }][] = [
  ["haiku", { input: 1_000_000, output: 5_000_000 }],
  ["sonnet", { input: 3_000_000, output: 15_000_000 }],
  ["gpt-5-mini", { input: 250_000, output: 2_000_000 }],
  ["gpt-5", { input: 1_250_000, output: 10_000_000 }],
  ["gemini-3-flash", { input: 300_000, output: 2_500_000 }],
  ["gemini-3-pro", { input: 2_000_000, output: 12_000_000 }],
];

/** Unknown models are priced as Sonnet — overcounting beats undercounting. */
export function computeCostMicroUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const entry = PRICES_MICRO_USD_PER_MTOK.find(([match]) => model.includes(match));
  const price = entry?.[1] ?? PRICES_MICRO_USD_PER_MTOK.find(([m]) => m === "sonnet")![1];
  return Math.round(
    (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  );
}

/** Rough chars→tokens estimate for synthetic rows; floor 1 so rows are visible. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Resolves to the new AiUsage row id, or null when the write failed. */
export async function recordUsage(
  attribution: Attribution,
  model: string,
  usage: DriverUsage,
  opts: { synthetic?: boolean; byok?: boolean } = {}
): Promise<string | null> {
  try {
    const row = await prisma.aiUsage.create({
      data: {
        orgId: attribution.orgId,
        conversationId: attribution.conversationId,
        purpose: attribution.purpose,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        costMicroUsd: computeCostMicroUsd(model, usage.inputTokens, usage.outputTokens),
        synthetic: opts.synthetic ?? false,
        byok: opts.byok ?? false,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    // Metering must never break the call it measures.
    return null;
  }
}

/** Keyless/simulation fallbacks call this so the meter still moves. */
export function recordSyntheticUsage(
  attribution: Attribution,
  promptText: string,
  replyText: string,
  model = "synthetic"
): void {
  void recordUsage(
    attribution,
    model,
    { inputTokens: estimateTokens(promptText), outputTokens: estimateTokens(replyText) },
    { synthetic: true }
  );
}
