import { describe, expect, it } from "vitest";
import {
  buildKnowledgeDigest,
  KNOWLEDGE_CATEGORIES,
  CATEGORY_LABELS,
} from "@/modules/knowledge/digest";

const e = (
  category: string,
  fact: string,
  condition: string | null = null
) => ({ category, fact, condition });

describe("buildKnowledgeDigest", () => {
  it("empty → empty string", () => {
    expect(buildKnowledgeDigest([])).toBe("");
  });

  it("groups by category in fixed order with headers", () => {
    const d = buildKnowledgeDigest([
      e("hours", "Open 10am-8pm"),
      e("menu_services", "Serves biryani"),
    ]);
    expect(d.indexOf("MENU & SERVICES")).toBeGreaterThanOrEqual(0);
    expect(d.indexOf("MENU & SERVICES")).toBeLessThan(d.indexOf("HOURS"));
    expect(d).toContain("- Serves biryani");
    expect(d).toContain("- Open 10am-8pm");
  });

  it("skips empty categories", () => {
    const d = buildKnowledgeDigest([e("pricing", "Haircut ₹500")]);
    expect(d).not.toContain("HOURS");
    expect(d).not.toContain("OTHER");
  });

  it("renders conditions", () => {
    expect(
      buildKnowledgeDigest([
        e("menu_services", "Chicken dishes available", "weekends only"),
      ])
    ).toContain("Chicken dishes available — only: weekends only");
  });

  it("unknown category is treated as 'other'", () => {
    const d = buildKnowledgeDigest([e("garbage", "A stray fact")]);
    expect(d).toContain("OTHER:");
    expect(d).toContain("- A stray fact");
  });

  it("caps length by dropping whole facts and counting them", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      e("other", `Fact number ${i} with some padding text to fill space`)
    );
    const d = buildKnowledgeDigest(many, 1000);
    expect(d.length).toBeLessThanOrEqual(1040);
    expect(d).toMatch(/\(\+\d+ more facts not shown\)/);
  });

  it("every category has a label", () => {
    for (const c of KNOWLEDGE_CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});
