/**
 * The scroll spine of the Night Shift page: story-progress spans for the
 * four night chapters. Both scrubbed layers of the pinned #night-shift
 * track — the copy rail (chapters/night-shift.tsx) and the WhatsApp phone
 * (chapters/phone.tsx) — time themselves off these spans, so words and
 * conversation stay in lockstep. Must tile [0, 1].
 */
export const CHAPTERS = {
  answer: { start: 0.0, end: 0.28 },
  book: { start: 0.28, end: 0.55 },
  chase: { start: 0.55, end: 0.8 },
  dawn: { start: 0.8, end: 1.0 },
} as const;
export type ChapterName = keyof typeof CHAPTERS;
