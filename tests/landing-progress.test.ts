import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  clamp01,
  localProgress,
  shiftClock,
  shift,
} from "@/components/marketing/v2/progress";

describe("shift refs", () => {
  it("starts at zero", () => {
    expect(shift).toEqual({ page: 0, story: 0, after: 0 });
  });
});

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

describe("localProgress", () => {
  it("is 0 before the chapter and 1 after it", () => {
    expect(localProgress(0, "book")).toBe(0);
    expect(localProgress(1, "book")).toBe(1);
  });
  it("is 0.5 at the chapter midpoint", () => {
    const { start, end } = CHAPTERS.chase;
    expect(localProgress((start + end) / 2, "chase")).toBeCloseTo(0.5);
  });
});

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
  });
});

describe("shiftClock", () => {
  it("opens at 11:47 PM", () => {
    expect(shiftClock(0, 0)).toBe("11:47 PM");
  });
  it("reaches dawn (6:48 AM) at story end", () => {
    expect(shiftClock(1, 0)).toBe("6:48 AM");
  });
  it("reaches 9:00 AM at the end of the daylight zone", () => {
    expect(shiftClock(1, 1)).toBe("9:00 AM");
  });
  it("crosses midnight correctly", () => {
    expect(shiftClock(0.5, 0)).toBe("3:18 AM");
  });
});
