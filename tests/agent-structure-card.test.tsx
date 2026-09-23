import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Structure my existing info" offers to distill `AgentProfile.businessInfo`
 * into facts. It was shown whenever the blob was non-empty and the org had no
 * ACTIVE fact with `source: "import"` — a test the migration can never satisfy,
 * because `migrateProfileToRules` files its facts as `source: "manual"`,
 * `status: "draft"`. So the card sat on every migrated org forever, and each
 * press re-distilled the same blob into a second, differently-worded copy of
 * what the migration had already queued.
 *
 * The page's child components are stubbed: what is under test is the one
 * boolean it computes, not their markup.
 */

const { prisma, requireOrgContext, migrateProfileOnce, getTrialWorkspace } = vi.hoisted(
  () => ({
    prisma: {
      ownerQuestion: { findMany: vi.fn() },
      knowledgeEntry: { findMany: vi.fn() },
      agentProfile: { findUnique: vi.fn() },
      agentRule: { findMany: vi.fn(), findFirst: vi.fn() },
    },
    requireOrgContext: vi.fn(),
    migrateProfileOnce: vi.fn(),
    getTrialWorkspace: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext,
  hasRole: () => true,
}));
vi.mock("@/modules/agent/migrate-profile", () => ({ migrateProfileOnce }));
vi.mock("@/modules/trial/workspace", () => ({ getTrialWorkspace }));
vi.mock("@/app/(app)/agent/library", () => ({
  Library: ({ showStructureButton }: { showStructureButton: boolean }) =>
    createElement("div", { "data-structure-card": String(showStructureButton) }),
}));
vi.mock("@/app/(app)/agent/auto-reply-switch", () => ({ AutoReplySwitch: () => null }));
vi.mock("@/app/(app)/agent/business-section", () => ({ BusinessSection: () => null }));
vi.mock("@/app/(app)/agent/rules-section", () => ({ RulesSection: () => null }));
vi.mock("@/app/(app)/agent/queue", () => ({ Queue: () => null }));
vi.mock("@/app/(app)/agent/import-panel", () => ({ ImportPanel: () => null }));
vi.mock("@/components/features/front-desk/ai-off-notice", () => ({
  AiOffNotice: () => null,
}));

import AgentPage from "@/app/(app)/agent/page";

type Fact = { id: string; category: string; fact: string; condition: null; source: string };

const fact = (source: string): Fact => ({
  id: `f-${source}`,
  category: "other",
  fact: `a fact from ${source}`,
  condition: null,
  source,
});

/** Renders the page and reports whether the card was offered. */
async function cardShown(options: {
  businessInfo?: string;
  facts?: Fact[];
  migrated?: boolean;
}): Promise<boolean> {
  prisma.knowledgeEntry.findMany.mockImplementation(
    async ({ where }: { where: { status: string } }) =>
      where.status === "active" ? (options.facts ?? []) : []
  );
  prisma.agentProfile.findUnique.mockResolvedValue({
    businessName: "Glow Clinic",
    vertical: "clinic",
    tone: "Warm",
    businessInfo: options.businessInfo ?? "",
    enabled: true,
  });
  prisma.agentRule.findFirst.mockResolvedValue(options.migrated ? { id: "rule_1" } : null);
  const html = renderToStaticMarkup(await AgentPage());
  return html.includes('data-structure-card="true"');
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue({
    org: { id: "org_1", vertical: "clinic" },
    role: "OWNER",
  });
  getTrialWorkspace.mockResolvedValue(null);
  migrateProfileOnce.mockResolvedValue(undefined);
  prisma.ownerQuestion.findMany.mockResolvedValue([]);
  prisma.agentRule.findMany.mockResolvedValue([]);
});

describe("the structure-info card", () => {
  it("is offered to an org whose blob has never been structured", async () => {
    expect(await cardShown({ businessInfo: "Open Mon-Sat. Consults ₹500." })).toBe(true);
  });

  it("retires once the org has been migrated", async () => {
    expect(
      await cardShown({ businessInfo: "Open Mon-Sat. Consults ₹500.", migrated: true })
    ).toBe(false);
  });

  it("asks for the migration's own guard row, not for a fact it never writes", async () => {
    await cardShown({ businessInfo: "Open Mon-Sat." });
    expect(prisma.agentRule.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org_1", source: { startsWith: "migrated_" } },
      select: { id: true },
    });
  });

  it("retires once the blob has been structured by an import or by client setup", async () => {
    expect(await cardShown({ businessInfo: "Open Mon-Sat.", facts: [fact("import")] })).toBe(
      false
    );
    // Concierge setup writes the same six fields the blob is built from.
    expect(await cardShown({ businessInfo: "Open Mon-Sat.", facts: [fact("concierge")] })).toBe(
      false
    );
  });

  it("still shows for an org with unrelated facts and an unstructured blob", async () => {
    expect(
      await cardShown({ businessInfo: "Open Mon-Sat.", facts: [fact("owner_answer")] })
    ).toBe(true);
  });

  it("is never offered when there is no blob to structure", async () => {
    expect(await cardShown({ businessInfo: "   " })).toBe(false);
  });
});
