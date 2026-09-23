import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `structureExistingInfoAction` distills the legacy `businessInfo` blob into
 * facts. It wrote them with a bare `createMany` and no dedupe of any kind, and
 * the card that triggers it never retired — so pressing it twice bought two
 * copies of the same information, and every migrated org had the button sitting
 * there forever.
 *
 * It writes through `storeKnowledgeFacts` now. The store runs for real against
 * an in-memory fake here rather than being mocked, because the whole claim is
 * that the SECOND call sees the first call's rows.
 */

interface Row {
  orgId: string;
  fact: string;
  [key: string]: unknown;
}

const { prisma, store, requireOrgContext, isRestrictedAcquisitionTrial, distillAnswer } =
  vi.hoisted(() => {
    const store = { knowledge: [] as Row[] };
    return {
      store,
      requireOrgContext: vi.fn(),
      isRestrictedAcquisitionTrial: vi.fn(),
      distillAnswer: vi.fn(),
      prisma: {
        agentProfile: { findUnique: vi.fn() },
        knowledgeEntry: {
          findMany: vi.fn(async ({ where }: { where: { orgId: string } }) =>
            store.knowledge.filter((row) => row.orgId === where.orgId)
          ),
          createMany: vi.fn(async ({ data }: { data: Row[] }) => {
            store.knowledge.push(...data);
            return { count: data.length };
          }),
        },
      },
    };
  });

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole: () => undefined }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/knowledge/distill", () => ({ distillAnswer }));
vi.mock("@/modules/knowledge/questions", () => ({
  answerOwnerQuestion: vi.fn(),
  dismissOwnerQuestion: vi.fn(),
}));
vi.mock("@/modules/knowledge/ingest", () => ({
  FILE_MEDIA_TYPES: {},
  MAX_FILE_BYTES: 1,
  ingestFile: vi.fn(),
  ingestGbp: vi.fn(),
  ingestWebsite: vi.fn(),
}));
vi.mock("@/modules/trial/activation", () => ({ activateTrialAgentIfGrounded: vi.fn() }));

import { structureExistingInfoAction } from "@/app/(app)/agent/training-actions";

const BLOB = "HOURS:\nOpen Monday to Saturday.\n\nPRICES:\nConsults cost ₹500.";

beforeEach(() => {
  vi.clearAllMocks();
  store.knowledge = [];
  requireOrgContext.mockResolvedValue({ org: { id: "org_1" }, role: "OWNER" });
  isRestrictedAcquisitionTrial.mockResolvedValue(false);
  prisma.agentProfile.findUnique.mockResolvedValue({ businessInfo: BLOB });
  distillAnswer.mockImplementation(async (_question: string, chunk: string) =>
    chunk.includes("HOURS")
      ? [{ category: "hours", fact: "Open Monday to Saturday." }]
      : [{ category: "pricing", fact: "Consults cost ₹500." }]
  );
});

describe("structuring the legacy blob", () => {
  it("stores one fact per distilled chunk", async () => {
    await expect(structureExistingInfoAction()).resolves.toEqual({
      ok: true,
      message: "Structured 2 facts from your existing info.",
    });
    expect(store.knowledge.map((row) => row.fact)).toEqual([
      "Open Monday to Saturday.",
      "Consults cost ₹500.",
    ]);
  });

  it("a second press adds nothing and says so", async () => {
    await structureExistingInfoAction();

    await expect(structureExistingInfoAction()).resolves.toEqual({
      ok: true,
      message: "Your existing info is already in the fact library — nothing new to add.",
    });
    expect(store.knowledge).toHaveLength(2);
  });

  it("does not re-add a fact the org already holds from another source", async () => {
    store.knowledge.push({
      orgId: "org_1",
      fact: "  open monday to SATURDAY.  ",
      source: "questionnaire",
    });

    await expect(structureExistingInfoAction()).resolves.toEqual({
      ok: true,
      message: "Structured 1 fact from your existing info.",
    });
    expect(store.knowledge).toHaveLength(2);
  });

  it("refuses when there is no blob at all", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ businessInfo: "   " });

    await expect(structureExistingInfoAction()).resolves.toMatchObject({ ok: false });
    expect(distillAnswer).not.toHaveBeenCalled();
  });
});
