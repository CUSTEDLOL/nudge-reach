import { describe, expect, it } from "vitest";
import {
  buildSuggestSystemPrompt,
  cannedDraft,
  isSuggestTone,
  SUGGEST_TONES,
  type SuggestGrounding,
} from "@/modules/ai/suggest-reply";

const grounding: SuggestGrounding = {
  businessName: "Meera Boutique",
  businessInfo: "Open Mon–Sat 10–8. Silk sarees from ₹2,499.",
  tone: "Warm and helpful",
  doNots: "discounts beyond 15%",
};

describe("buildSuggestSystemPrompt", () => {
  it("grounds the draft on the business name, house style and the digest", () => {
    const prompt = buildSuggestSystemPrompt(
      grounding,
      "professional",
      "PRICING\n- Silk sarees from ₹2,499"
    );
    expect(prompt).toContain("Meera Boutique");
    expect(prompt).toContain("Warm and helpful");
    expect(prompt).toContain("never invent details");
    // The digest carries the facts now; the retired Setup box does not.
    expect(prompt).toContain("Silk sarees from ₹2,499");
    expect(buildSuggestSystemPrompt(grounding, "professional")).not.toContain(
      "Silk sarees from ₹2,499"
    );
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

describe("buildSuggestSystemPrompt (knowledge digest)", () => {
  const grounding = {
    businessName: "Spice Garden",
    businessInfo: "Legacy blob.",
    tone: "",
    doNots: "",
  };

  it("renders the digest and nothing from the legacy blob", () => {
    const p = buildSuggestSystemPrompt(
      grounding,
      "professional",
      "HOURS:\n- Open till 8pm"
    );
    expect(p).toContain("BUSINESS KNOWLEDGE");
    expect(p).toContain("Open till 8pm");
    expect(p).not.toContain("ADDITIONAL BUSINESS INFORMATION");
    expect(p).not.toContain("Legacy blob.");
  });

  it("without a digest the information section is empty, not the blob", () => {
    const p = buildSuggestSystemPrompt(grounding, "professional");
    // Softened with the agent's own prompt (Task 3): "only source of truth"
    // told the model to ignore the house rules that now sit above it.
    expect(p).toContain(
      "BUSINESS INFORMATION — your source of truth for facts (never invent details not stated here):\n(No details provided.)"
    );
    expect(p).not.toContain("ADDITIONAL BUSINESS INFORMATION");
    expect(p).not.toContain("Legacy blob.");
  });
});

/**
 * The retired `/agent/setup` boxes. `migrateProfileToRules` copies both into
 * house rules and knowledge facts, which this builder already renders — the
 * rules block above the knowledge, the facts as the digest — so rendering the
 * originals as well sent a migrated org the same content twice and let an
 * archived rule keep speaking through the blob.
 *
 * Two assertions above are the inverse of what this file used to assert
 * ("grounds the draft on the business profile" wanted `businessInfo` and
 * `doNots` verbatim; "puts the digest above the demoted blob" wanted both) —
 * they encoded the duplication.
 */
describe("the retired Setup boxes never reach the suggested reply", () => {
  const RULES = [{ instruction: "Always push people to the waitlist." }];
  const shapes: Array<[string, Parameters<typeof buildSuggestSystemPrompt>]> = [
    ["no digest, no rules", [grounding, "professional"]],
    ["no digest, rules", [grounding, "professional", "", RULES]],
    ["digest, no rules", [grounding, "friendly", "HOURS:\n- Open till 8pm"]],
    ["digest + rules", [grounding, "short", "HOURS:\n- Open till 8pm", RULES]],
    ["persuasive + digest + rules", [grounding, "persuasive", "PRICING\n- ₹500", RULES]],
  ];

  for (const [label, args] of shapes) {
    it(`drops businessInfo and doNots (${label})`, () => {
      const p = buildSuggestSystemPrompt(...args);
      expect(p).not.toContain("ADDITIONAL BUSINESS INFORMATION");
      expect(p).not.toContain(grounding.businessInfo);
      expect(p).not.toContain("Also avoid");
      expect(p).not.toContain(grounding.doNots);
    });
  }

  it("still renders the rules and the digest that replaced them", () => {
    const p = buildSuggestSystemPrompt(grounding, "professional", "HOURS:\n- Open till 8pm", RULES);
    expect(p).toContain("Always push people to the waitlist.");
    expect(p).toContain("- Open till 8pm");
  });

  it("keeps the RULES block intact where the doNots line used to sit", () => {
    const p = buildSuggestSystemPrompt(grounding, "professional");
    expect(p).toContain(
      "- Never invent prices, stock, hours or policies. If unsure, say the team will confirm.\n- Output ONLY the reply text, nothing else."
    );
  });
});
