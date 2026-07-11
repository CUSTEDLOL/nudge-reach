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
  it("keeps the page white while the opening horizon carries colour", () => {
    expect(skyAt(0, 0)).toEqual({
      top: "#ffffff",
      horizon: "#8ee8b7",
      fog: "#ffffff",
      ambient: 0.9,
    });
  });
  it("shows the warm dawn horizon at story end", () => {
    expect(skyAt(1, 0).horizon).toBe("#edb966");
  });
  it("is pure white at the end of the daylight zone", () => {
    expect(skyAt(1, 1)).toEqual({
      top: "#ffffff",
      horizon: "#ffffff",
      fog: "#ffffff",
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
