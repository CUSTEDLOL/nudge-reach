import { describe, expect, it, vi } from "vitest";
import { periodStartOf, resolveIncludedMinutes, roundCallMinutes, sumCallMinutes } from "@/modules/voice/usage";

describe("roundCallMinutes", () => {
  it("rounds every call up to a whole minute (telecom convention)", () => {
    expect(roundCallMinutes(0)).toBe(0);
    expect(roundCallMinutes(1)).toBe(1);
    expect(roundCallMinutes(59)).toBe(1);
    expect(roundCallMinutes(60)).toBe(1);
    expect(roundCallMinutes(61)).toBe(2);
    expect(roundCallMinutes(null)).toBe(0);
  });
  it("sums a month of calls", () => {
    expect(sumCallMinutes([{ durationSecs: 90 }, { durationSecs: 30 }, { durationSecs: null }])).toBe(3);
  });
});

describe("resolveIncludedMinutes", () => {
  it("prefers the org override, else the plan allowance", () => {
    expect(resolveIncludedMinutes(300, 100)).toBe(300);
    expect(resolveIncludedMinutes(null, 100)).toBe(100);
    expect(resolveIncludedMinutes(0, 100)).toBe(0);      // deliberate "no minutes"
    expect(resolveIncludedMinutes(null, null)).toBeNull(); // unlimited
  });
});

describe("periodStartOf", () => {
  it("is the first of the current month", () => {
    const start = periodStartOf(new Date(2026, 8, 17, 13, 45));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });
});
