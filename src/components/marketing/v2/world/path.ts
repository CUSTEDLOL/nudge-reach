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
 * The camera's journey through the night — one continuous flight forward,
 * never doubling back. Scene anchors along the route: message corridor
 * z −2…−30, calendar at [2.4, 0.3, −38], lead orbit at [−2.6, 0.4, −46],
 * the dawn "collects" stack at [1.3, 0.8, −54].
 */
const KEYS: Key[] = [
  { at: 0.0, pos: [0, 0.4, 7], look: [0, 0, 0] },
  { at: 0.06, pos: [0, 0.3, 4], look: [0.7, 0.1, -4] },
  // ride the whole message thread to its end
  { at: 0.28, pos: [0.4, 0.2, -31], look: [1.0, 0.1, -38] },
  // the calendar tableau, right-of-center…
  { at: 0.4, pos: [1.6, 0.7, -34.4], look: [3.1, 0.3, -38] },
  // …hold on it and push in while the slot locks
  { at: 0.54, pos: [2.0, 0.55, -35.6], look: [3.05, 0.3, -38] },
  // swing forward to the orbit
  { at: 0.64, pos: [-4.3, 0.9, -42.2], look: [-2.3, 0.3, -46] },
  // rise toward dawn and frame the collects stack
  { at: 0.8, pos: [-2.0, 1.1, -46.5], look: [0.4, 0.5, -52] },
  { at: 0.9, pos: [-0.4, 1.3, -48.5], look: [1.3, 0.7, -54] },
  { at: 1.0, pos: [0, 2.0, -51], look: [0.6, 0.9, -57] },
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
