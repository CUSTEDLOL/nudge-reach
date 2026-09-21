import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocumentProxy, extractText } = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

vi.mock("unpdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("unpdf")>();
  getDocumentProxy.mockImplementation(actual.getDocumentProxy);
  extractText.mockImplementation(actual.extractText);
  return { ...actual, getDocumentProxy, extractText };
});

import {
  deterministicDocumentFacts,
  extractPdfText,
  MAX_PDF_IMAGE_PIXELS,
  MAX_PDF_PAGES,
  MAX_PDF_TEXT_CHARS,
} from "@/modules/knowledge/pdf";

const FIXTURE_PATH = fileURLToPath(
  new URL("./fixtures/business-service-guide.pdf.base64", import.meta.url),
);

function fixtureBytes(): Uint8Array {
  return new Uint8Array(
    Buffer.from(readFileSync(FIXTURE_PATH, "utf8").trim(), "base64"),
  );
}

describe("extractPdfText", () => {
  beforeEach(() => {
    getDocumentProxy.mockClear();
    extractText.mockClear();
  });

  it("extracts literal text from a real business-neutral PDF fixture", async () => {
    await expect(extractPdfText(fixtureBytes())).resolves.toContain(
      "Document setup package - $120",
    );
    expect(getDocumentProxy).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ maxImageSize: MAX_PDF_IMAGE_PIXELS }),
    );
  });

  it("rejects more than the safe page limit before extracting and destroys the PDF", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: MAX_PDF_PAGES + 1,
      destroy,
    });

    await expect(extractPdfText(new Uint8Array([1]))).rejects.toThrow(
      new RegExp(`${MAX_PDF_PAGES} pages`, "i"),
    );
    expect(extractText).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("caps extracted text and releases parser resources", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      destroy,
    });
    extractText.mockResolvedValueOnce({
      totalPages: 1,
      text: "x".repeat(MAX_PDF_TEXT_CHARS + 500),
    });

    const text = await extractPdfText(new Uint8Array([1]));

    expect(text).toHaveLength(MAX_PDF_TEXT_CHARS);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("returns an honest error for scanned or otherwise textless PDFs", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      destroy,
    });
    extractText.mockResolvedValueOnce({ totalPages: 1, text: "  \n " });

    await expect(extractPdfText(new Uint8Array([1]))).rejects.toThrow(
      /no readable text|text-based PDF/i,
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("hides parser internals while still destroying an opened PDF", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      destroy,
    });
    extractText.mockRejectedValueOnce(new Error("xref table exploded"));

    const error = await extractPdfText(new Uint8Array([1])).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/couldn't read|text-based PDF/i);
    expect((error as Error).message).not.toContain("xref");
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe("deterministicDocumentFacts", () => {
  it("preserves literal service, price, hour, contact, and policy lines without invention", () => {
    const text = [
      "Northstar Workshop",
      "Services: Workspace planning consultation",
      "Document setup package - $120",
      "Hours: Monday-Friday 9:00 AM-5:00 PM",
      "Contact: hello@northstar.example | +1 555 010 2040",
      "Policy: Cancellations require 24 hours notice.",
      "Simple systems for growing teams.",
      "Document setup package - $120",
    ].join("\n");

    const facts = deterministicDocumentFacts(text);

    expect(facts).toEqual([
      {
        category: "menu_services",
        fact: "Services: Workspace planning consultation",
      },
      { category: "pricing", fact: "Document setup package - $120" },
      {
        category: "hours",
        fact: "Hours: Monday-Friday 9:00 AM-5:00 PM",
      },
      {
        category: "other",
        fact: "Contact: hello@northstar.example | +1 555 010 2040",
      },
      {
        category: "policies",
        fact: "Policy: Cancellations require 24 hours notice.",
      },
    ]);
    const sourceLines = new Set(text.split("\n"));
    expect(facts.every(({ fact }) => sourceLines.has(fact))).toBe(true);
  });
});
