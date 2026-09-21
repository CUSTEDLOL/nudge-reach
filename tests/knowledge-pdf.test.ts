import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocumentProxy } = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
}));

vi.mock("unpdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("unpdf")>();
  getDocumentProxy.mockImplementation(actual.getDocumentProxy);
  return { ...actual, getDocumentProxy };
});

import {
  deterministicDocumentFacts,
  extractPdfText,
  MAX_PDF_IMAGE_PIXELS,
  MAX_PDF_PAGES,
  MAX_PDF_PARSE_MS,
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

function textItem(str: string, hasEOL = false) {
  return { str, hasEOL };
}

describe("extractPdfText", () => {
  beforeEach(() => {
    getDocumentProxy.mockClear();
  });

  it("extracts a real PDF into deterministic literal business facts", async () => {
    const text = await extractPdfText(fixtureBytes());

    expect(text).toContain("Document setup package - $120");
    expect(deterministicDocumentFacts(text)).toEqual([
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
    expect(getDocumentProxy).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ maxImageSize: MAX_PDF_IMAGE_PIXELS }),
    );
  });

  it("rejects more than the safe page limit before loading a page and destroys the PDF", async () => {
    const getPage = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: MAX_PDF_PAGES + 1,
      getPage,
      destroy,
    } as never);

    await expect(extractPdfText(new Uint8Array([1]))).rejects.toThrow(
      new RegExp(`${MAX_PDF_PAGES} pages`, "i"),
    );
    expect(getPage).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("loads pages sequentially and stops as soon as the character cap is filled", async () => {
    let resolveText!: (value: { items: Array<ReturnType<typeof textItem>> }) => void;
    const getTextContent = vi.fn().mockReturnValue(
      new Promise<{ items: Array<ReturnType<typeof textItem>> }>((resolve) => {
        resolveText = resolve;
      }),
    );
    const cleanup = vi.fn();
    const getPage = vi.fn().mockResolvedValue({ getTextContent, cleanup });
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 3,
      getPage,
      destroy,
    } as never);

    const extraction = extractPdfText(new Uint8Array([1]));
    await vi.waitFor(() => expect(getTextContent).toHaveBeenCalledOnce());
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(getPage).toHaveBeenCalledWith(1);

    const unreadItem = {
      get str(): string {
        throw new Error("read beyond the character cap");
      },
      hasEOL: false,
    };
    resolveText({
      items: [
        textItem("x".repeat(20_000)),
        textItem("y".repeat(20_000)),
        unreadItem,
      ],
    });
    const text = await extraction;

    expect(text).toHaveLength(MAX_PDF_TEXT_CHARS);
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("preserves literal line and page breaks while cleaning every loaded page", async () => {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    const pages = [
      {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            textItem("Services: Workspace planning consultation", true),
            textItem("Document"),
            textItem("setup"),
            textItem("package"),
            textItem("-"),
            textItem("$120"),
          ],
        }),
        cleanup: firstCleanup,
      },
      {
        getTextContent: vi.fn().mockResolvedValue({
          items: [textItem("Hours: Monday-Friday 9:00 AM-5:00 PM")],
        }),
        cleanup: secondCleanup,
      },
    ];
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(pages[0])
      .mockResolvedValueOnce(pages[1]);
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: pages.length,
      getPage,
      destroy,
    } as never);

    await expect(extractPdfText(new Uint8Array([1]))).resolves.toBe(
      [
        "Services: Workspace planning consultation",
        "Document setup package - $120",
        "Hours: Monday-Friday 9:00 AM-5:00 PM",
      ].join("\n"),
    );
    expect(getPage.mock.calls).toEqual([[1], [2]]);
    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(secondCleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("returns an honest error for scanned or otherwise textless PDFs", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [textItem("  "), textItem("\n")],
        }),
        cleanup,
      }),
      destroy,
    } as never);

    await expect(extractPdfText(new Uint8Array([1]))).rejects.toThrow(
      /no readable text|text-based PDF/i,
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("hides parser internals while cleaning the page and destroying the PDF", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockRejectedValue(new Error("xref table exploded")),
        cleanup,
      }),
      destroy,
    } as never);

    const error = await extractPdfText(new Uint8Array([1])).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/couldn't read|text-based PDF/i);
    expect((error as Error).message).not.toContain("xref");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("aborts a stalled parse at the deadline and tears down parser resources", async () => {
    vi.useFakeTimers();
    try {
      let rejectText!: (reason: Error) => void;
      const getTextContent = vi.fn().mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectText = reject;
        }),
      );
      const cleanup = vi.fn();
      const destroy = vi.fn().mockImplementation(async () => {
        rejectText(new Error("worker destroyed"));
      });
      getDocumentProxy.mockResolvedValueOnce({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({ getTextContent, cleanup }),
        destroy,
      } as never);

      const extraction = extractPdfText(new Uint8Array([1]));
      await Promise.resolve();
      await Promise.resolve();
      expect(getTextContent).toHaveBeenCalledOnce();
      const rejection = expect(extraction).rejects.toThrow(
        /too long|smaller text-based PDF/i,
      );

      await vi.advanceTimersByTimeAsync(MAX_PDF_PARSE_MS);
      await rejection;
      expect(cleanup).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the deadline to initial PDF loading and destroys a late proxy", async () => {
    vi.useFakeTimers();
    let resolveProxy!: (proxy: unknown) => void;
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getPage = vi.fn().mockResolvedValue({
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      cleanup: vi.fn(),
    });
    const proxy = { numPages: 1, getPage, destroy };
    getDocumentProxy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProxy = resolve;
      }) as never,
    );

    let outcome:
      | { status: "resolved" }
      | { status: "rejected"; error: unknown }
      | undefined;
    const extraction = extractPdfText(new Uint8Array([1]));
    const observed = extraction.then(
      () => {
        outcome = { status: "resolved" };
      },
      (error: unknown) => {
        outcome = { status: "rejected", error };
      },
    );

    try {
      await vi.advanceTimersByTimeAsync(MAX_PDF_PARSE_MS);
      const outcomeAtDeadline = outcome;

      resolveProxy(proxy);
      await observed;
      await Promise.resolve();
      await Promise.resolve();

      expect(outcomeAtDeadline).toMatchObject({
        status: "rejected",
        error: expect.objectContaining({
          message: expect.stringMatching(/too long|smaller text-based PDF/i),
        }),
      });
      expect(getPage).not.toHaveBeenCalled();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      resolveProxy(proxy);
      await observed;
      vi.useRealTimers();
    }
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
