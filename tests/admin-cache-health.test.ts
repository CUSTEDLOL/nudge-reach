import { describe, expect, it } from "vitest";
import { cacheHealth } from "@/modules/admin/usage";

/**
 * Prompt caching is invisible when it fails: Anthropic simply charges full
 * price and says nothing. Zero cache tokens has three quite different causes
 * and they need different fixes, so the dashboard names which one it is:
 *
 *  - not_caching  the prefix never reached the model's minimum (Haiku wants
 *                 4,096 tokens; our prompts are ~2-3.4k) — change the model
 *                 or grow the prefix.
 *  - write_only   entries are written and never read back: the prefix is
 *                 changing between calls, so nothing is reusable.
 *  - working      reads are happening; the saving is real.
 */
const row = (over: Partial<Parameters<typeof cacheHealth>[0][number]> = {}) => ({
  model: "claude-sonnet-5",
  inputTokens: 1_000,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

describe("cacheHealth", () => {
  it("reports no_data when the org has made no calls", () => {
    expect(cacheHealth([]).state).toBe("no_data");
  });

  it("reports not_caching when calls happen but nothing is cached at all", () => {
    const h = cacheHealth([row(), row()]);
    expect(h.state).toBe("not_caching");
    expect(h.hitRate).toBe(0);
    expect(h.savedMicroUsd).toBe(0);
  });

  it("distinguishes write-only, where the prefix is never reused", () => {
    const h = cacheHealth([row({ cacheWriteTokens: 3_000 })]);
    expect(h.state).toBe("write_only");
    expect(h.cacheWriteTokens).toBe(3_000);
  });

  it("reports working once reads appear, with the hit rate and saving", () => {
    const h = cacheHealth([
      row({ cacheWriteTokens: 3_000 }),
      row({ inputTokens: 200, cacheReadTokens: 3_000 }),
      row({ inputTokens: 200, cacheReadTokens: 3_000 }),
    ]);
    expect(h.state).toBe("working");
    // 6,000 cached of 7,400 prompt tokens.
    expect(h.hitRate).toBeCloseTo(6_000 / 7_400, 5);
    // Sonnet saves $1.80/MTok on a cache read → 6,000 tokens = 10,800 micro-USD.
    expect(h.savedMicroUsd).toBe(10_800);
  });

  it("sums across models rather than assuming one", () => {
    const h = cacheHealth([
      row({ cacheReadTokens: 1_000_000 }),
      row({ model: "claude-haiku-4-5", cacheReadTokens: 1_000_000 }),
    ]);
    // Sonnet 1,800,000 + Haiku 900,000
    expect(h.savedMicroUsd).toBe(2_700_000);
  });

  it("never divides by zero", () => {
    const h = cacheHealth([row({ inputTokens: 0 })]);
    expect(Number.isFinite(h.hitRate)).toBe(true);
    expect(h.hitRate).toBe(0);
  });
});
