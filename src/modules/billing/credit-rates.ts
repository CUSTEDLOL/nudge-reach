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

export const RATE_CARD_VERSION = "2026-09-20";
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
 *
 * This is the ONE rate card. The credit ledger prices platform-paid calls
 * from it, and `lib/model-router/usage.ts` prices the analytics/dashboard
 * figure from it too — including BYO-key calls, which cost the customer
 * rather than us but must still be shown honestly.
 *
 * Anthropic confirmed against platform.claude.com on 2026-09-15; OpenAI
 * against developers.openai.com/api/docs/pricing on 2026-09-20. Re-verify
 * before adding a model — a wrong row here bills real money.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  // --- Platform-paid (RUNTIME_MODEL) and BYO-Anthropic -------------------
  // Anthropic prompt caching: read 0.1x input, write 1.25x input (5-min TTL).
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
  // --- BYO-OpenAI (E3) ---------------------------------------------------
  // OpenAI caching is automatic: cached input is 0.1x and there is no write
  // surcharge, so a "write" is simply an ordinary input token.
  "gpt-5.2": {
    input: 1_750_000,
    output: 14_000_000,
    cacheRead: 175_000,
    cacheWrite: 1_750_000,
  },
  "gpt-5-mini": {
    input: 250_000,
    output: 2_000_000,
    cacheRead: 25_000,
    cacheWrite: 250_000,
  },
  // --- BYO-Google --------------------------------------------------------
  // Context caching is implicit; no write surcharge, as with OpenAI.
  // NOTE: both Flash rates are PROMOTIONAL through 2026-12-31 and rise to
  // $1.50 / $7.50 on 2027-01-01 — diarise a re-check.
  "gemini-3.8-flash": {
    input: 750_000,
    output: 3_750_000,
    cacheRead: 75_000,
    cacheWrite: 750_000,
  },
  "gemini-3.7-flash": {
    input: 750_000,
    output: 3_750_000,
    cacheRead: 75_000,
    cacheWrite: 750_000,
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

/**
 * The dearest row on the card, priced per call. Used as the fallback for a
 * model we have no published price for, so an unknown id over-states rather
 * than under-states. Computed, not hardcoded, so adding a pricier model
 * cannot leave the fallback stale.
 */
function dearestRate(): ModelRate {
  const rates = Object.values(MODEL_RATES);
  return {
    input: Math.max(...rates.map((r) => r.input)),
    output: Math.max(...rates.map((r) => r.output)),
    cacheRead: Math.max(...rates.map((r) => r.cacheRead)),
    cacheWrite: Math.max(...rates.map((r) => r.cacheWrite)),
  };
}

/**
 * Price one call for DISPLAY (the usage dashboard and BYO-key visibility).
 * Unlike `priceCall` this never throws — metering must never be able to break
 * the call it measures — but it never prices at zero either: an unpriced
 * model falls back to the dearest known rate. Money is only ever moved by
 * `priceCall`, which still refuses an unknown model outright.
 */
export function estimateCostMicroUsd(model: string, u: DriverUsage): number {
  const r = MODEL_RATES[model] ?? dearestRate();
  return Math.round(
    (u.inputTokens * r.input +
      u.outputTokens * r.output +
      (u.cacheReadTokens ?? 0) * r.cacheRead +
      (u.cacheWriteTokens ?? 0) * r.cacheWrite) /
      1_000_000
  );
}
