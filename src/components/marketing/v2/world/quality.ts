/**
 * Device quality tiers for the Night Shift world. `pickTier` is pure (tested);
 * `detectQuality`/`webglSupported` are thin browser wrappers around it.
 * The live governor (world.tsx) calls `stepDown` when frames stay slow.
 */
export type Tier = "high" | "mid" | "low";

export interface Quality {
  tier: Tier;
  particles: number;
  dprMax: number;
  streamCards: number;
  fx: boolean;
}

export const QUALITY: Record<Tier, Quality> = {
  high: { tier: "high", particles: 2600, dprMax: 2, streamCards: 22, fx: true },
  mid: { tier: "mid", particles: 1400, dprMax: 1.5, streamCards: 14, fx: true },
  low: { tier: "low", particles: 650, dprMax: 1, streamCards: 8, fx: false },
};

const WEAK_GPU = /(mali-4\d\d|adreno \(tm\) [1-4]\d\d\b|powervr|swiftshader|llvmpipe)/;

export function pickTier(input: {
  memory?: number;
  cores?: number;
  mobile: boolean;
  gpu?: string;
}): Tier {
  if (WEAK_GPU.test((input.gpu ?? "").toLowerCase())) return "low";
  const mem = input.memory ?? 4;
  const cores = input.cores ?? 4;
  if (input.mobile) {
    if (mem >= 6 && cores >= 8) return "high";
    if (mem >= 4) return "mid";
    return "low";
  }
  if (mem >= 8 && cores >= 8) return "high";
  if (mem >= 4) return "mid";
  return "low";
}

export function stepDown(tier: Tier): Tier {
  return tier === "high" ? "mid" : "low";
}

/** 26 ms sustained average ≈ under 38 fps — time to shed load. */
export function shouldStepDown(avgMs: number): boolean {
  return avgMs > 26;
}

export function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function gpuString(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  } catch {
    return "";
  }
}

export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return QUALITY[
    pickTier({
      memory: nav.deviceMemory,
      cores: navigator.hardwareConcurrency,
      mobile: matchMedia("(pointer: coarse)").matches,
      gpu: gpuString(),
    })
  ];
}
