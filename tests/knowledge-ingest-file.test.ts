import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PDF / menu-photo ingestion. Invariants under test:
 *  - keyless text PDFs are parsed locally; keyless images explain the OCR/key boundary
 *  - PDFs go to the router as document blocks, images as vision blocks
 *  - extracted facts land as org-scoped DRAFTS via the shared store (deduped)
 *  - the runtime model stays whatever the router enforces (we only assert the
 *    call shape here; the router's own guard covers the Haiku-only rule)
 */

const { prisma, generate, envState, storeKnowledgeFacts, extractPdfText } = vi.hoisted(() => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
  },
  generate: vi.fn(),
  envState: { ANTHROPIC_API_KEY: undefined as string | undefined },
  storeKnowledgeFacts: vi.fn(),
  extractPdfText: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate, chat: vi.fn() }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  assertPublicHttpsUrl: vi.fn(),
}));
vi.mock("@/modules/knowledge/store", () => ({ storeKnowledgeFacts }));
vi.mock("@/modules/knowledge/pdf", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/knowledge/pdf")
  >();
  return { ...actual, extractPdfText };
});

import { ingestFile, MAX_FILE_BYTES } from "@/modules/knowledge/ingest";

const FACTS_JSON = JSON.stringify([
  { category: "pricing", fact: "Document setup package costs $120" },
  { category: "menu_services", fact: "Workspace planning is available" },
]);

const PDF_TEXT = [
  "Services: Workspace planning consultation",
  "Document setup package - $120",
  "Hours: Monday-Friday 9:00 AM-5:00 PM",
  "Contact: hello@northstar.example",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  envState.ANTHROPIC_API_KEY = "key";
  prisma.knowledgeEntry.findMany.mockResolvedValue([]);
  generate.mockResolvedValue(FACTS_JSON);
  extractPdfText.mockResolvedValue(PDF_TEXT);
  storeKnowledgeFacts.mockImplementation(async (_orgId, facts, options) => ({
    created: Math.min(facts.length, options.maxCreated ?? facts.length),
    capacityReached: false,
  }));
});

describe("ingestFile", () => {
  it("keeps uploads below Vercel's multipart request ceiling", () => {
    expect(MAX_FILE_BYTES).toBe(4 * 1024 * 1024);
  });

  it("parses keyless text PDFs locally, stores bounded drafts, and returns capacity", async () => {
    envState.ANTHROPIC_API_KEY = undefined;
    storeKnowledgeFacts.mockResolvedValue({ created: 3, capacityReached: true });

    await expect(
      ingestFile(
        "org1",
        {
          base64: Buffer.from("pdf bytes").toString("base64"),
          mediaType: "application/pdf",
        },
        { maxDrafts: 4, activeDraftCap: 50 },
      ),
    ).resolves.toEqual({ drafts: 3, capacityReached: true });

    expect(generate).not.toHaveBeenCalled();
    const [decodedPdf] = extractPdfText.mock.calls[0] ?? [];
    expect(decodedPdf).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(decodedPdf)).toBe(false);
    expect(decodedPdf).toEqual(new Uint8Array(Buffer.from("pdf bytes")));
    expect(decodedPdf.byteLength).toBe(Buffer.byteLength("pdf bytes"));
    expect(decodedPdf.buffer.byteLength).toBeGreaterThan(decodedPdf.byteLength);
    expect(storeKnowledgeFacts).toHaveBeenCalledWith(
      "org1",
      [
        {
          category: "menu_services",
          fact: "Services: Workspace planning consultation",
        },
        { category: "pricing", fact: "Document setup package - $120" },
        {
          category: "hours",
          fact: "Hours: Monday-Friday 9:00 AM-5:00 PM",
        },
        { category: "other", fact: "Contact: hello@northstar.example" },
      ],
      {
        source: "import",
        status: "draft",
        activeDraftCap: 50,
        maxCreated: 4,
      },
    );
  });

  it("explains that keyless images need OCR through an AI key", async () => {
    envState.ANTHROPIC_API_KEY = undefined;

    await expect(
      ingestFile("org1", { base64: "IMGDATA", mediaType: "image/jpeg" }),
    ).rejects.toThrow(/OCR.*AI key|AI key.*OCR/i);

    expect(generate).not.toHaveBeenCalled();
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("sends PDFs as document blocks", async () => {
    await ingestFile("org1", { base64: "PDFDATA", mediaType: "application/pdf" });
    const call = generate.mock.calls[0][0];
    expect(call.document).toEqual({ data: "PDFDATA" });
    expect(call.image).toBeUndefined();
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("sends photos as vision blocks", async () => {
    await ingestFile("org1", { base64: "IMGDATA", mediaType: "image/jpeg" });
    const call = generate.mock.calls[0][0];
    expect(call.image).toEqual({ data: "IMGDATA", mediaType: "image/jpeg" });
    expect(call.document).toBeUndefined();
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("stores extracted facts as org-scoped drafts", async () => {
    const result = await ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/png",
    });
    expect(result.drafts).toBe(2);
    expect(storeKnowledgeFacts).toHaveBeenCalledWith(
      "org1",
      expect.any(Array),
      {
        source: "import",
        status: "draft",
        activeDraftCap: undefined,
        maxCreated: 60,
      },
    );
  });

  it("accepts a smaller draft cap for acquisition trials", async () => {
    const result = await ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/png",
    }, { maxDrafts: 1, activeDraftCap: 50 });

    expect(result.drafts).toBe(1);
    expect(storeKnowledgeFacts).toHaveBeenCalledWith(
      "org1",
      expect.any(Array),
      {
        source: "import",
        status: "draft",
        activeDraftCap: 50,
        maxCreated: 1,
      },
    );
  });

  it("returns the shared store's deduped count", async () => {
    storeKnowledgeFacts.mockResolvedValue({ created: 1, capacityReached: false });
    const result = await ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/webp",
    });
    expect(result.drafts).toBe(1);
  });

  it("propagates the shared store's capacity result", async () => {
    storeKnowledgeFacts.mockResolvedValue({ created: 0, capacityReached: true });

    await expect(ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/webp",
    })).resolves.toEqual({ drafts: 0, capacityReached: true });
  });

  it("returns zero drafts on unparseable model output (no crash)", async () => {
    generate.mockResolvedValue("sorry, I can't read this");
    const result = await ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/jpeg",
    });
    expect(result.drafts).toBe(0);
  });
});
