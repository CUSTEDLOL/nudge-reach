import { describe, expect, it } from "vitest";
import { questionnaireScript } from "@/modules/knowledge/questionnaire";
import { KNOWLEDGE_CATEGORIES } from "@/modules/knowledge/digest";

describe("questionnaireScript", () => {
  it("has a substantial, bounded script", () => {
    const script = questionnaireScript("boutique");
    expect(script.length).toBeGreaterThanOrEqual(18);
    expect(script.length).toBeLessThanOrEqual(24);
  });

  it("covers every knowledge category", () => {
    const cats = new Set(questionnaireScript("other").map((q) => q.category));
    for (const c of KNOWLEDGE_CATEGORIES) expect(cats.has(c)).toBe(true);
  });

  it("ids are stable and unique across verticals", () => {
    const a = questionnaireScript("clinic").map((q) => q.id);
    const b = questionnaireScript("boutique").map((q) => q.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("adapts wording to curated verticals", () => {
    const clinic = questionnaireScript("clinic").find(
      (q) => q.id === "services_list"
    );
    expect(clinic?.prompt.toLowerCase()).toContain("treatment");
    const restaurant = questionnaireScript("restaurant").find(
      (q) => q.id === "services_list"
    );
    expect(restaurant?.prompt.toLowerCase()).toContain("dish");
    const generic = questionnaireScript("jewellery").find(
      (q) => q.id === "services_list"
    );
    expect(generic?.prompt.toLowerCase()).toContain("products or services");
  });

  it("every item has a prompt and placeholder", () => {
    for (const q of questionnaireScript("salon")) {
      expect(q.prompt.length).toBeGreaterThan(10);
      expect(q.placeholder.length).toBeGreaterThan(3);
    }
  });
});
