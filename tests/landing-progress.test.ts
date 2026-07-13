import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/components/marketing/v2/progress";

describe("CHAPTERS", () => {
  it("tile [0,1] in order without gaps", () => {
    const list = Object.values(CHAPTERS);
    expect(list[0].start).toBe(0);
    expect(list[list.length - 1].end).toBe(1);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].start).toBe(list[i - 1].end);
    }
  });
});
