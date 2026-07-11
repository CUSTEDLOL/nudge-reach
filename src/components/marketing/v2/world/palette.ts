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
  // The canvas stays genuinely white. Time is carried by the horizon light,
  // object colour and the shift clock instead of tinting the whole page.
  { at: 0.0, top: "#ffffff", horizon: "#8ee8b7", fog: "#ffffff", ambient: 0.9 },
  { at: 0.75, top: "#ffffff", horizon: "#b2efd0", fog: "#ffffff", ambient: 0.92 },
  { at: 1.0, top: "#ffffff", horizon: "#edb966", fog: "#ffffff", ambient: 0.94 },
  { at: 1.3, top: "#ffffff", horizon: "#f6d9a4", fog: "#ffffff", ambient: 0.97 },
  { at: 2.0, top: "#ffffff", horizon: "#ffffff", fog: "#ffffff", ambient: 1.0 },
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
