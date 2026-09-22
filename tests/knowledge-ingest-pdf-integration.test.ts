import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { envState, generate, chat, storeKnowledgeFacts } = vi.hoisted(() => ({
  envState: { ANTHROPIC_API_KEY: undefined as string | undefined },
  generate: vi.fn(),
  chat: vi.fn(),
  storeKnowledgeFacts: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate, chat }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  assertPublicHttpsUrl: vi.fn(),
}));
vi.mock("@/modules/knowledge/store", () => ({ storeKnowledgeFacts }));

import { ingestFile } from "@/modules/knowledge/ingest";

const FIXTURE_PATH = new URL(
  "./fixtures/business-service-guide.pdf.base64",
  import.meta.url,
);

describe("keyless PDF ingestion integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.ANTHROPIC_API_KEY = undefined;
    storeKnowledgeFacts.mockImplementation(async (_orgId, facts) => ({
      created: facts.length,
      capacityReached: false,
    }));
  });

  it("decodes base64 for the real PDF parser and stores deterministic drafts", async () => {
    const base64 = readFileSync(FIXTURE_PATH, "utf8").trim();

    await expect(
      ingestFile(
        "org1",
        { base64, mediaType: "application/pdf" },
        { maxDrafts: 10, activeDraftCap: 50 },
      ),
    ).resolves.toEqual({ drafts: 5, capacityReached: false });

    expect(generate).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
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
        {
          category: "other",
          fact: "Contact: hello@northstar.example | +1 555 010 2040",
        },
        {
          category: "policies",
          fact: "Policy: Cancellations require 24 hours notice.",
        },
      ],
      {
        source: "import",
        status: "draft",
        activeDraftCap: 50,
        maxCreated: 10,
      },
    );
  });
});
