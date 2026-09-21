import { extractText, getDocumentProxy } from "unpdf";
import type { DistilledFact } from "./distill";

export const MAX_PDF_PAGES = 20;
export const MAX_PDF_TEXT_CHARS = 30_000;
export const MAX_PDF_IMAGE_PIXELS = 16_777_216;

const MAX_DOCUMENT_FACTS = 60;
const READ_ERROR =
  "Couldn't read that PDF. Upload a valid text-based PDF and try again.";
const NO_TEXT_ERROR =
  "This PDF has no readable text. Upload a text-based PDF rather than a scanned image.";

class UserSafePdfError extends Error {}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    pdf = await getDocumentProxy(data, {
      maxImageSize: MAX_PDF_IMAGE_PIXELS,
    });
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new UserSafePdfError(
        `That PDF has too many pages. Upload a document with ${MAX_PDF_PAGES} pages or fewer.`,
      );
    }

    const result = await extractText(pdf, { mergePages: true });
    const bounded = result.text.slice(0, MAX_PDF_TEXT_CHARS).trim();
    if (!bounded) throw new UserSafePdfError(NO_TEXT_ERROR);
    return bounded;
  } catch (error) {
    if (error instanceof UserSafePdfError) throw error;
    throw new Error(READ_ERROR);
  } finally {
    await pdf?.destroy().catch(() => undefined);
  }
}

const PRICE_RE =
  /(?:₹|\$|€|£|S\$|RM\s*|AED\s*|USD\s*|INR\s*|SGD\s*)\d|\b(?:rs\.?|aed|usd|inr|sgd)\s*\d/i;
const HOURS_RE =
  /\b(?:hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|closed)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;
const CONTACT_RE =
  /\b(?:contact|phone|email|call|whatsapp|website)\b|\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?\d[\d ()-]{6,}\d)/i;
const POLICY_RE =
  /\b(?:policy|policies|cancel(?:lation)?s?|refunds?|returns?|no[- ]show|notice|terms?|deposit)\b/i;
const PAYMENT_RE = /\b(?:payment|pay|cash|card|upi|bank transfer)\b/i;
const LOCATION_RE =
  /\b(?:address|location|street|road|avenue|floor|suite|building|near|opposite)\b/i;
const SERVICE_RE =
  /\b(?:services?|offerings?|packages?|consultations?|repairs?|installations?|lessons?|sessions?|plans?)\b/i;

function categoryForLine(line: string): DistilledFact["category"] | null {
  if (PRICE_RE.test(line)) return "pricing";
  if (POLICY_RE.test(line)) return "policies";
  if (HOURS_RE.test(line)) return "hours";
  if (PAYMENT_RE.test(line)) return "payments";
  if (CONTACT_RE.test(line)) return "other";
  if (LOCATION_RE.test(line)) return "location";
  if (SERVICE_RE.test(line)) return "menu_services";
  return null;
}

function normalizedLine(line: string): string {
  return line.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
}

export function deterministicDocumentFacts(text: string): DistilledFact[] {
  const facts: DistilledFact[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 3 || line.length > 300) continue;
    const category = categoryForLine(line);
    if (!category) continue;
    const key = normalizedLine(line);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ category, fact: line });
    if (facts.length >= MAX_DOCUMENT_FACTS) break;
  }

  return facts;
}
