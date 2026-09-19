import { prisma } from "@/lib/db";
import type { DriverUsage } from "@/lib/model-router/types";
import { estimateCostMicroUsd } from "@/modules/billing/credit-rates";

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
  | "summary";

export interface Attribution {
  orgId: string;
  conversationId?: string;
  purpose: UsagePurpose;
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
        // Priced off the one rate card, cache tokens included — never throws,
        // and an unpriced model over-states rather than showing $0.
        costMicroUsd: estimateCostMicroUsd(model, usage),
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
