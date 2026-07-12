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

/** Answers keeps the original camera flight the founder preferred. */
const ANSWER_KEYS: Key[] = [
  { at: 0.0, pos: [0, 0.4, 7], look: [0, 0, 0] },
  { at: 0.06, pos: [0, 0.3, 4], look: [0.7, 0.1, -4] },
  { at: 0.28, pos: [0.4, 0.2, -31], look: [1.0, 0.1, -38] },
];

/** The other three chapters snap to one fixed frame and never zoom. */
const BOOK = { pos: [0, 0.5, -32.8] as Vec3, look: [1.0, 0.25, -38] as Vec3 };
const CHASE = { pos: [0, 0.5, -37.5] as Vec3, look: [-2.0, 0.1, -46] as Vec3 };
const COLLECT = { pos: [0, 0, -47] as Vec3, look: [-0.9, -0.4, -54] as Vec3 };

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function cameraAt(story: number): { pos: Vec3; look: Vec3 } {
  const t = clamp01(story);
  if (t >= 0.8) return COLLECT;
  if (t >= 0.55) return CHASE;
  if (t >= 0.28) return BOOK;

  let i = 0;
  while (i < ANSWER_KEYS.length - 2 && ANSWER_KEYS[i + 1].at <= t) i++;
  const a = ANSWER_KEYS[i];
  const b = ANSWER_KEYS[i + 1];
  const f = smooth01((t - a.at) / (b.at - a.at));
  return { pos: lerpVec(a.pos, b.pos, f), look: lerpVec(a.look, b.look, f) };
}
