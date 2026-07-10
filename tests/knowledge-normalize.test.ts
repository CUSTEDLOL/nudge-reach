import { describe, expect, it } from "vitest";
import { questionKey } from "@/modules/knowledge/normalize";

describe("questionKey", () => {
  it("normalizes case, punctuation, whitespace", () => {
    expect(questionKey("Do you have CHICKEN?!")).toBe(
      questionKey("do you have   chicken")
    );
  });

  it("drops leading filler so phrasings collide", () => {
    expect(questionKey("Is there chicken in the menu")).toBe(
      questionKey("do you have chicken in the menu")
    );
  });

  it("keeps distinct questions distinct", () => {
    expect(questionKey("do you have chicken")).not.toBe(
      questionKey("do you have parking")
    );
  });

  it("handles empty input", () => {
    expect(questionKey("  ")).toBe("");
  });

  it("handles non-latin scripts without crashing", () => {
    expect(questionKey("क्या चिकन मिलेगा?")).toBe(questionKey("क्या चिकन मिलेगा"));
  });
});
