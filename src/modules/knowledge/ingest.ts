import { z } from "zod";
import { Buffer } from "node:buffer";
import { env } from "@/lib/env";
import { chat, generate } from "@/lib/model-router";
import { assertPublicHttpsUrl } from "@/modules/integrations/outbound-webhooks";
import { factSchema, type DistilledFact } from "./distill";
import { deterministicDocumentFacts, extractPdfText } from "./pdf";
import { storeKnowledgeFacts } from "./store";

/**
 * Import-first onboarding, source #1: the business website. Crawl the given
 * page plus a handful of same-origin pages that look informative (menu,
 * pricing, services…), extract text, and turn it into KnowledgeEntry rows
 * with `status: "draft"` — the owner approves/discards them card-by-card on
 * the AI Agent page. Drafts are invisible to the agent (every digest query
 * filters status "active"), so nothing unreviewed ever reaches a customer.
 *
 * Keyless path (invariant #4): a deterministic heuristic extractor pulls
 * price/hours/address-looking lines so the flow demos with zero keys.
 * SSRF-guarded via the same helper as outbound webhooks.
 */

const MAX_PAGE_BYTES = 600_000;
const CHUNK_CHARS = 3_000;
const MAX_DRAFTS_PER_RUN = 60;
const FETCH_TIMEOUT_MS = 10_000;

export interface IngestBudget {
  maxSubpages: number;
  maxChunksPerPage: number;
  maxDrafts: number;
  activeDraftCap?: number;
}

const DEFAULT_INGEST_BUDGET: IngestBudget = {
  maxSubpages: 4,
  maxChunksPerPage: 4,
  maxDrafts: MAX_DRAFTS_PER_RUN,
};

/* ------------------------------------------------------------------ */
/* HTML → text                                                         */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Same-origin links from the page, ranked by how informative the path looks. */
export function discoverLinks(
  baseUrl: string,
  html: string,
  maxSubpages = DEFAULT_INGEST_BUDGET.maxSubpages
): string[] {
  const base = new URL(baseUrl);
  const KEYWORDS = [
    "menu", "price", "pricing", "rate", "package", "fee", "service",
    "treatment", "about", "contact", "faq", "hour", "location", "book",
  ];
  const seen = new Set<string>([base.href]);
  const scored: { href: string; score: number }[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(match[1], base);
    } catch {
      continue;
    }
    if (url.origin !== base.origin) continue;
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|pdf|ico|mp4|zip)$/i.test(url.pathname)) continue;
    url.hash = "";
    url.search = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const path = url.pathname.toLowerCase();
    const score = KEYWORDS.reduce((s, k) => (path.includes(k) ? s + 1 : s), 0);
    scored.push({ href: url.href, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSubpages)
    .map((s) => s.href);
}

/* ------------------------------------------------------------------ */
/* Keyless heuristic extraction                                        */
/* ------------------------------------------------------------------ */

const PRICE_RE = /(₹|rs\.?\s?\d|inr\s?\d|\d+\s?\/-)/i;
const HOURS_RE = /\b(mon|tue|wed|thu|fri|sat|sun|open|closed|am|pm)\b/i;
const ADDRESS_RE = /\b(road|street|floor|near|opposite|opp\.|lane|nagar|colony|market|mall|pin\s?code|landmark)\b/i;

/** Deterministic fallback: pull obviously factual lines, categorized. */
export function heuristicFacts(text: string): DistilledFact[] {
  const facts: DistilledFact[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length < 8 || line.length > 240) continue;
    if (PRICE_RE.test(line) && /\d/.test(line)) {
      facts.push({ category: "pricing", fact: line });
    } else if (HOURS_RE.test(line) && /\d/.test(line)) {
      facts.push({ category: "hours", fact: line });
    } else if (ADDRESS_RE.test(line)) {
      facts.push({ category: "location", fact: line });
    }
    if (facts.length >= 12) break;
  }
  return facts;
}

/* ------------------------------------------------------------------ */
/* Model extraction (Haiku via the router — never load-bearing)        */
/* ------------------------------------------------------------------ */

const pageFactsSchema = z.array(factSchema).max(10);

const INGEST_SYSTEM = [
  "You extract knowledge-base facts about a business from its website text, for its WhatsApp assistant.",
  'Reply with ONLY a JSON array, no prose. Each item: {"category", "fact", "condition"?}.',
  "category must be one of: menu_services, pricing, hours, location, policies, payments, faq, other.",
  "fact: one short, self-contained statement about the business (services, prices, hours, address, policies).",
  "Only include facts clearly stated in the text. Never invent. Skip navigation junk, marketing fluff and legal boilerplate.",
  "Return [] if the text contains nothing factual.",
].join("\n");

/** Parse the model's JSON-array reply into validated facts ([] on any failure). */
function parseFactsArray(raw: string): DistilledFact[] {
  try {
    const cleaned = raw.replace(/```(?:json)?/gi, "");
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end <= start) return [];
    const parsed = pageFactsSchema.safeParse(
      JSON.parse(cleaned.slice(start, end + 1)).slice(0, 10)
    );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function modelFacts(
  pageText: string,
  orgId: string,
  maxChunks = DEFAULT_INGEST_BUDGET.maxChunksPerPage
): Promise<DistilledFact[]> {
  const facts: DistilledFact[] = [];
  const chunks: string[] = [];
  for (
    let i = 0;
    i < pageText.length && chunks.length < maxChunks;
    i += CHUNK_CHARS
  ) {
    chunks.push(pageText.slice(i, i + CHUNK_CHARS));
  }
  for (const chunk of chunks) {
    try {
      const raw = await chat({
        system: INGEST_SYSTEM,
        messages: [{ role: "user", text: chunk }],
        maxTokens: 700,
        attribution: { orgId, purpose: "ingest" },
      });
      facts.push(...parseFactsArray(raw ?? ""));
    } catch {
      // One bad chunk never sinks the page.
    }
  }
  return facts;
}

/* ------------------------------------------------------------------ */
/* Fetch + orchestrate                                                 */
/* ------------------------------------------------------------------ */

async function fetchPage(url: string): Promise<string | null> {
  try {
    await assertPublicHttpsUrl(url);
    const res = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/html", "user-agent": "NudgeBot/1.0 (+knowledge-import)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    const body = await res.text();
    return body.slice(0, MAX_PAGE_BYTES);
  } catch {
    return null;
  }
}

export interface IngestResult {
  pages: number;
  drafts: number;
  capacityReached: boolean;
}

/**
 * Crawl → extract → store drafts. Throws only for a bad/unreachable start URL
 * (the caller shows the message); per-subpage failures are skipped silently.
 */
export async function ingestWebsite(
  orgId: string,
  rawUrl: string,
  budget: IngestBudget = DEFAULT_INGEST_BUDGET
): Promise<IngestResult> {
  const startUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const mainHtml = await fetchPage(startUrl);
  if (!mainHtml) {
    throw new Error(
      "Couldn't read that page. Check the URL is public and uses https."
    );
  }

  const urls = [
    startUrl,
    ...discoverLinks(startUrl, mainHtml, budget.maxSubpages),
  ];
  const htmls = new Map<string, string>([[startUrl, mainHtml]]);
  await Promise.all(
    urls.slice(1).map(async (u) => {
      const html = await fetchPage(u);
      if (html) htmls.set(u, html);
    })
  );

  const collected: DistilledFact[] = [];
  for (const [, html] of htmls) {
    const text = stripHtml(html);
    if (text.length < 40) continue;
    collected.push(
      ...(env.ANTHROPIC_API_KEY
        ? await modelFacts(text, orgId, budget.maxChunksPerPage)
        : heuristicFacts(text))
    );
  }
  const stored = await storeKnowledgeFacts(orgId, collected, {
    source: "import",
    status: "draft",
    activeDraftCap: budget.activeDraftCap,
    maxCreated: budget.maxDrafts,
  });

  return {
    pages: htmls.size,
    drafts: stored.created,
    capacityReached: stored.capacityReached,
  };
}

/* ------------------------------------------------------------------ */
/* Google Business Profile import — the zero-effort source. Most       */
/* Indian SMBs have a GBP listing even with no website: name, address, */
/* hours, phone in one search. Structured data → deterministic facts   */
/* (no LLM). Keyless → a demo profile so onboarding demos end-to-end   */
/* (invariant #4). When the listing has a website, we chain-crawl it.  */
/* ------------------------------------------------------------------ */

export interface GbpPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

const FACT_MAX = 280;

/** Deterministic GBP → facts (pure; no model call). */
export function gbpFacts(place: GbpPlace): DistilledFact[] {
  const facts: DistilledFact[] = [];
  if (place.formattedAddress) {
    facts.push({
      category: "location",
      fact: `Address: ${place.formattedAddress}`.slice(0, 300),
    });
  }
  // Hours: pack the per-day lines into as few review cards as fit.
  const days = place.regularOpeningHours?.weekdayDescriptions ?? [];
  let bucket = "";
  for (const day of days) {
    const next = bucket ? `${bucket}; ${day}` : day;
    if (next.length > FACT_MAX && bucket) {
      facts.push({ category: "hours", fact: bucket });
      bucket = day;
    } else {
      bucket = next;
    }
  }
  if (bucket) facts.push({ category: "hours", fact: bucket });

  if (place.nationalPhoneNumber) {
    facts.push({
      category: "other",
      fact: `Phone: ${place.nationalPhoneNumber}`,
    });
  }
  if (place.rating && place.userRatingCount) {
    facts.push({
      category: "faq",
      fact: `Rated ${place.rating}/5 on Google from ${place.userRatingCount} reviews`,
    });
  }
  return facts;
}

/** Keyless demo listing — keeps the GBP flow demoable with zero keys. */
const SIMULATED_PLACE: GbpPlace = {
  displayName: { text: "Glow Beauty Studio (demo listing)" },
  formattedAddress: "2nd Floor, Green Plaza, MG Road, Bengaluru 560001",
  nationalPhoneNumber: "+91 98765 43210",
  rating: 4.7,
  userRatingCount: 214,
  regularOpeningHours: {
    weekdayDescriptions: [
      "Monday: 10:00 AM – 8:00 PM",
      "Tuesday: 10:00 AM – 8:00 PM",
      "Wednesday: 10:00 AM – 8:00 PM",
      "Thursday: 10:00 AM – 8:00 PM",
      "Friday: 10:00 AM – 8:00 PM",
      "Saturday: 9:00 AM – 9:00 PM",
      "Sunday: Closed",
    ],
  },
};

async function searchGbp(query: string): Promise<GbpPlace | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY ?? "",
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.regularOpeningHours",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Google Places lookup failed (HTTP ${res.status}).`);
  }
  const body = (await res.json().catch(() => null)) as {
    places?: GbpPlace[];
  } | null;
  return body?.places?.[0] ?? null;
}

export interface GbpImportResult {
  name: string;
  drafts: number;
  websiteCrawled: boolean;
  capacityReached: boolean;
}

export async function ingestGbp(
  orgId: string,
  query: string,
  budget: IngestBudget = DEFAULT_INGEST_BUDGET
): Promise<GbpImportResult> {
  const place = env.GOOGLE_MAPS_API_KEY
    ? await searchGbp(query)
    : SIMULATED_PLACE;
  if (!place) {
    throw new Error(
      `Couldn't find "${query}" on Google. Try the business name plus the city.`
    );
  }

  const stored = await storeKnowledgeFacts(orgId, gbpFacts(place), {
    source: "import",
    status: "draft",
    activeDraftCap: budget.activeDraftCap,
    maxCreated: budget.maxDrafts,
  });
  let drafts = stored.created;
  let capacityReached = stored.capacityReached;

  // Bonus: the listing knows the website — crawl it in the same run.
  let websiteCrawled = false;
  if (place.websiteUri) {
    try {
      const site = await ingestWebsite(orgId, place.websiteUri, budget);
      drafts += site.drafts;
      capacityReached ||= site.capacityReached;
      websiteCrawled = true;
    } catch {
      // The GBP facts alone are still a win; never fail the run on this.
    }
  }

  return {
    name: place.displayName?.text ?? query,
    drafts,
    websiteCrawled,
    capacityReached,
  };
}

/* ------------------------------------------------------------------ */
/* File ingestion — keyed PDFs/images retain their guarded router      */
/* shapes. Keyless text PDFs are parsed locally; images need OCR and   */
/* therefore require a configured AI key.                              */
/* ------------------------------------------------------------------ */

export const FILE_MEDIA_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type FileMediaType = (typeof FILE_MEDIA_TYPES)[number];

// Leaves headroom under Vercel's 4.5 MB multipart request-body limit.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const FILE_PROMPT =
  "Extract knowledge-base facts about the business from this file (a menu, price list, rate card, brochure or similar). Follow the system instructions.";

export interface FileIngestBudget {
  maxDrafts: number;
  activeDraftCap?: number;
}

const DEFAULT_FILE_INGEST_BUDGET: FileIngestBudget = {
  maxDrafts: MAX_DRAFTS_PER_RUN,
};

export async function ingestFile(
  orgId: string,
  input: { base64: string; mediaType: FileMediaType },
  budget: FileIngestBudget = DEFAULT_FILE_INGEST_BUDGET,
): Promise<{ drafts: number; capacityReached: boolean }> {
  if (!env.ANTHROPIC_API_KEY) {
    if (input.mediaType !== "application/pdf") {
      throw new Error(
        "Reading images needs OCR through an AI key. Upload a text-based PDF instead, or configure an AI key.",
      );
    }

    const decoded = Buffer.from(input.base64, "base64");
    const pdfBytes = new Uint8Array(
      decoded.buffer,
      decoded.byteOffset,
      decoded.byteLength,
    );
    const text = await extractPdfText(pdfBytes);
    const stored = await storeKnowledgeFacts(
      orgId,
      deterministicDocumentFacts(text),
      {
        source: "import",
        status: "draft",
        activeDraftCap: budget.activeDraftCap,
        maxCreated: budget.maxDrafts,
      },
    );
    return {
      drafts: stored.created,
      capacityReached: stored.capacityReached,
    };
  }

  const raw = await generate({
    system: INGEST_SYSTEM,
    prompt: FILE_PROMPT,
    ...(input.mediaType === "application/pdf"
      ? { document: { data: input.base64 } }
      : {
          image: { data: input.base64, mediaType: input.mediaType },
        }),
    maxTokens: 1500,
    attribution: { orgId, purpose: "ingest" },
  });

  const stored = await storeKnowledgeFacts(orgId, parseFactsArray(raw), {
    source: "import",
    status: "draft",
    activeDraftCap: budget.activeDraftCap,
    maxCreated: budget.maxDrafts,
  });
  return {
    drafts: stored.created,
    capacityReached: stored.capacityReached,
  };
}
