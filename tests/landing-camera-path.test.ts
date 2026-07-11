import { describe, expect, it } from "vitest";
import { cameraAt, rand, smooth01 } from "@/components/marketing/v2/world/path";

describe("smooth01", () => {
  it("has smoothstep endpoints and midpoint", () => {
    expect(smooth01(0)).toBe(0);
    expect(smooth01(1)).toBe(1);
    expect(smooth01(0.5)).toBeCloseTo(0.5);
    expect(smooth01(0.25)).toBeCloseTo(0.15625);
  });
});

describe("rand", () => {
  it("is deterministic and in [0,1)", () => {
    for (let i = 0; i < 50; i++) {
      const v = rand(i, 3);
      expect(v).toBe(rand(i, 3));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(rand(1, 1)).not.toBe(rand(2, 1));
  });
});

describe("cameraAt", () => {
  it("starts at the hero framing", () => {
    expect(cameraAt(0).pos).toEqual([0, 0.4, 7]);
  });
  it("ends at the dawn pullback", () => {
    expect(cameraAt(1).pos).toEqual([0, 2.0, -51]);
  });
  it("clamps outside [0,1]", () => {
    expect(cameraAt(-0.5)).toEqual(cameraAt(0));
    expect(cameraAt(1.5)).toEqual(cameraAt(1));
  });
  it("hits keyframes exactly", () => {
    expect(cameraAt(0.4).pos).toEqual([1.15, 0.65, -34.4]);
  });
  it("keeps the calendar look-target left of the grid so copy stays clear", () => {
    // Grid center x = 3.1; looking straight at it would re-center the grid
    // over the chapter copy (the S1 overlap bug).
    expect(cameraAt(0.4).look[0]).toBeLessThan(2.2);
    expect(cameraAt(0.54).look[0]).toBeLessThan(2.2);
  });
  it("interpolates between keyframes (flying INTO the corridor)", () => {
    const z = cameraAt(0.12).pos[2];
    expect(z).toBeLessThan(4);
    expect(z).toBeGreaterThan(-31);
  });
});
