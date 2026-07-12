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
  it("restores the original answers framing", () => {
    expect(cameraAt(0).pos).toEqual([0, 0.4, 7]);
  });
  it("ends at the stable collects framing", () => {
    expect(cameraAt(1).pos).toEqual([0, 0.8, -47]);
  });
  it("clamps outside [0,1]", () => {
    expect(cameraAt(-0.5)).toEqual(cameraAt(0));
    expect(cameraAt(1.5)).toEqual(cameraAt(1));
  });
  it("holds the camera still inside books, chases and collects", () => {
    expect(cameraAt(0.35)).toEqual(cameraAt(0.48));
    expect(cameraAt(0.62)).toEqual(cameraAt(0.72));
    expect(cameraAt(0.86)).toEqual(cameraAt(0.96));
  });
  it("keeps the calendar target left so the grid lands inside the right browser", () => {
    expect(cameraAt(0.4).look[0]).toBeLessThan(2.2);
    expect(cameraAt(0.5).look[0]).toBeLessThan(2.2);
  });
  it("keeps the original fly-through only for answers", () => {
    const z = cameraAt(0.12).pos[2];
    expect(z).toBeLessThan(4);
    expect(z).toBeGreaterThan(-31);
  });
  it("snaps directly to the fixed calendar frame", () => {
    expect(cameraAt(0.28).pos).toEqual([0, 0.5, -33]);
  });
});
