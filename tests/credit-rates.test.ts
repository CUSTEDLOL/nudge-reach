import { describe, expect, it } from "vitest";

/**
 * Credit ledger rate card (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 1). Exact model ids only, cache tokens priced, rounding to the nearest
 * micro-USD — never up to a whole credit. Every platform Anthropic model the
 * router can run must have a rate, or the ledger refuses the call.
 */

import {
  MICRO_USD_PER_CREDIT,
  MODEL_RATES,
  RATE_CARD_VERSION,
  UnpricedModelError,
  estimateCostMicroUsd,
  microUsdToCredits,
  priceCall,
} from "@/modules/billing/credit-rates";
import { BYOK_ALLOWED_MODELS } from "@/lib/model-router/guard";
import { envSchema } from "@/lib/env-schema";

const ONE_MILLION_EACH = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
  cacheWriteTokens: 1_000_000,
};

describe("credit rate card", () => {
  it("is versioned and defines the credit unit", () => {
    expect(RATE_CARD_VERSION).toBe("2026-09-20");
    expect(MICRO_USD_PER_CREDIT).toBe(5_000);
    expect(microUsdToCredits(5_000)).toBe(1);
    expect(microUsdToCredits(7_000)).toBe(1.4);
  });

  it("prices claude-sonnet-5 exactly (1M in + 1M out + 1M cache read + 1M cache write)", () => {
    // $2 + $10 + $0.20 + $2.50 = $14.70 = 14_700_000 micro-USD
    expect(priceCall("claude-sonnet-5", ONE_MILLION_EACH)).toBe(14_700_000);
  });

  it("prices claude-haiku-4-5 exactly", () => {
    // $1 + $5 + $0.10 + $1.25 = $7.35 = 7_350_000 micro-USD
    expect(priceCall("claude-haiku-4-5", ONE_MILLION_EACH)).toBe(7_350_000);
  });

  it("does not substring-match (\"claude-sonnet-5-turbo\" throws UnpricedModelError)", () => {
    expect(() =>
      priceCall("claude-sonnet-5-turbo", { inputTokens: 10, outputTokens: 10 })
    ).toThrow(UnpricedModelError);
    expect(() => priceCall("sonnet", { inputTokens: 10, outputTokens: 10 })).toThrow(
      UnpricedModelError
    );
    expect(() => priceCall("", { inputTokens: 10, outputTokens: 10 })).toThrow(
      UnpricedModelError
    );
  });

  it("rounds to the nearest micro-USD, never up to a credit (1 token in on Haiku = 1 micro-USD = 0.0002 credits)", () => {
    const micro = priceCall("claude-haiku-4-5", { inputTokens: 1, outputTokens: 0 });
    expect(micro).toBe(1);
    expect(microUsdToCredits(micro)).toBe(0.0002);
    // A cache read of 1 token on Haiku is 0.1 micro-USD → rounds to 0, not up.
    expect(
      priceCall("claude-haiku-4-5", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1 })
    ).toBe(0);
    // Cache fields are optional and default to 0.
    expect(priceCall("claude-sonnet-5", { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("every Anthropic model in BYOK_ALLOWED_MODELS.anthropic and the env RUNTIME_MODEL default is priced", () => {
    const runtimeDefault = envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    }).RUNTIME_MODEL;
    const models = new Set([...BYOK_ALLOWED_MODELS.anthropic, runtimeDefault]);
    expect(models.size).toBeGreaterThan(0);
    for (const model of models) {
      expect(MODEL_RATES[model], `${model} has no rate`).toBeDefined();
      expect(() => priceCall(model, { inputTokens: 1, outputTokens: 1 })).not.toThrow();
    }
  });
});

/**
 * BYO-key models (E3) are the customer's cost, but the dashboard must still
 * show it honestly — so they live in the SAME exact-id card as the platform
 * models. Prices confirmed against the providers' own pricing pages
 * (developers.openai.com/api/docs/pricing) on 2026-09-20.
 */
describe("BYO-key models are on the one rate card", () => {
  const ONE_M = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

  it("prices gpt-5.2 at its own rate, not gpt-5's", () => {
    // $1.75 in + $14.00 out = $15.75
    expect(priceCall("gpt-5.2", ONE_M)).toBe(15_750_000);
    // The old substring table matched "gpt-5" and undercharged by $3.50/MTok.
    expect(priceCall("gpt-5.2", ONE_M)).toBeGreaterThan(11_250_000);
  });

  it("prices gpt-5-mini exactly ($0.25 in + $2.00 out)", () => {
    expect(priceCall("gpt-5-mini", ONE_M)).toBe(2_250_000);
  });

  it("prices cached input on BYO models too", () => {
    // gpt-5.2 cached input is $0.175/MTok — a tenth of the $1.75 input rate.
    expect(
      priceCall("gpt-5.2", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 })
    ).toBe(175_000);
  });

  it("every allow-listed BYOK model with a published price is on the card", () => {
    for (const model of [...BYOK_ALLOWED_MODELS.anthropic, ...BYOK_ALLOWED_MODELS.openai]) {
      expect(MODEL_RATES[model], `${model} has no rate`).toBeDefined();
    }
  });
});

/**
 * The analytics/dashboard path must never throw — metering a call must not be
 * able to break the call it measures — but it must also never silently price
 * an unknown model at zero, and must count cache tokens (the old
 * usage.ts table ignored them entirely, so enabling prompt caching would have
 * made the dashboard under-report).
 */
describe("estimateCostMicroUsd (never-throw dashboard pricing)", () => {
  it("agrees with priceCall for a known model", () => {
    const usage = { inputTokens: 1_000, outputTokens: 500, cacheReadTokens: 9_000 };
    expect(estimateCostMicroUsd("claude-sonnet-5", usage)).toBe(
      priceCall("claude-sonnet-5", usage)
    );
  });

  it("counts cache read and write tokens", () => {
    const withCache = estimateCostMicroUsd("claude-sonnet-5", {
      inputTokens: 100,
      outputTokens: 0,
      cacheReadTokens: 100_000,
      cacheWriteTokens: 100_000,
    });
    const withoutCache = estimateCostMicroUsd("claude-sonnet-5", {
      inputTokens: 100,
      outputTokens: 0,
    });
    expect(withCache).toBeGreaterThan(withoutCache);
  });

  it("never throws on an unknown model, and prices it at no less than the dearest known one", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    let estimate = 0;
    expect(() => {
      estimate = estimateCostMicroUsd("some-model-we-have-never-seen", usage);
    }).not.toThrow();
    const dearest = Math.max(
      ...Object.keys(MODEL_RATES).map((m) => priceCall(m, usage))
    );
    expect(estimate).toBeGreaterThanOrEqual(dearest);
  });

  it("does not substring-match an unknown model onto a cheap rate", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    // "gpt-5-mini-2099" is NOT gpt-5-mini; it must not inherit the cheap rate.
    expect(estimateCostMicroUsd("gpt-5-mini-2099", usage)).toBeGreaterThan(
      priceCall("gpt-5-mini", usage)
    );
  });
});
