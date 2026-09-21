import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PDF / menu-photo ingestion. Invariants under test:
 *  - keyless mode fails with the friendly website-import pointer (never a crash)
 *  - PDFs go to the router as document blocks, images as vision blocks
 *  - extracted facts land as org-scoped DRAFTS via the shared store (deduped)
 *  - the runtime model stays whatever the router enforces (we only assert the
 *    call shape here; the router's own guard covers the Haiku-only rule)
 */

const { prisma, generate, envState, storeKnowledgeFacts } = vi.hoisted(() => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
  },
  generate: vi.fn(),
  envState: { ANTHROPIC_API_KEY: undefined as string | undefined },
  storeKnowledgeFacts: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate, chat: vi.fn() }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  assertPublicHttpsUrl: vi.fn(),
}));
vi.mock("@/modules/knowledge/store", () => ({ storeKnowledgeFacts }));

import { ingestFile } from "@/modules/knowledge/ingest";

const FACTS_JSON = JSON.stringify([
  { category: "pricing", fact: "Classic facial ₹1,800 for 50 minutes" },
  { category: "menu_services", fact: "Bridal packages available on request" },
]);

beforeEach(() => {
  vi.clearAllMocks();
  envState.ANTHROPIC_API_KEY = "key";
  prisma.knowledgeEntry.findMany.mockResolvedValue([]);
  generate.mockResolvedValue(FACTS_JSON);
  storeKnowledgeFacts.mockImplementation(async (_orgId, facts, options) => ({
    created: Math.min(facts.length, options.maxCreated ?? facts.length),
    capacityReached: false,
  }));
});

describe("ingestFile", () => {
  it("keyless → friendly error pointing at the keyless website import", async () => {
    envState.ANTHROPIC_API_KEY = undefined;
    await expect(
      ingestFile("org1", { base64: "AAAA", mediaType: "application/pdf" })
    ).rejects.toThrow(/website/i);
    expect(generate).not.toHaveBeenCalled();
  });

  it("sends PDFs as document blocks", async () => {
    await ingestFile("org1", { base64: "PDFDATA", mediaType: "application/pdf" });
    const call = generate.mock.calls[0][0];
    expect(call.document).toEqual({ data: "PDFDATA" });
    expect(call.image).toBeUndefined();
  });

  it("sends photos as vision blocks", async () => {
    await ingestFile("org1", { base64: "IMGDATA", mediaType: "image/jpeg" });
    const call = generate.mock.calls[0][0];
    expect(call.image).toEqual({ data: "IMGDATA", mediaType: "image/jpeg" });
    expect(call.document).toBeUndefined();
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

  it("returns zero drafts on unparseable model output (no crash)", async () => {
    generate.mockResolvedValue("sorry, I can't read this");
    const result = await ingestFile("org1", {
      base64: "IMGDATA",
      mediaType: "image/jpeg",
    });
    expect(result.drafts).toBe(0);
  });
});
