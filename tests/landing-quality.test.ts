import { describe, expect, it } from "vitest";
import {
  QUALITY,
  pickTier,
  shouldStepDown,
  stepDown,
} from "@/components/marketing/v2/world/quality";

describe("pickTier", () => {
  it("gives a strong desktop the high tier", () => {
    expect(pickTier({ memory: 16, cores: 12, mobile: false, gpu: "Apple M3" })).toBe("high");
  });
  it("gives a flagship phone the high tier", () => {
    expect(pickTier({ memory: 8, cores: 8, mobile: true, gpu: "Adreno (TM) 750" })).toBe("high");
  });
  it("gives a mid phone the mid tier", () => {
    expect(pickTier({ memory: 4, cores: 8, mobile: true, gpu: "Mali-G57" })).toBe("mid");
  });
  it("forces low on blocklisted GPUs regardless of specs", () => {
    expect(pickTier({ memory: 16, cores: 16, mobile: false, gpu: "Google SwiftShader" })).toBe("low");
    expect(pickTier({ memory: 8, cores: 8, mobile: true, gpu: "Mali-400 MP" })).toBe("low");
  });
  it("defaults unknown hardware to mid, not low", () => {
    expect(pickTier({ mobile: false })).toBe("mid");
  });
});

describe("governor", () => {
  it("steps high→mid→low and stays at low", () => {
    expect(stepDown("high")).toBe("mid");
    expect(stepDown("mid")).toBe("low");
    expect(stepDown("low")).toBe("low");
  });
  it("triggers only on a sustained slow average", () => {
    expect(shouldStepDown(16)).toBe(false);
    expect(shouldStepDown(30)).toBe(true);
  });
});

describe("QUALITY table", () => {
  it("degrades monotonically", () => {
    expect(QUALITY.high.particles).toBeGreaterThan(QUALITY.mid.particles);
    expect(QUALITY.mid.particles).toBeGreaterThan(QUALITY.low.particles);
    expect(QUALITY.high.dprMax).toBeGreaterThanOrEqual(QUALITY.mid.dprMax);
    expect(QUALITY.mid.dprMax).toBeGreaterThanOrEqual(QUALITY.low.dprMax);
  });
});
