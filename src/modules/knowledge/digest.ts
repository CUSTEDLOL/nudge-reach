/**
 * Categorized prompt digest of the org's active knowledge (pure, unit-tested).
 * This is what the agent reads — never the raw table, never the whole blob.
 * Overflow drops whole trailing facts (never truncates mid-fact) and says how
 * many were dropped, so the agent knows its knowledge is partial.
 */

export const KNOWLEDGE_CATEGORIES = [
  "menu_services",
  "pricing",
  "hours",
  "location",
  "policies",
  "payments",
  "faq",
  "other",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  menu_services: "MENU & SERVICES",
  pricing: "PRICING",
  hours: "HOURS",
  location: "LOCATION",
  policies: "POLICIES",
  payments: "PAYMENTS",
  faq: "FAQ",
  other: "OTHER",
};

export interface DigestEntry {
  category: string;
  fact: string;
  condition: string | null;
}

const DEFAULT_MAX_CHARS = 6000;

export function buildKnowledgeDigest(
  entries: DigestEntry[],
  maxChars = DEFAULT_MAX_CHARS
): string {
  if (!entries.length) return "";

  const lines: string[] = [];
  for (const cat of KNOWLEDGE_CATEGORIES) {
    const inCat = entries.filter((x) =>
      cat === "other"
        ? x.category === "other" ||
          !KNOWLEDGE_CATEGORIES.includes(x.category as KnowledgeCategory)
        : x.category === cat
    );
    if (!inCat.length) continue;
    lines.push(`${CATEGORY_LABELS[cat]}:`);
    for (const x of inCat) {
      lines.push(`- ${x.fact}${x.condition ? ` — only: ${x.condition}` : ""}`);
    }
  }

  let out = "";
  let dropped = 0;
  for (const line of lines) {
    if (out.length + line.length + 1 > maxChars) {
      if (!line.endsWith(":")) dropped++;
      continue;
    }
    out += (out ? "\n" : "") + line;
  }
  if (dropped > 0) out += `\n(+${dropped} more facts not shown)`;
  return out;
}
