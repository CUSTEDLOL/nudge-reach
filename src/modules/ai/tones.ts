/**
 * Client-safe reply-tone constants for the inbox AI assist (spec §M2).
 * Kept free of any server imports so the composer (a client component) can
 * import the tone list without dragging the server-only suggest-reply module
 * — and its env/db/model-router deps — into the browser bundle.
 */

export const SUGGEST_TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "short", label: "Short" },
  { value: "persuasive", label: "Persuasive" },
] as const;

export type SuggestTone = (typeof SUGGEST_TONES)[number]["value"];

export function isSuggestTone(value: string): value is SuggestTone {
  return SUGGEST_TONES.some((t) => t.value === value);
}
