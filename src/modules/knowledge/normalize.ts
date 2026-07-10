/**
 * Normalized dedupe key so ten phrasings of one customer question become one
 * OwnerQuestion ("Do you have chicken?!" ≡ "is there chicken"). Pure,
 * unit-tested. Deliberately simple — no AI, no stemming; good-enough collisions
 * beat clever misses here.
 */
const FILLER =
  /^(do you have|do you|is there|are there|what is|what are|whats|can i|could i|does the|do the|is the|how much is|how much)\s+/;

export function questionKey(question: string): string {
  let k = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  k = k.replace(FILLER, "").trim();
  return k;
}
