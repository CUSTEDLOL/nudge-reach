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
 * Four stable, straight-on chapter framings. The duplicated keys hold the
 * camera still while a scene plays; short gaps between chapters create a
 * restrained hand-off instead of zooming through the content.
 */
const KEYS: Key[] = [
  // Answers — one centred message thread, no fly-through.
  { at: 0.0, pos: [0, 0.35, 4], look: [-1.2, 0.1, -6] },
  { at: 0.25, pos: [0, 0.35, 4], look: [-1.2, 0.1, -6] },
  // Books — the calendar is held flat and at a comfortable distance.
  { at: 0.3, pos: [0, 0.5, -28], look: [0.75, 0.25, -38] },
  { at: 0.52, pos: [0, 0.5, -28], look: [0.75, 0.25, -38] },
  // Chases — framed wider so all lead chips remain inside the browser.
  { at: 0.58, pos: [0, 0.55, -34], look: [-5.0, 0.15, -46] },
  { at: 0.76, pos: [0, 0.55, -34], look: [-5.0, 0.15, -46] },
  // Collects — a straight, centred message stack with no final push-in.
  { at: 0.82, pos: [0, 0.8, -42], look: [-1.8, 0.55, -54] },
  { at: 1.0, pos: [0, 0.8, -42], look: [-1.8, 0.55, -54] },
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
