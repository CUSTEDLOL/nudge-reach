import { prisma } from "@/lib/db";

/**
 * AI usage metering (PLAN.md WS2). Every routed LLM call records model,
 * tokens and computed cost, attributed to an org (+ conversation when there
 * is one). Fire-and-forget like recordAudit — metering must never break a
 * customer reply. Simulation / keyless paths record synthetic estimates so
 * the meter works with zero external keys (invariant 4).
 */

export type UsagePurpose =
  | "agent_reply"
  | "suggest"
  | "distill"
  | "ingest"
  | "campaign_copy";

export interface Attribution {
  orgId: string;
  conversationId?: string;
  purpose: UsagePurpose;
}

/** Micro-USD per million tokens, hand-set from the public price sheet. */
const PRICES_MICRO_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  sonnet: { input: 3_000_000, output: 15_000_000 },
  haiku: { input: 1_000_000, output: 5_000_000 },
};

/** Unknown models are priced as Sonnet — overcounting beats undercounting. */
export function computeCostMicroUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const tier = model.includes("haiku") ? "haiku" : "sonnet";
  const price = PRICES_MICRO_USD_PER_MTOK[tier];
  return Math.round(
    (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  );
}

/** Rough chars→tokens estimate for synthetic rows; floor 1 so rows are visible. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function recordUsage(
  attribution: Attribution,
  model: string,
  inputTokens: number,
  outputTokens: number,
  synthetic = false
): void {
  void prisma.aiUsage
    .create({
      data: {
        orgId: attribution.orgId,
        conversationId: attribution.conversationId,
        purpose: attribution.purpose,
        model,
        inputTokens,
        outputTokens,
        costMicroUsd: computeCostMicroUsd(model, inputTokens, outputTokens),
        synthetic,
      },
    })
    .catch(() => {
      // Metering must never break the call it measures.
    });
}

/** Keyless/simulation fallbacks call this so the meter still moves. */
export function recordSyntheticUsage(
  attribution: Attribution,
  promptText: string,
  replyText: string,
  model = "synthetic"
): void {
  recordUsage(
    attribution,
    model,
    estimateTokens(promptText),
    estimateTokens(replyText),
    true
  );
}
