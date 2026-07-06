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
