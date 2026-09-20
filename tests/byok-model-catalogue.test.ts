import { describe, expect, it } from "vitest";

/**
 * The BYOK model catalogue used to live in three places that could drift:
 * the allow-list (guard.ts), the customer's picker (settings/ai/ai-form.tsx)
 * and the rate card (credit-rates.ts). It DID drift — `gemini-3-pro` and
 * `gemini-3-flash` sat in the first two for months and are not real Google
 * API ids, so those calls passed every local check and were rejected by
 * Google. Nothing in the codebase could catch it.
 *
 * The picker now renders from BYOK_CATALOGUE, so that duplication is gone.
 * These tests hold the remaining seam — catalogue vs rate card — and pin the
 * shape of a Google id so the same class of bug cannot come back.
 *
 * What these tests CANNOT do is prove an id exists at the provider; only a
 * human reading the provider's docs can. Hence the shape check.
 */

import { BYOK_ALLOWED_MODELS, BYOK_CATALOGUE } from "@/lib/model-router/guard";
import { MODEL_RATES, priceCall } from "@/modules/billing/credit-rates";

describe("BYOK model catalogue", () => {
  it("derives the allow-list from the catalogue the customer actually sees", () => {
    expect(Object.keys(BYOK_ALLOWED_MODELS).sort()).toEqual(
      BYOK_CATALOGUE.map((p) => p.id).sort()
    );
    for (const provider of BYOK_CATALOGUE) {
      expect(BYOK_ALLOWED_MODELS[provider.id]).toEqual(provider.models.map((m) => m.id));
    }
  });

  it("every model a customer can pick has a price on the rate card", () => {
    for (const provider of BYOK_CATALOGUE) {
      for (const model of provider.models) {
        expect(MODEL_RATES[model.id], `${provider.id}/${model.id} has no rate`).toBeDefined();
        expect(() => priceCall(model.id, { inputTokens: 1, outputTokens: 1 })).not.toThrow();
      }
    }
  });

  it("no Google model uses a bare major-version alias (the gemini-3-pro bug)", () => {
    // Google ships versioned ids (gemini-3.8-flash); "gemini-3-pro" 404s.
    for (const model of BYOK_ALLOWED_MODELS.google) {
      expect(model, `${model} looks like a non-existent version alias`).toMatch(
        /^gemini-\d+\.\d+-/
      );
    }
  });

  it("every model has a human label, so the picker can never render a bare id", () => {
    for (const provider of BYOK_CATALOGUE) {
      expect(provider.label.length).toBeGreaterThan(0);
      for (const model of provider.models) {
        expect(model.label.length, `${model.id} has no label`).toBeGreaterThan(0);
      }
    }
  });
});
