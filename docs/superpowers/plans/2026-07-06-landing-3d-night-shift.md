# Landing v2 "Night Shift" 3D Scroll Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 landing page with a single-page immersive 3D scroll experience: one persistent WebGL world where scroll is time (11:47 PM → 9:00 AM), per the approved spec `docs/superpowers/specs/2026-07-06-landing-3d-design.md`.

**Architecture:** A single fixed R3F canvas lives behind the whole page (z-0); all copy is server-rendered DOM above it (z-10). Scroll progress is written into a shared mutable ref by ScrollTriggers and read by the 3D world every frame — no React state on the hot path. Night chapters are a CSS-sticky pinned track with GSAP-scrubbed DOM beats; daylight sections are the surviving v1 components wrapped in floating cards.

**Tech Stack:** Next.js App Router, GSAP + ScrollTrigger, Lenis, three.js + @react-three/fiber (all already installed — add nothing), Tailwind v4, vitest.

## Global Constraints

- **Node 20 required.** Prefix every npm/npx command with: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` (default node here is v18 and the build fails on it).
- **No new dependencies.** Do not add drei, zustand, or anything else. The quality governor is hand-rolled (~20 lines).
- **Motion gate is law:** default CSS = fully visible static page; anything scroll-driven hides/upgrades only under `html.jsm` (set by `MotionGate`). Never ship an element that is `opacity: 0` without JS.
- **No `Math.random()` in world code** — use the deterministic `rand(i, salt)` helper so renders are reproducible.
- **Marketing surface only.** Do not touch `src/modules/`, consent, messaging, model-router, or any invariant-bearing code. Routes `waitlist`, `login`, `privacy`, `terms` stay untouched.
- **Copy follows the approved one-liner** in AGENTS.md (AI Front Desk / employee framing, never "WhatsApp CRM").
- **Every commit green:** `npm run test`, `npm run lint`, `npm run build` all pass before each commit.
- Existing v2 files `gsap.ts`, `smooth-scroll.tsx`, `motion-gate.tsx` are reused as-is. `hero-v2.tsx` and `ambient.tsx` are modified. `nightfield.tsx` is deleted (superseded by `world/`).
- Existing CSS in `globals.css` under "Landing v2" (`.jsm .ns-track`, `.ns-stage`, `.ns-beat` opacity, `.v2-reveal`, `.v2-dayrail`, etc.) is already present — Tasks below only ADD the blocks shown.

---

### Task 1: Scroll-progress module (`progress.ts`)

The spine of the whole page: shared mutable refs + chapter map + clock math.

**Files:**
- Create: `src/components/marketing/v2/progress.ts`
- Test: `tests/landing-progress.test.ts`

**Interfaces:**
- Produces: `shift: { page: number; story: number; after: number }` (mutable singleton, written by ScrollTriggers, read by R3F frames); `CHAPTERS: Record<"answer"|"book"|"chase"|"dawn", {start,end}>`; `localProgress(story, name): number`; `clamp01(v): number`; `shiftClock(story, after): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/landing-progress.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-progress.test.ts`
Expected: FAIL — cannot resolve `@/components/marketing/v2/progress`.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/marketing/v2/progress.ts
/**
 * The scroll spine of the Night Shift page. ScrollTriggers (experience.tsx)
 * write into `shift` on scroll; the R3F world reads it every frame. Mutable
 * refs, not React state — nothing re-renders on scroll.
 *
 *   page  — 0→1 across the whole document
 *   story — 0→1 across the pinned #night-shift track (the night)
 *   after — 0→1 from the #morning section to the bottom (the daylight zone)
 */
export const shift = { page: 0, story: 0, after: 0 };

/** Story-progress spans for the four night chapters. Must tile [0, 1]. */
export const CHAPTERS = {
  answer: { start: 0.0, end: 0.28 },
  book: { start: 0.28, end: 0.55 },
  chase: { start: 0.55, end: 0.8 },
  dawn: { start: 0.8, end: 1.0 },
} as const;
export type ChapterName = keyof typeof CHAPTERS;

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** 0→1 within one chapter, clamped outside it. */
export function localProgress(story: number, name: ChapterName): number {
  const c = CHAPTERS[name];
  return clamp01((story - c.start) / (c.end - c.start));
}

const SHIFT_START = 23 * 60 + 47; // 11:47 PM
const DAWN = 6 * 60 + 48; //  6:48 AM — story (night) ends here
const MORNING = 9 * 60; //  9:00 AM — daylight zone ends here
const NIGHT_SPAN = 24 * 60 - SHIFT_START + DAWN; // 421 minutes

/** HUD clock: story drives 11:47 PM→6:48 AM, after drives 6:48→9:00 AM. */
export function shiftClock(story: number, after: number): string {
  const mins =
    story < 1
      ? SHIFT_START + clamp01(story) * NIGHT_SPAN
      : DAWN + clamp01(after) * (MORNING - DAWN);
  const total = Math.round(mins) % (24 * 60);
  let h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-progress.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/v2/progress.ts tests/landing-progress.test.ts
git commit -m "feat(landing-v2): scroll-progress spine — shift refs, chapters, HUD clock"
```

---

### Task 2: Device quality tiers + live governor (`world/quality.ts`)

**Files:**
- Create: `src/components/marketing/v2/world/quality.ts`
- Test: `tests/landing-quality.test.ts`

**Interfaces:**
- Produces: `type Tier = "high"|"mid"|"low"`; `interface Quality { tier; particles; dprMax; streamCards; fx }`; `QUALITY: Record<Tier, Quality>`; `pickTier(input): Tier` (pure); `stepDown(tier): Tier`; `shouldStepDown(avgMs): boolean`; `detectQuality(): Quality` (browser); `webglSupported(): boolean` (browser).

- [ ] **Step 1: Write the failing test**

```ts
// tests/landing-quality.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-quality.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/marketing/v2/world/quality.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-quality.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/v2/world/quality.ts tests/landing-quality.test.ts
git commit -m "feat(landing-v2): device quality tiers + frame governor logic"
```

---

### Task 3: Sky palette (`world/palette.ts`)

Night→dawn→morning color grade as pure, tested math (no three.js import).

**Files:**
- Create: `src/components/marketing/v2/world/palette.ts`
- Test: `tests/landing-palette.test.ts`

**Interfaces:**
- Consumes: `clamp01` from `../progress`.
- Produces: `interface SkyState { top: string; horizon: string; fog: string; ambient: number }`; `skyAt(story, after): SkyState`; `lerpHex(a, b, t): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/landing-palette.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-palette.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/marketing/v2/world/palette.ts
import { clamp01 } from "../progress";

/**
 * The sky grade for the whole shift on one timeline t ∈ [0, 2]:
 * t = story (0→1, night→dawn), then 1 + after (1→2, dawn→morning).
 * Pure string/number math so it unit-tests without three.js.
 */
export interface SkyState {
  top: string;
  horizon: string;
  fog: string;
  ambient: number;
}

interface Stop extends SkyState {
  at: number;
}

const STOPS: Stop[] = [
  { at: 0.0, top: "#050d0a", horizon: "#0a1a12", fog: "#050d0a", ambient: 0.18 },
  { at: 0.75, top: "#071310", horizon: "#123024", fog: "#06110d", ambient: 0.24 },
  { at: 1.0, top: "#0e2a20", horizon: "#d97b4a", fog: "#0d241c", ambient: 0.38 },
  { at: 1.5, top: "#7cc39a", horizon: "#f4c17e", fog: "#8fcfa9", ambient: 0.72 },
  { at: 2.0, top: "#cfeeda", horizon: "#f6fbf7", fog: "#dcf3e6", ambient: 1.0 },
];

export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff;
    const vb = (pb >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  const v = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${v.toString(16).padStart(6, "0")}`;
}

export function skyAt(story: number, after: number): SkyState {
  const t = story < 1 ? clamp01(story) : 1 + clamp01(after);
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].at <= t) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const f = clamp01((t - a.at) / (b.at - a.at));
  return {
    top: lerpHex(a.top, b.top, f),
    horizon: lerpHex(a.horizon, b.horizon, f),
    fog: lerpHex(a.fog, b.fog, f),
    ambient: a.ambient + (b.ambient - a.ambient) * f,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-palette.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/v2/world/palette.ts tests/landing-palette.test.ts
git commit -m "feat(landing-v2): night→dawn→morning sky palette (pure, tested)"
```

---

### Task 4: Camera path + shared math (`world/path.ts`)

**Files:**
- Create: `src/components/marketing/v2/world/path.ts`
- Test: `tests/landing-camera-path.test.ts`

**Interfaces:**
- Consumes: `clamp01` from `../progress`.
- Produces: `cameraAt(story): { pos: [number,number,number]; look: [number,number,number] }`; `smooth01(t): number` (smoothstep); `rand(i, salt): number` (deterministic pseudo-random in [0,1)). Scene components in Tasks 5–7 import `smooth01` and `rand` from here.

- [ ] **Step 1: Write the failing test**

```ts
// tests/landing-camera-path.test.ts
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
    expect(cameraAt(1).pos).toEqual([0, 2.0, 7.5]);
  });
  it("clamps outside [0,1]", () => {
    expect(cameraAt(-0.5)).toEqual(cameraAt(0));
    expect(cameraAt(1.5)).toEqual(cameraAt(1));
  });
  it("hits keyframes exactly", () => {
    expect(cameraAt(0.42).pos).toEqual([2.4, 0.8, 3.2]);
  });
  it("interpolates between keyframes", () => {
    const z = cameraAt(0.08).pos[2];
    expect(z).toBeLessThan(7);
    expect(z).toBeGreaterThan(4.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-camera-path.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/marketing/v2/world/path.ts
import { clamp01 } from "../progress";

/** Classic smoothstep. */
export function smooth01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Deterministic pseudo-random in [0,1) — keeps renders reproducible. */
export function rand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Vec3 = [number, number, number];

interface Key {
  at: number;
  pos: Vec3;
  look: Vec3;
}

/**
 * The camera's journey through the night, keyed to story progress.
 * Scene anchors: message corridor along -z at x≈0, calendar at [2.4, 0.3, 0],
 * lead orbit at [-2.6, 0.4, 0].
 */
const KEYS: Key[] = [
  { at: 0.0, pos: [0, 0.4, 7], look: [0, 0, 0] },
  { at: 0.16, pos: [0, 0.2, 4.2], look: [0, 0, -4] },
  { at: 0.28, pos: [0, 0.2, 1.5], look: [0, 0, -6] },
  { at: 0.42, pos: [2.4, 0.8, 3.2], look: [2.4, 0.2, 0] },
  { at: 0.62, pos: [-2.6, 1.0, 3.4], look: [-2.6, 0.3, 0] },
  { at: 0.84, pos: [0, 1.6, 6.2], look: [0, 0.6, 0] },
  { at: 1.0, pos: [0, 2.0, 7.5], look: [0, 0.8, 0] },
];

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function cameraAt(story: number): { pos: Vec3; look: Vec3 } {
  const t = clamp01(story);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].at <= t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const f = smooth01((t - a.at) / (b.at - a.at));
  return { pos: lerpVec(a.pos, b.pos, f), look: lerpVec(a.look, b.look, f) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx vitest run tests/landing-camera-path.test.ts`
Expected: PASS (7 tests). Note `cameraAt(0.42)` must return the keyframe exactly: `smooth01(0)`/`smooth01(1)` guarantee endpoints, and the bracketing loop lands `t===b.at` on `f=1`.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/v2/world/path.ts tests/landing-camera-path.test.ts
git commit -m "feat(landing-v2): scroll-driven camera path + shared scene math"
```

---

### Task 5: World shell — textures, sky, particles, camera rig, canvas (`world/`)

The persistent canvas with atmosphere. Scenes from Tasks 6–7 are stubbed OUT of `world.tsx` for now (their imports are added in their own tasks).

**Files:**
- Create: `src/components/marketing/v2/world/textures.ts`
- Create: `src/components/marketing/v2/world/sky.tsx`
- Create: `src/components/marketing/v2/world/particles.tsx`
- Create: `src/components/marketing/v2/world/camera-rig.tsx`
- Create: `src/components/marketing/v2/world/world.tsx`

**Interfaces:**
- Consumes: `shift` (progress.ts), `skyAt` (palette.ts), `cameraAt` (path.ts), `Quality/QUALITY/stepDown/shouldStepDown` (quality.ts).
- Produces: `makeRadialTexture(size?): THREE.CanvasTexture` and `makeBubbleTexture(text, outbound): { texture: THREE.CanvasTexture; aspect: number }` (textures.ts, used by Tasks 6–7); `<Sky/>`, `<Particles count/>`, `<CameraRig/>`; default export `World({ quality }: { quality: Quality })` (world.tsx, mounted by Task 8).

- [ ] **Step 1: Write `textures.ts`**

```ts
// src/components/marketing/v2/world/textures.ts
import * as THREE from "three";

/** Soft white radial glow — tint per-use via material.color. */
export function makeRadialTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.45, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const BUBBLE = {
  out: { bg: "#005c4b", fg: "#ffffff" },
  in: { bg: "#1f2c34", fg: "#f1f5f3" },
};

const FONT = "26px -apple-system, 'Segoe UI', Roboto, sans-serif";

/** WhatsApp-style chat bubble drawn to a canvas texture. */
export function makeBubbleTexture(
  text: string,
  outbound: boolean
): { texture: THREE.CanvasTexture; aspect: number } {
  const pad = 28;
  const lineH = 36;
  const maxW = 460;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = FONT;

  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);

  const textW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)));
  c.width = Math.ceil(textW + pad * 2);
  c.height = lines.length * lineH + pad * 2 - 6;

  const s = BUBBLE[outbound ? "out" : "in"];
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 20);
  ctx.fillStyle = s.bg;
  ctx.fill();
  ctx.font = FONT; // canvas resize resets 2D state
  ctx.fillStyle = s.fg;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, pad, pad - 8 + i * lineH));

  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 4;
  return { texture, aspect: c.width / c.height };
}
```

- [ ] **Step 2: Write `sky.tsx`**

```tsx
// src/components/marketing/v2/world/sky.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { shift } from "../progress";
import { skyAt } from "./palette";
import { makeRadialTexture } from "./textures";

/**
 * The sky: scene background + fog + a horizon glow sprite + lights, all
 * scrubbed by scroll every frame. This is what turns night into morning.
 */
export function Sky() {
  const { scene } = useThree();
  const colors = useMemo(() => {
    const bg = new THREE.Color("#050d0a");
    scene.background = bg;
    scene.fog = new THREE.FogExp2("#050d0a", 0.05);
    return { bg };
  }, [scene]);

  const glow = useRef<THREE.Sprite>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  useFrame(() => {
    const s = skyAt(shift.story, shift.after);
    colors.bg.set(s.top);
    (scene.fog as THREE.FogExp2).color.set(s.fog);
    if (glow.current) {
      const m = glow.current.material as THREE.SpriteMaterial;
      m.color.set(s.horizon);
      m.opacity = 0.45 + s.ambient * 0.35;
    }
    if (amb.current) amb.current.intensity = 0.4 + s.ambient * 1.2;
    if (sun.current) sun.current.intensity = s.ambient * 1.8;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <directionalLight ref={sun} position={[3, 5, 2]} intensity={0.4} />
      <sprite ref={glow} position={[0, -1.6, -16]} scale={[48, 18, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </>
  );
}
```

- [ ] **Step 3: Write `particles.tsx`** (evolved from the old nightfield; fades into sparse daylight motes)

```tsx
// src/components/marketing/v2/world/particles.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, shift } from "../progress";
import { rand } from "./path";

const PALETTE = ["#06c167", "#6fe3a8", "#37ce86", "#a9f0c9"];

/** The emerald night sky that thins into daylight motes as morning comes. */
export function Particles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.pow(rand(i, 11), 0.6) * 18;
      const angle = rand(i, 12) * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (rand(i, 13) - 0.35) * 8;
      pos[i * 3 + 2] = Math.sin(angle) * radius - 4;
      c.set(PALETTE[i % PALETTE.length]);
      const dim = 0.35 + rand(i, 14) * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p) return;
    p.rotation.y += delta * 0.016;
    const px = state.pointer.x * 0.12;
    const py = state.pointer.y * 0.06;
    p.rotation.x += (py - p.rotation.x) * 0.02;
    p.rotation.z += (px * 0.3 - p.rotation.z) * 0.02;
    if (material.current) {
      const day = shift.story >= 1 ? clamp01(shift.after) : 0;
      const twinkle = 0.75 + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
      material.current.opacity = twinkle * (1 - day * 0.7);
      material.current.size = 0.055 - day * 0.02;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={0.055}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
```

- [ ] **Step 4: Write `camera-rig.tsx`**

```tsx
// src/components/marketing/v2/world/camera-rig.tsx
"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { shift } from "../progress";
import { cameraAt } from "./path";

/** Drives the camera along the keyframed path, spring-damped, with a
 *  gentle pointer parallax on top. */
export function CameraRig() {
  const target = useMemo(
    () => ({ pos: new THREE.Vector3(0, 0.4, 7), look: new THREE.Vector3() }),
    []
  );

  useFrame(({ camera, pointer }) => {
    const k = cameraAt(shift.story);
    target.pos.set(k.pos[0] + pointer.x * 0.3, k.pos[1] + pointer.y * 0.15, k.pos[2]);
    camera.position.lerp(target.pos, 0.08);
    target.look.set(k.look[0], k.look[1], k.look[2]);
    camera.lookAt(target.look);
  });

  return null;
}
```

- [ ] **Step 5: Write `world.tsx`** (scenes from Tasks 6–7 NOT yet imported)

```tsx
// src/components/marketing/v2/world/world.tsx
"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { QUALITY, shouldStepDown, stepDown, type Quality } from "./quality";
import { Sky } from "./sky";
import { Particles } from "./particles";
import { CameraRig } from "./camera-rig";

/** Watches real frame times and sheds quality when they stay slow. */
function Governor({ onDegrade }: { onDegrade: () => void }) {
  const acc = { ms: 0, n: 0, cool: 0 };
  useFrame((_, delta) => {
    if (acc.cool > 0) {
      acc.cool -= delta;
      return;
    }
    acc.ms += delta * 1000;
    acc.n += 1;
    if (acc.n >= 90) {
      if (shouldStepDown(acc.ms / acc.n)) {
        onDegrade();
        acc.cool = 4; // let the new tier settle before judging again
      }
      acc.ms = 0;
      acc.n = 0;
    }
  });
  return null;
}

/**
 * The one persistent WebGL world behind the whole page. Opaque background
 * (the Sky owns it); DOM content scrolls above at z-10.
 */
export default function World({ quality: initial }: { quality: Quality }) {
  const [quality, setQuality] = useState(initial);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fn = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  return (
    <Canvas
      frameloop={hidden ? "never" : "always"}
      dpr={[1, quality.dprMax]}
      camera={{ position: [0, 0.4, 7], fov: 55 }}
      gl={{
        antialias: quality.tier === "high",
        alpha: false,
        powerPreference: "high-performance",
      }}
    >
      <Sky />
      <CameraRig />
      <Particles count={quality.particles} />
      {quality.tier !== "low" && (
        <Governor onDegrade={() => setQuality((q) => QUALITY[stepDown(q.tier)])} />
      )}
    </Canvas>
  );
}
```

Note: `Governor`'s accumulator is a plain object recreated on re-render — that's fine; it only re-renders when quality changes, which resets the measurement window intentionally.

- [ ] **Step 6: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: no errors. (These files aren't imported by any route yet, so no build change.)

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/v2/world/
git commit -m "feat(landing-v2): persistent world shell — sky grade, particles, camera rig, governor"
```

---

### Task 6: Message-stream scene (`world/message-stream.tsx`)

The 12:31 AM chapter: the camera flies through floating WhatsApp bubbles.

**Files:**
- Create: `src/components/marketing/v2/world/message-stream.tsx`
- Modify: `src/components/marketing/v2/world/world.tsx` (add scene)

**Interfaces:**
- Consumes: `makeBubbleTexture` (textures.ts), `shift`, `CHAPTERS` (progress.ts), `rand` (path.ts).
- Produces: `<MessageStream cards={number} />`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/marketing/v2/world/message-stream.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, shift } from "../progress";
import { rand } from "./path";
import { makeBubbleTexture } from "./textures";

/** Real conversations, alternating customer (in) and Front Desk (out). */
const THREAD: { out: boolean; text: string }[] = [
  { out: false, text: "Hi — do you have anything tomorrow evening?" },
  { out: true, text: "Yes! 7:30 PM with Dr. Mehta is open. Shall I book it?" },
  { out: false, text: "How much is a classic facial?" },
  { out: true, text: "₹1,800, about 50 minutes. Want Saturday 4 PM?" },
  { out: false, text: "Can I move my 11 AM to later this week?" },
  { out: true, text: "Done — Thursday 4 PM. Confirmation sent ✓" },
  { out: false, text: "Do you take insurance?" },
  { out: true, text: "We do — Star Health and HDFC Ergo. Bring your card." },
];

const CARD_H = 0.5;

/** The corridor of chat bubbles the camera flies through after midnight. */
export function MessageStream({ cards }: { cards: number }) {
  const group = useRef<THREE.Group>(null);

  const items = useMemo(
    () =>
      Array.from({ length: cards }, (_, i) => {
        const msg = THREAD[i % THREAD.length];
        const { texture, aspect } = makeBubbleTexture(msg.text, msg.out);
        return {
          texture,
          aspect,
          x: (msg.out ? 1 : -1) * (1.15 + rand(i, 1) * 0.9),
          y: -0.7 + rand(i, 2) * 1.9,
          z: -1.5 - i * 1.05,
          bob: 0.5 + rand(i, 3),
        };
      }),
    [cards]
  );

  useEffect(() => () => items.forEach((it) => it.texture.dispose()), [items]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = shift.story < CHAPTERS.book.end;
    if (!g.visible) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      child.position.y = items[i].y + Math.sin(t * items[i].bob + i) * 0.08;
    });
  });

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, it.z]}>
          <planeGeometry args={[CARD_H * it.aspect, CARD_H]} />
          <meshBasicMaterial map={it.texture} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Add the scene to `world.tsx`**

In `src/components/marketing/v2/world/world.tsx`, add the import and mount it after `<Particles …/>`:

```tsx
import { MessageStream } from "./message-stream";
```

```tsx
      <Particles count={quality.particles} />
      <MessageStream cards={quality.streamCards} />
```

- [ ] **Step 3: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/v2/world/message-stream.tsx src/components/marketing/v2/world/world.tsx
git commit -m "feat(landing-v2): message-stream flythrough scene (12:31 AM — it answers)"
```

---

### Task 7: Calendar + orbit scenes (`world/calendar.tsx`, `world/orbit.tsx`)

The 2:15 AM booking scene (calendar assembles, one slot locks in green) and the 4:40 AM chase scene (lead chips drift cold, get pulled back into orbit).

**Files:**
- Create: `src/components/marketing/v2/world/calendar.tsx`
- Create: `src/components/marketing/v2/world/orbit.tsx`
- Modify: `src/components/marketing/v2/world/world.tsx` (add both scenes)

**Interfaces:**
- Consumes: `shift`, `CHAPTERS`, `localProgress`, `clamp01` (progress.ts), `smooth01`, `rand` (path.ts), `makeBubbleTexture`, `makeRadialTexture` (textures.ts).
- Produces: `<CalendarScene />`, `<OrbitScene fx={boolean} />`.

- [ ] **Step 1: Write `calendar.tsx`**

```tsx
// src/components/marketing/v2/world/calendar.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";

const COLS = 7;
const ROWS = 5;
const CELL = 0.3;
const GAP = 0.075;
const CENTER = new THREE.Vector3(2.4, 0.3, 0); // camera looks here at 0.42
const STAR = 17; // the slot that gets booked

/** Scattered cells assemble into a month grid; one slot locks in, glowing. */
export function CalendarScene() {
  const group = useRef<THREE.Group>(null);
  const star = useRef<THREE.MeshStandardMaterial>(null);

  const cells = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          grid: new THREE.Vector3(
            CENTER.x + (col - (COLS - 1) / 2) * (CELL + GAP),
            CENTER.y + ((ROWS - 1) / 2 - row) * (CELL + GAP),
            CENTER.z
          ),
          scatter: new THREE.Vector3(
            CENTER.x + (rand(i, 4) - 0.5) * 7,
            CENTER.y + (rand(i, 5) - 0.5) * 5,
            CENTER.z - 1.5 - rand(i, 6) * 5
          ),
          delay: rand(i, 7) * 0.25,
          tilt: (rand(i, 8) - 0.5) * 2,
        };
      }),
    []
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible =
      shift.story > CHAPTERS.answer.end - 0.05 && shift.story < CHAPTERS.chase.end;
    if (!g.visible) return;
    const b = localProgress(shift.story, "book");
    g.children.forEach((child, i) => {
      const c = cells[i];
      const e = smooth01(clamp01((b - c.delay) / 0.6));
      child.position.lerpVectors(c.scatter, c.grid, e);
      const pop = i === STAR ? 1 + smooth01(clamp01((b - 0.75) / 0.2)) * 0.45 : 1;
      child.scale.setScalar(Math.max(e * pop, 0.0001));
      child.rotation.z = (1 - e) * c.tilt;
    });
    if (star.current) {
      const lock = smooth01(clamp01((b - 0.75) / 0.2));
      star.current.emissiveIntensity =
        lock * (1.4 + Math.sin(clock.elapsedTime * 4) * 0.3);
    }
  });

  return (
    <group ref={group} visible={false}>
      {cells.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[CELL, CELL, 0.05]} />
          {i === STAR ? (
            <meshStandardMaterial
              ref={star}
              color="#0f3527"
              emissive="#06c167"
              emissiveIntensity={0}
            />
          ) : (
            <meshStandardMaterial color="#11241c" emissive="#06c167" emissiveIntensity={0.04} />
          )}
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Write `orbit.tsx`**

```tsx
// src/components/marketing/v2/world/orbit.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeBubbleTexture, makeRadialTexture } from "./textures";

const LEADS = [
  "Priya — asked about the bridal package",
  "Rahul — wanted a root canal quote",
  "Aisha — Saturday slot, never confirmed",
  "Vikram — went quiet on Tuesday",
  "Meera — asked for the price list",
  "Arjun — wanted to reschedule",
  "Sana — follow-up due today",
  "Dev — no-show on Monday",
];

const CENTER = new THREE.Vector3(-2.6, 0.4, 0); // camera looks here at 0.62
const CHIP_H = 0.42;

/** Ghosted leads drift cold, then the chase pulls them back into orbit. */
export function OrbitScene({ fx }: { fx: boolean }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  const chips = useMemo(
    () =>
      LEADS.map((text, i) => {
        const { texture, aspect } = makeBubbleTexture(text, false);
        return {
          texture,
          aspect,
          angle: (i / LEADS.length) * Math.PI * 2,
          speed: 0.25 + rand(i, 9) * 0.2,
        };
      }),
    []
  );

  useEffect(() => () => chips.forEach((c) => c.texture.dispose()), [chips]);

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    g.visible = shift.story > CHAPTERS.book.end - 0.05 && shift.story < 0.98;
    if (!g.visible) return;
    const c = localProgress(shift.story, "chase");
    const drift = smooth01(clamp01(c / 0.45)); // leads going cold
    const pull = smooth01(clamp01((c - 0.45) / 0.55)); // the chase brings them back
    const radius = 1.15 + drift * 1.6 - pull * 1.7;
    const t = clock.elapsedTime;

    g.children.forEach((child, i) => {
      if (i >= chips.length) return; // the glow sprite
      const chip = chips[i];
      const a = chip.angle + t * chip.speed * (0.15 + pull);
      child.position.set(
        CENTER.x + Math.cos(a) * radius,
        CENTER.y + Math.sin(a) * radius * 0.45,
        CENTER.z + Math.sin(a * 1.3) * 0.4
      );
      child.lookAt(camera.position);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 0.95 - drift * 0.6 + pull * 0.6;
    });

    if (glow.current) {
      (glow.current.material as THREE.SpriteMaterial).opacity = fx
        ? 0.35 + pull * 0.35
        : 0.3;
    }
  });

  return (
    <group ref={group} visible={false}>
      {chips.map((chip, i) => (
        <mesh key={i}>
          <planeGeometry args={[CHIP_H * chip.aspect, CHIP_H]} />
          <meshBasicMaterial map={chip.texture} transparent opacity={0.95} />
        </mesh>
      ))}
      <sprite ref={glow} position={[CENTER.x, CENTER.y, CENTER.z]} scale={[2.6, 2.6, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#06c167"
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
```

- [ ] **Step 3: Add both scenes to `world.tsx`**

```tsx
import { CalendarScene } from "./calendar";
import { OrbitScene } from "./orbit";
```

```tsx
      <MessageStream cards={quality.streamCards} />
      <CalendarScene />
      <OrbitScene fx={quality.fx} />
```

- [ ] **Step 4: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/v2/world/calendar.tsx src/components/marketing/v2/world/orbit.tsx src/components/marketing/v2/world/world.tsx
git commit -m "feat(landing-v2): calendar-assembly and lead-orbit scenes (it books, it chases)"
```

---

### Task 8: Experience orchestrator; retarget DayRail; slim the hero; delete `nightfield.tsx`

**Files:**
- Create: `src/components/marketing/v2/experience.tsx`
- Modify: `src/components/marketing/v2/ambient.tsx` (DayRail clock → shared `shiftClock`; day-theme classes)
- Modify: `src/components/marketing/v2/hero-v2.tsx` (drop its own canvas/section background — the world owns atmosphere now)
- Delete: `src/components/marketing/v2/nightfield.tsx`

**Interfaces:**
- Consumes: `SmoothScroll`, `Grain`/`CursorAura`/`DayRail`, `ScrollTrigger`/`motionAllowed` (gsap.ts), `shift` (progress.ts), `detectQuality`/`webglSupported` (quality.ts), `World` (world.tsx).
- Produces: `<Experience />` — the single client mount for scroll + canvas, used by `page.tsx` (Task 11). Expects the DOM to contain `[data-shift]` (page wrapper), `#night-shift` (track) and `#morning` (payoff section) — created in Tasks 9–11.

- [ ] **Step 1: Write `experience.tsx`**

```tsx
// src/components/marketing/v2/experience.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SmoothScroll } from "./smooth-scroll";
import { CursorAura, DayRail, Grain } from "./ambient";
import { ScrollTrigger, motionAllowed } from "./gsap";
import { shift } from "./progress";
import { detectQuality, webglSupported, type Quality } from "./world/quality";

const World = dynamic(() => import("./world/world"), { ssr: false });

/**
 * The one client orchestrator for the Night Shift page:
 *  - Lenis smooth scroll (SmoothScroll)
 *  - the three ScrollTriggers that write the shared `shift` refs
 *  - the day/night attribute flip on the [data-shift] page wrapper
 *  - the persistent WebGL world, mounted on idle when motion + WebGL allow
 */
export function Experience() {
  const [quality, setQuality] = useState<Quality | null>(null);

  useEffect(() => {
    if (!motionAllowed() || !webglSupported()) return;
    const idle =
      "requestIdleCallback" in window
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 2000 })
        : (cb: () => void) => setTimeout(cb, 300);
    idle(() => setQuality(detectQuality()));
  }, []);

  useEffect(() => {
    if (!motionAllowed()) return;
    const root = document.querySelector<HTMLElement>("[data-shift]");
    const track = document.getElementById("night-shift");
    const morning = document.getElementById("morning");
    const triggers = [
      ScrollTrigger.create({
        start: 0,
        end: () => document.documentElement.scrollHeight - window.innerHeight,
        onUpdate: (s) => {
          shift.page = s.progress;
        },
      }),
      track &&
        ScrollTrigger.create({
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (s) => {
            shift.story = s.progress;
            root?.setAttribute("data-shift", s.progress > 0.96 ? "day" : "night");
          },
        }),
      morning &&
        ScrollTrigger.create({
          trigger: morning,
          start: "top bottom",
          endTrigger: document.body,
          end: "bottom bottom",
          onUpdate: (s) => {
            shift.after = s.progress;
          },
        }),
    ].filter(Boolean) as ScrollTrigger[];
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return (
    <>
      <SmoothScroll />
      <Grain />
      <CursorAura />
      <DayRail />
      {quality && (
        <div className="fixed inset-0 z-0" aria-hidden>
          <World quality={quality} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Retarget the DayRail clock in `ambient.tsx`**

Delete the local `SHIFT_START_MIN` constant and `shiftTime` function (lines 67–77). Add to the imports at the top:

```tsx
import { shift, shiftClock } from "./progress";
```

In `DayRail`'s `ScrollTrigger.create` `onUpdate`, replace `label.textContent = shiftTime(self.progress);` with:

```tsx
        label.textContent = shiftClock(shift.story, shift.after);
```

and replace the initial `label.textContent = shiftTime(0);` with:

```tsx
    label.textContent = shiftClock(0, 0);
```

Make the rail readable in the daylight zone — in `DayRail`'s JSX swap these class strings (adds `day:` variants, defined in Task 10):
- both `text-white/30` spans → `text-white/30 day:text-ink/40`
- the rail `bg-white/10` div → `bg-white/10 day:bg-ink/15`
- the time label `text-brand-200/80` → `text-brand-200/80 day:text-brand-700`

- [ ] **Step 3: Slim `hero-v2.tsx`** — replace the whole file with:

```tsx
// src/components/marketing/v2/hero-v2.tsx
"use client";

import { useRef } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ButtonLink } from "../button";
import { Magnetic } from "../motion-primitives";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — 11:47 PM. The headline is server HTML (it IS the LCP element); the
 * persistent world (mounted by Experience) provides the sky behind it, so
 * this section is transparent. bg-mesh remains as the designed no-WebGL look.
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-eyebrow", { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
        .from(".hero-line", { yPercent: 112, duration: 1.1, stagger: 0.12 }, 0.15)
        .from(".hero-sub", { autoAlpha: 0, y: 18, duration: 0.8 }, 0.55)
        .from(".hero-ctas", { autoAlpha: 0, y: 16, duration: 0.8 }, 0.7)
        .from(".hero-chips", { autoAlpha: 0, duration: 0.9 }, 0.85)
        .from(".hero-cue", { autoAlpha: 0, duration: 0.9 }, 1.0);

      gsap.to(".hero-copy", {
        yPercent: -14,
        autoAlpha: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* aurora mesh — the designed fallback when the world can't render */}
      <div className="bg-mesh absolute inset-0 opacity-40" aria-hidden />

      {/* vignette so type always sits on solid night */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(5,13,10,0.7) 100%)",
        }}
      />

      {/* copy */}
      <div className="hero-copy relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-32 sm:px-8">
        <p className="hero-eyebrow flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-200/80">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
          </span>
          11:47 PM — your shop closed five hours ago
        </p>

        <h1 className="mt-7 font-display text-[clamp(3.1rem,9vw,7.25rem)] leading-[0.96] tracking-tight text-white">
          <span className="block overflow-hidden pb-1">
            <span className="hero-line block">Your best employee</span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="hero-line block italic text-brand-300">
              doesn&rsquo;t sleep.
            </span>
          </span>
        </h1>

        <p className="hero-sub mt-7 max-w-xl text-lg leading-relaxed text-white/60">
          Nudge&rsquo;s AI Front Desk answers, books, and follows up on
          WhatsApp — set up for you, for a third of a salary. It works the
          hours you can&rsquo;t.
        </p>

        <div className="hero-ctas mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Magnetic>
            <ButtonLink href="/waitlist" size="lg">
              Hire your Front Desk
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </ButtonLink>
          </Magnetic>
          <ButtonLink href="#night-shift" variant="secondary-dark" size="lg">
            Watch the night shift
            <ArrowDown className="h-4 w-4" />
          </ButtonLink>
        </div>

        <ul className="hero-chips mt-12 flex flex-wrap gap-x-8 gap-y-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          <li>Books real appointments</li>
          <li>Chases quiet leads</li>
          <li>Set up for you</li>
        </ul>
      </div>

      {/* scroll cue */}
      <div className="hero-cue absolute bottom-7 left-1/2 z-10 -translate-x-1/2" aria-hidden>
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-white/15 p-1.5">
          <span className="h-1.5 w-[3px] animate-bounce rounded-full bg-brand-300" />
        </div>
      </div>
    </section>
  );
}
```

(Removed vs the old file: `bg-night` on the section, the dynamic `Nightfield` import + `mount3d`/`active3d`/IntersectionObserver state, and the ambient `<video>` layer — the persistent world replaces all three. The optional `a1-hero-loop` video asset is superseded; note it in the commit message.)

- [ ] **Step 4: Delete the superseded canvas**

```bash
git rm src/components/marketing/v2/nightfield.tsx
```

- [ ] **Step 5: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: clean (nothing imports `nightfield` anymore; `experience.tsx` isn't referenced by a route yet).

- [ ] **Step 6: Commit**

```bash
git add -A src/components/marketing/v2/
git commit -m "feat(landing-v2): Experience orchestrator; DayRail on shift clock; hero hands atmosphere to the world (drops nightfield + hero video layer)"
```

---

### Task 9: The pinned night-shift chapters (`chapters/night-shift.tsx`)

**Files:**
- Create: `src/components/marketing/v2/chapters/night-shift.tsx`
- Modify: `src/app/globals.css` (one added block)

**Interfaces:**
- Consumes: `gsap`/`useGSAP`/`motionAllowed` (gsap.ts), `CHAPTERS` (progress.ts). CSS classes `.ns-track`, `.ns-stage`, `.ns-beat` (already in globals.css).
- Produces: `<NightShift />` with `id="night-shift"` — the element Experience's story ScrollTrigger targets.

- [ ] **Step 1: Add the beat-positioning CSS to `globals.css`**

Append inside the existing "Landing v2" block (after the `.jsm .ns-dawn` rule):

```css
/* Beats stack in normal flow by default (no-JS); under .jsm they overlap
   in the sticky stage and the scrub crossfades them. GSAP owns yPercent. */
.jsm .ns-beat {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
}
```

(The existing `.jsm .ns-beat { opacity: 0 }` rule stays — both apply.)

- [ ] **Step 2: Write the component**

```tsx
// src/components/marketing/v2/chapters/night-shift.tsx
"use client";

import { useRef } from "react";
import { CHAPTERS } from "../progress";
import { gsap, motionAllowed, useGSAP } from "../gsap";

/** DOM copy for the four night chapters, timed to the same story spans the
 *  3D scenes use, so words and world stay in lockstep. */
const BEATS = [
  {
    time: "12:31 AM",
    title: "It answers.",
    body: "A customer writes at half past midnight. The Front Desk replies in seconds — your services, your prices, your tone. No 'we'll get back to you.'",
  },
  {
    time: "2:15 AM",
    title: "It books.",
    body: "Not 'we open at 10.' It checks your real calendar, locks the slot, and sends the confirmation — booked while you sleep.",
  },
  {
    time: "4:40 AM",
    title: "It chases.",
    body: "The lead that went quiet on Tuesday gets a follow-up worth answering. Meta's free AI can't start that conversation. Yours can.",
  },
  {
    time: "6:48 AM",
    title: "It collects.",
    body: "Payment link sent, deposit in, reminder scheduled. The night's work is already revenue before you're awake.",
  },
];

export function NightShift() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const beats = gsap.utils.toArray<HTMLElement>(".ns-beat");
      gsap.set(beats, { yPercent: -50 });
      const spans = Object.values(CHAPTERS);
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
        },
      });
      beats.forEach((beat, i) => {
        const c = spans[i];
        tl.fromTo(
          beat,
          { autoAlpha: 0, y: 60 },
          { autoAlpha: 1, y: 0, duration: 0.1 },
          c.start + 0.03
        ).to(beat, { autoAlpha: 0, y: -50, duration: 0.08 }, c.end - 0.06);
      });
    },
    { scope: ref }
  );

  return (
    <section
      id="night-shift"
      ref={ref}
      className="ns-track relative"
      aria-label="What the Front Desk does overnight"
    >
      <div className="ns-stage">
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          {BEATS.map((b) => (
            <article key={b.time} className="ns-beat max-w-xl py-16 lg:py-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-200/80">
                {b.time}
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] text-white">
                {b.title}
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
                {b.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Note the GSAP timing math: with `scrub`, timeline positions normalize over the track scroll; using each chapter's `start`/`end` (0.28/0.55/0.8) as insertion times keeps DOM beats synchronized with the 3D scenes driven by the same `CHAPTERS`.

- [ ] **Step 3: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/v2/chapters/night-shift.tsx src/app/globals.css
git commit -m "feat(landing-v2): pinned night-shift chapters synced to the world's timeline"
```

---

### Task 10: Morning payoff, FloatCard, theme variants, navbar/logo night styling

**Files:**
- Create: `src/components/marketing/v2/chapters/morning.tsx`
- Create: `src/components/marketing/v2/float-card.tsx`
- Modify: `src/app/globals.css` (custom variants + daycard + page gradient + glass override)
- Modify: `src/components/marketing/navbar.tsx` (night-variant classes)
- Modify: `src/components/marketing/logo.tsx` (wordmark flips white at night)

**Interfaces:**
- Consumes: `CountUp` (motion-primitives), `cn` (`@/lib/cn`), gsap.ts helpers.
- Produces: `<Morning />` with `id="morning"` (Experience's `after` trigger); `<FloatCard className?>{children}</FloatCard>`; Tailwind variants `night:` / `day:` scoped under `[data-shift="…"]`; CSS classes `.v2-daycard`, `.v2-page`.

- [ ] **Step 1: Add CSS to `globals.css`**

Custom variants go near the top, right after the `@theme` block closes:

```css
/* Landing v2 theme variants — scoped under the [data-shift] page wrapper. */
@custom-variant night (&:where([data-shift="night"], [data-shift="night"] *));
@custom-variant day (&:where([data-shift="day"], [data-shift="day"] *));
```

Append to the "Landing v2" block at the bottom:

```css
/* Static night→day gradient behind everything: THE page background for
   no-JS / reduced-motion / no-WebGL. The opaque canvas covers it when the
   world is running. */
.v2-page {
  background: linear-gradient(
    to bottom,
    #050d0a 0%,
    #071310 34%,
    #0e2a20 44%,
    #d97b4a 50%,
    #f4c17e 54%,
    #f6fbf7 64%,
    #f6fbf7 100%
  );
}

/* Daylight sections float as cards inside the world. */
.v2-daycard {
  margin-inline: auto;
  max-width: 82rem;
  border-radius: 2.5rem;
  border: 1px solid rgba(10, 15, 13, 0.06);
  background: rgba(246, 251, 247, 0.94);
  box-shadow: 0 30px 80px -40px rgba(5, 13, 10, 0.35);
}
@supports (backdrop-filter: blur(1px)) {
  .v2-daycard {
    background: rgba(246, 251, 247, 0.88);
    backdrop-filter: blur(14px);
  }
}

/* Navbar glass pill on the night side */
[data-shift="night"] .glass {
  background: rgba(8, 18, 13, 0.6);
  border-color: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 2: Write `float-card.tsx`**

```tsx
// src/components/marketing/v2/float-card.tsx
"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/** Daylight-zone wrapper: a floating card that tilts up into view on scroll. */
export function FloatCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed() || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: 44, rotateX: 3, transformPerspective: 900 },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 84%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={cn("v2-reveal v2-daycard overflow-hidden", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write `morning.tsx`**

```tsx
// src/components/marketing/v2/chapters/morning.tsx
import { CountUp } from "../../motion-primitives";

const STATS: { to: number; prefix?: string; label: string }[] = [
  { to: 6, label: "appointments booked" },
  { to: 11, label: "quiet leads chased" },
  { to: 4300, prefix: "₹", label: "collected in deposits" },
  { to: 0, label: "messages missed" },
];

/** 9:00 AM — the payoff. What the owner walks into after one shift. */
export function Morning() {
  return (
    <section
      id="morning"
      className="relative px-4 py-28 sm:px-6"
      aria-label="The morning after"
    >
      <div className="v2-daycard px-6 py-16 text-center sm:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-700">
          9:00 AM — you just walked in
        </p>
        <h2 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[1.02] text-ink">
          You slept. <span className="italic text-brand-600">It didn&rsquo;t.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink/60">
          One night like this, every night. Here&rsquo;s what a shift hands you
          at open:
        </p>
        <dl className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <dd className="font-display text-5xl text-ink">
                <CountUp to={s.to} prefix={s.prefix ?? ""} />
              </dd>
              <dt className="mt-2 text-sm text-ink/55">{s.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-xs text-ink/35">
          Illustrative shift for a two-chair clinic on the AI Front Desk plan.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Night-variant the navbar and logo**

In `src/components/marketing/navbar.tsx`, make these exact class replacements:
- Desktop link `<a>` (line ~58): `"rounded-full px-3.5 py-2 text-[14.5px] font-medium text-ink/70 transition-colors hover:bg-black/5 hover:text-ink"` → `"rounded-full px-3.5 py-2 text-[14.5px] font-medium text-ink/70 transition-colors hover:bg-black/5 hover:text-ink night:text-white/70 night:hover:bg-white/10 night:hover:text-white"`
- Mobile toggle button (line ~95): `"grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-black/5 md:hidden"` → `"grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-black/5 night:text-white night:hover:bg-white/10 md:hidden"`

(The mobile menu panel is solid `bg-white` and stays readable on both themes; the `.glass` pill override was added in Step 1.)

In `src/components/marketing/logo.tsx`, change the wordmark ternary:

```tsx
          tone === "light" ? "text-ink night:text-white" : "text-white"
```

- [ ] **Step 5: Type-check and lint**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/v2/chapters/morning.tsx src/components/marketing/v2/float-card.tsx src/app/globals.css src/components/marketing/navbar.tsx src/components/marketing/logo.tsx
git commit -m "feat(landing-v2): morning payoff, floating daylight cards, night/day theme variants"
```

---

### Task 11: Rewrite `page.tsx` — the new landing goes live

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: everything above, plus surviving v1 sections: `Navbar`, `MetaVsNudge`, `SalaryCalculator`, `Industries`, `FeaturesBento`, `ResellerCTA`, `Pricing`, `FAQ`, `FinalCTA`, `Footer`.

- [ ] **Step 1: Replace `src/app/page.tsx` with:**

```tsx
import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { SalaryCalculator } from "@/components/marketing/salary-calculator";
import { Industries } from "@/components/marketing/industries";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { ResellerCTA } from "@/components/marketing/reseller-cta";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { MotionGate } from "@/components/marketing/v2/motion-gate";
import { Experience } from "@/components/marketing/v2/experience";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";
import { NightShift } from "@/components/marketing/v2/chapters/night-shift";
import { Morning } from "@/components/marketing/v2/chapters/morning";
import { FloatCard } from "@/components/marketing/v2/float-card";

export const metadata: Metadata = {
  title: "Nudge — the AI Front Desk that runs your WhatsApp",
  description:
    "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk runs it — books into your real calendar, chases every lead that goes quiet, collects payments, and we set the whole thing up. It's not software. It's your best employee, for a third of the salary.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nudge — your AI Front Desk on WhatsApp",
    description:
      "It books real appointments, chases quiet leads and collects payments on WhatsApp — set up for you. A third of a front-desk salary, and it never sleeps.",
    type: "website",
  },
};

/**
 * The Night Shift. One page, one 24-hour shift: scroll is time. A persistent
 * WebGL world (Experience) grades from 11:47 PM night to 9:00 AM morning
 * behind server-rendered copy. Without JS/WebGL/motion, .v2-page's gradient
 * and the default-visible CSS produce the complete static story.
 */
export default function Home() {
  return (
    <div data-shift="night" className="v2-page">
      <MotionGate />
      <Navbar />
      <Experience />
      <main className="relative z-10 overflow-x-clip">
        {/* THE NIGHT — 11:47 PM → dawn */}
        <HeroV2 />
        <NightShift />
        {/* THE MORNING — the payoff, then the daylight zone */}
        <Morning />
        <div className="space-y-10 px-4 pb-24 sm:px-6">
          <FloatCard>
            <MetaVsNudge />
          </FloatCard>
          <FloatCard>
            <SalaryCalculator />
          </FloatCard>
          <FloatCard>
            <Industries />
          </FloatCard>
          <FloatCard>
            <FeaturesBento />
          </FloatCard>
          <FloatCard>
            <ResellerCTA />
          </FloatCard>
          <FloatCard>
            <Pricing />
          </FloatCard>
          <FloatCard>
            <FAQ />
          </FloatCard>
          <FloatCard>
            <FinalCTA />
          </FloatCard>
        </div>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run build`
Expected: build succeeds; `/` is statically generated.

- [ ] **Step 3: Smoke-test in the browser**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run dev` (background), open http://localhost:3000 and confirm: hero renders on night sky, scrolling pins the night-shift track and crossfades the four beats, the sky grades to dawn near the track's end, the morning card shows counters, daylight sections float in as cards, navbar links flip from white to ink at the day boundary, DayRail clock runs 11:47 PM → 9:00 AM. Kill the dev server after.

- [ ] **Step 4: Run all tests + lint, commit**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run test && npm run lint`
Expected: all pass.

```bash
git add src/app/page.tsx
git commit -m "feat(landing-v2): the Night Shift goes live — one persistent 3D world, scroll is time"
```

---

### Task 12: Delete dead v1 components; point the old direction doc at the spec

**Files:**
- Delete (after verifying zero references): `src/components/marketing/hero.tsx`, `src/components/marketing/social-proof.tsx`, `src/components/marketing/agent-conversation.tsx`, `src/components/marketing/roi-calculator.tsx`, `src/components/marketing/pricing-tiers.tsx`
- Modify: `docs/LANDING_V2_DIRECTION.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: Verify each file is unreferenced, then delete**

```bash
for f in hero social-proof agent-conversation roi-calculator pricing-tiers; do
  echo "== $f =="; grep -rn "marketing/$f\"" src/ | grep -v "src/components/marketing/$f.tsx" || echo "no references"
done
```

Expected: `no references` for every file (hero/social-proof were only used by the old `page.tsx`). If anything shows a reference, STOP and investigate instead of deleting. Then:

```bash
git rm src/components/marketing/hero.tsx src/components/marketing/social-proof.tsx src/components/marketing/agent-conversation.tsx src/components/marketing/roi-calculator.tsx src/components/marketing/pricing-tiers.tsx
```

Note: `whatsapp-card.tsx` and `lead-form.tsx` are used by `/waitlist` — do NOT delete them.

- [ ] **Step 2: Replace the truncated direction doc**

Replace the entire contents of `docs/LANDING_V2_DIRECTION.md` with:

```markdown
# LANDING v2 — direction

Superseded. The approved design lives in
`docs/superpowers/specs/2026-07-06-landing-3d-design.md`; the implementation
plan in `docs/superpowers/plans/2026-07-06-landing-3d-night-shift.md`.
Concept in one line: the page is one 24-hour shift — scroll is time,
11:47 PM → 9:00 AM, one persistent WebGL world, all copy server-rendered.
```

- [ ] **Step 3: Update `PROGRESS.md`**

Add an entry at the top of the log (match the file's existing entry format):
"Landing v2 — the Night Shift shipped: one persistent R3F world (sky grade, camera path, message/calendar/orbit scenes), pinned chapter story, morning payoff, daylight sections as floating cards; adaptive quality tiers + frame governor; static night→day gradient fallback for no-JS/reduced-motion/no-WebGL; dead v1 landing components removed."

- [ ] **Step 4: Verify green, commit**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run test && npm run lint && npm run build`
Expected: all pass.

```bash
git add -A
git commit -m "chore(landing-v2): remove dead v1 landing components; docs point at the approved spec"
```

---

### Task 13: End-to-end verification (desktop, mobile, reduced-motion)

**Files:** none created — this is behavioral verification with fixes applied as found. Use the `verify` skill's discipline: drive the real page, observe, fix, re-drive.

- [ ] **Step 1: Start the dev server**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run dev` (background).

- [ ] **Step 2: Desktop pass (Chrome via claude-in-chrome tools, viewport ≥1280px)**

Scroll the full page top to bottom and verify each, fixing anything broken before moving on:
1. Hero paints immediately (server HTML) before the canvas fades in.
2. The night-shift track pins; the four beats crossfade in order; the 3D scenes (bubbles → calendar → orbit) appear in their chapters.
3. Sky grades night → dawn → morning; no flash of wrong color.
4. DayRail clock reads 11:47 PM at top, ~6:48 AM at the track's end, 9:00 AM at the bottom.
5. Navbar text flips white → ink at the day boundary and remains readable at every scroll position.
6. Daylight cards animate in; anchors from the navbar (`#pricing`, `#faq`, …) glide to their sections.
7. No console errors; scrolling stays smooth (no long-task jank warnings).

- [ ] **Step 3: Mobile pass (device emulation, e.g. 390×844)**

Repeat the scroll pass. Additionally verify: the canvas renders (mobile is NOT gated off), touch scrolling stays native-feeling, the pinned track works with the shorter 420vh height, and text is legible at every chapter.

- [ ] **Step 4: Reduced-motion / no-WebGL pass**

Emulate `prefers-reduced-motion: reduce` (DevTools rendering settings) and hard-reload: NO canvas mounts, NO pinning (track is normal flow), all four beats and every section fully visible and readable against the `.v2-page` static gradient. Confirm the same page also renders complete with JavaScript disabled.

- [ ] **Step 5: Kill the dev server, final green run, handoff**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && npm run test && npm run lint && npm run build`
Expected: all pass. Commit any fixes made during verification with messages like `fix(landing-v2): <what the scroll pass surfaced>`. Then use the superpowers:finishing-a-development-branch skill to decide merge/PR.

---

## Self-review notes (already applied)

- Spec coverage: persistent world (T5–8), scroll=time+clock (T1, T8), chapters (T6, T7, T9), morning payoff (T10), daylight cards (T10–11), adaptive quality both platforms (T2, T5), fallbacks (T9–11 CSS + motion gate), deletions (T8, T12), tests (T1–4), invariants untouched (no module code in any task).
- Type consistency: `shift`/`CHAPTERS`/`localProgress` (T1) are consumed with those exact names in T5–9; `smooth01`/`rand` live in `path.ts` (T4) and are imported from there in T5–7; `Quality` shape matches between T2 and T5/T8.
- The `after === 0` edge: `skyAt(1, 0)` (dawn) only renders once story hits 1, at which point the morning trigger ("top bottom") has already begun feeding `after` — no visual dead zone.
