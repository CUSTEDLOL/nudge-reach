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
  { at: 0.16, pos: [0, 0.2, 4.4], look: [0.6, 0.1, -4] },
  { at: 0.28, pos: [0, 0.2, 1.8], look: [0.8, 0, -6] },
  { at: 0.42, pos: [1.2, 0.7, 3.6], look: [2.6, 0.3, 0] },
  { at: 0.62, pos: [-4.3, 0.9, 3.8], look: [-2.3, 0.3, 0] },
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
