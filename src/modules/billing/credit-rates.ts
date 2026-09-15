import type { DriverUsage } from "@/lib/model-router/types";

/**
 * Credit ledger rate card (docs/superpowers/plans/2026-09-15-credit-ledger.md).
 * Pure: no server imports. The ledger prices every platform-paid LLM call
 * from this table and nothing else — `lib/model-router/usage.ts` keeps its
 * substring-matched estimates for the analytics dashboard only.
 *
 * Unit of account is micro-USD (1e-6 USD), the convention already used by
 * `AiUsage.costMicroUsd`. 1 credit = 5,000 micro-USD, so credits are a
 * display conversion and fractions accumulate exactly.
 */

export const RATE_CARD_VERSION = "2026-09-15";
export const MICRO_USD_PER_CREDIT = 5_000;

export interface ModelRate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Micro-USD per million tokens. EXACT model ids only — no substring matching:
 * an unknown id is refused, never guessed (spec §7 "never free").
 * Founder confirmed against platform.claude.com pricing on 2026-09-15.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  "claude-sonnet-5": {
    input: 2_000_000,
    output: 10_000_000,
    cacheRead: 200_000,
    cacheWrite: 2_500_000,
  },
  "claude-haiku-4-5": {
    input: 1_000_000,
    output: 5_000_000,
    cacheRead: 100_000,
    cacheWrite: 1_250_000,
  },
};

export class UnpricedModelError extends Error {
  constructor(model: string) {
    super(`No rate for model "${model}" (rate card ${RATE_CARD_VERSION})`);
    this.name = "UnpricedModelError";
  }
}

/** Price one call in micro-USD, rounded to the nearest micro-USD (never up to a credit). */
export function priceCall(model: string, u: DriverUsage): number {
  const r = MODEL_RATES[model];
  if (!r) throw new UnpricedModelError(model);
  return Math.round(
    (u.inputTokens * r.input +
      u.outputTokens * r.output +
      (u.cacheReadTokens ?? 0) * r.cacheRead +
      (u.cacheWriteTokens ?? 0) * r.cacheWrite) /
      1_000_000
  );
}

export function microUsdToCredits(micro: number): number {
  return micro / MICRO_USD_PER_CREDIT;
}
