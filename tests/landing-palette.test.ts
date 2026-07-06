import { describe, expect, it } from "vitest";
import { lerpHex, skyAt } from "@/components/marketing/v2/world/palette";

describe("lerpHex", () => {
  it("returns endpoints at t=0 and t=1", () => {
    expect(lerpHex("#050d0a", "#ffffff", 0)).toBe("#050d0a");
    expect(lerpHex("#050d0a", "#ffffff", 1)).toBe("#ffffff");
  });
  it("mixes at the midpoint", () => {
    expect(lerpHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("skyAt", () => {
  it("is deep night at the top of the page", () => {
    expect(skyAt(0, 0)).toEqual({
      top: "#050d0a",
      horizon: "#0a1a12",
      fog: "#050d0a",
      ambient: 0.18,
    });
  });
  it("shows the dawn horizon at story end", () => {
    expect(skyAt(1, 0).horizon).toBe("#d97b4a");
  });
  it("is full morning at the end of the daylight zone", () => {
    expect(skyAt(1, 1)).toEqual({
      top: "#cfeeda",
      horizon: "#f6fbf7",
      fog: "#dcf3e6",
      ambient: 1,
    });
  });
  it("brightens monotonically", () => {
    const points = [skyAt(0, 0), skyAt(0.75, 0), skyAt(1, 0), skyAt(1, 0.5), skyAt(1, 1)];
    for (let i = 1; i < points.length; i++) {
      expect(points[i].ambient).toBeGreaterThan(points[i - 1].ambient);
    }
  });
  it("clamps out-of-range input", () => {
    expect(skyAt(-1, 0)).toEqual(skyAt(0, 0));
    expect(skyAt(1, 5)).toEqual(skyAt(1, 1));
  });
});
