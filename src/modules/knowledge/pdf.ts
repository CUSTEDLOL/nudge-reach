import { getDocumentProxy } from "unpdf";
import type { DistilledFact } from "./distill";

export const MAX_PDF_PAGES = 20;
export const MAX_PDF_TEXT_CHARS = 30_000;
export const MAX_PDF_IMAGE_PIXELS = 16_777_216;
export const MAX_PDF_PARSE_MS = 5_000;

const MAX_DOCUMENT_FACTS = 60;
const READ_ERROR =
  "Couldn't read that PDF. Upload a valid text-based PDF and try again.";
const NO_TEXT_ERROR =
  "This PDF has no readable text. Upload a text-based PDF rather than a scanned image.";
const TIMEOUT_ERROR =
  "That PDF took too long to read. Try a smaller text-based PDF.";

class UserSafePdfError extends Error {}

type PdfProxy = Awaited<ReturnType<typeof getDocumentProxy>>;
type PdfPage = Awaited<ReturnType<PdfProxy["getPage"]>>;
type PdfTextItems = Awaited<ReturnType<PdfPage["getTextContent"]>>["items"];

function cleanPageText(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function boundedPageText(
  items: PdfTextItems,
  maxChars: number,
): { text: string; truncated: boolean } {
  let raw = "";
  let separator = "";

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!("str" in item)) continue;
    if (!item.str) {
      if (item.hasEOL) separator = "\n";
      continue;
    }

    const chunk = `${raw ? separator : ""}${item.str}`;
    const remaining = maxChars - raw.length;
    if (chunk.length >= remaining) {
      raw += chunk.slice(0, remaining);
      return {
        text: cleanPageText(raw),
        truncated: chunk.length > remaining || index < items.length - 1,
      };
    }

    raw += chunk;
    separator = item.hasEOL ? "\n" : " ";
  }

  return { text: cleanPageText(raw), truncated: false };
}

async function extractPagesSequentially(pdf: PdfProxy): Promise<string> {
  let text = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pageSeparator = text ? "\n" : "";
    const remaining =
      MAX_PDF_TEXT_CHARS - text.length - pageSeparator.length;
    if (remaining <= 0) break;

    const page = await pdf.getPage(pageNumber);
    try {
      const content = await page.getTextContent();
      const pageResult = boundedPageText(content.items, remaining);
      if (pageResult.text) text += `${pageSeparator}${pageResult.text}`;
      if (pageResult.truncated || text.length >= MAX_PDF_TEXT_CHARS) break;
    } finally {
      try {
        page.cleanup();
      } catch {
        // Resource cleanup is best effort and must not hide the parse result.
      }
    }
  }

  return text;
}

async function withParseDeadline<T>(
  operation: () => Promise<T>,
  onDeadline: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new UserSafePdfError(TIMEOUT_ERROR));
      onDeadline();
    }, MAX_PDF_PARSE_MS);
  });

  try {
    return await Promise.race([operation(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  let pdf: PdfProxy | null = null;
  let destroyPromise: Promise<void> | null = null;
  let deadlineReached = false;
  const destroyPdf = (): Promise<void> => {
    if (!pdf) return Promise.resolve();
    destroyPromise ??= pdf.destroy().catch(() => undefined);
    return destroyPromise;
  };

  try {
    const text = await withParseDeadline(
      async () => {
        pdf = await getDocumentProxy(data, {
          maxImageSize: MAX_PDF_IMAGE_PIXELS,
        });
        if (deadlineReached) {
          await destroyPdf();
          throw new UserSafePdfError(TIMEOUT_ERROR);
        }
        if (pdf.numPages > MAX_PDF_PAGES) {
          throw new UserSafePdfError(
            `That PDF has too many pages. Upload a document with ${MAX_PDF_PAGES} pages or fewer.`,
          );
        }
        return extractPagesSequentially(pdf);
      },
      () => {
        deadlineReached = true;
        void destroyPdf();
      },
    );
    if (!text) throw new UserSafePdfError(NO_TEXT_ERROR);
    return text;
  } catch (error) {
    if (error instanceof UserSafePdfError) throw error;
    throw new Error(READ_ERROR);
  } finally {
    await destroyPdf();
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
