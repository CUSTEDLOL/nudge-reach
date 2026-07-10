import { describe, expect, it } from "vitest";
import { parseDistilled } from "@/modules/knowledge/distill";

describe("parseDistilled", () => {
  it("parses a valid facts array", () => {
    const raw =
      '[{"category":"menu_services","fact":"Chicken dishes are served","condition":"weekends only"}]';
    expect(parseDistilled(raw, "x")).toEqual([
      {
        category: "menu_services",
        fact: "Chicken dishes are served",
        condition: "weekends only",
      },
    ]);
  });

  it("strips code fences and surrounding prose", () => {
    const raw =
      'Here you go:\n```json\n[{"category":"hours","fact":"Open till 8pm"}]\n```';
    const facts = parseDistilled(raw, "x");
    expect(facts).toHaveLength(1);
    expect(facts[0].fact).toBe("Open till 8pm");
    expect(facts[0].condition).toBeUndefined();
  });

  it("bad category → single 'other' fact from the raw answer", () => {
    expect(
      parseDistilled('[{"category":"nope","fact":"y"}]', "yes only on weekends")
    ).toEqual([{ category: "other", fact: "yes only on weekends" }]);
  });

  it("malformed JSON → fallback", () => {
    expect(parseDistilled("not json at all", "the answer")).toEqual([
      { category: "other", fact: "the answer" },
    ]);
  });

  it("empty array → fallback", () => {
    expect(parseDistilled("[]", "ans")).toEqual([
      { category: "other", fact: "ans" },
    ]);
  });

  it("caps runaway fact lists at 8", () => {
    const raw = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        category: "other",
        fact: `A perfectly valid fact number ${i}`,
      }))
    );
    expect(parseDistilled(raw, "fallback")).toHaveLength(8);
  });
});
