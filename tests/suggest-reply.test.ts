import { describe, expect, it } from "vitest";
import {
  buildSuggestSystemPrompt,
  cannedDraft,
  isSuggestTone,
  SUGGEST_TONES,
  type SuggestGrounding,
} from "@/lib/ai/suggest-reply";

const grounding: SuggestGrounding = {
  businessName: "Meera Boutique",
  businessInfo: "Open Mon–Sat 10–8. Silk sarees from ₹2,499.",
  tone: "Warm and helpful",
  doNots: "discounts beyond 15%",
};

describe("buildSuggestSystemPrompt", () => {
  it("grounds the draft on the business profile", () => {
    const prompt = buildSuggestSystemPrompt(grounding, "professional");
    expect(prompt).toContain("Meera Boutique");
    expect(prompt).toContain("Silk sarees from ₹2,499");
    expect(prompt).toContain("Warm and helpful");
    expect(prompt).toContain("discounts beyond 15%");
    expect(prompt).toContain("never invent details");
  });

  it("is drafting-for-a-human, never auto-send", () => {
    const prompt = buildSuggestSystemPrompt(grounding, "friendly");
    expect(prompt).toContain("human agent");
    expect(prompt).toContain("review, edit and send");
  });

  it("varies by tone", () => {
    const short = buildSuggestSystemPrompt(grounding, "short");
    const persuasive = buildSuggestSystemPrompt(grounding, "persuasive");
    expect(short).not.toBe(persuasive);
    expect(short).toContain("brief");
  });

  it("handles an empty profile gracefully", () => {
    const prompt = buildSuggestSystemPrompt(
      { businessName: "Shop", businessInfo: "", tone: "", doNots: "" },
      "friendly"
    );
    expect(prompt).toContain("(No details provided.)");
    expect(prompt).not.toContain("Also avoid:");
  });
});

describe("cannedDraft (offline fallback, no ANTHROPIC_API_KEY)", () => {
  it("is deterministic and labeled as a sample", () => {
    for (const t of SUGGEST_TONES) {
      const a = cannedDraft(t.value, "Priya", "Meera Boutique");
      const b = cannedDraft(t.value, "Priya", "Meera Boutique");
      expect(a).toBe(b);
      expect(a).toContain("(sample)");
      expect(a).toContain("Priya");
    }
  });

  it("differs per tone", () => {
    const drafts = SUGGEST_TONES.map((t) =>
      cannedDraft(t.value, "Priya", "Meera Boutique")
    );
    expect(new Set(drafts).size).toBe(SUGGEST_TONES.length);
  });
});

describe("isSuggestTone", () => {
  it("accepts the four tones and rejects the rest", () => {
    expect(isSuggestTone("professional")).toBe(true);
    expect(isSuggestTone("friendly")).toBe(true);
    expect(isSuggestTone("short")).toBe(true);
    expect(isSuggestTone("persuasive")).toBe(true);
    expect(isSuggestTone("sassy")).toBe(false);
    expect(isSuggestTone("")).toBe(false);
  });
});
