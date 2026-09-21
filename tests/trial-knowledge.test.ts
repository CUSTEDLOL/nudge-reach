import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    acquisitionTrial: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import {
  TRIAL_INGEST_BUDGET,
  TRIAL_INTERVIEW_IDS,
  TRIAL_KNOWLEDGE_LIMITS,
  withTrialKnowledgeImport,
} from "@/modules/trial/knowledge";

interface ImportResult {
  drafts: number;
  capacityReached?: boolean;
}

const succeeded = (result: ImportResult) => result.drafts > 0;

const TRIAL = {
  id: "trial_1",
  convertedAt: null,
  knowledgeSource: null,
  knowledgeSourceUsedAt: null,
  knowledgeWebImportsUsed: 0,
  knowledgeFileImportsUsed: 0,
  org: { subscriptionStatus: "inactive" },
};

function counterMutation(
  args: { data?: Record<string, unknown> },
  counter: "knowledgeWebImportsUsed" | "knowledgeFileImportsUsed",
  operation: "increment" | "decrement",
) {
  const value = args.data?.[counter] as Record<string, unknown> | undefined;
  return value?.[operation] === 1;
}

describe("trial knowledge import quotas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.acquisitionTrial.findUnique.mockResolvedValue(TRIAL);
    prisma.acquisitionTrial.updateMany.mockResolvedValue({ count: 1 });
  });

  it("exports the approved interview, ingest, and trial limits", () => {
    expect(TRIAL_INTERVIEW_IDS).toEqual([
      "business_summary",
      "services_list",
      "hours_weekly",
      "location_address",
      "faq_1",
    ]);
    expect(TRIAL_INGEST_BUDGET).toEqual({
      maxSubpages: 1,
      maxChunksPerPage: 2,
      maxDrafts: 25,
    });
    expect(TRIAL_KNOWLEDGE_LIMITS).toEqual({
      webImports: 1,
      fileImports: 3,
      facts: 50,
    });
  });

  it("shares one atomic allowance between website and Google imports", async () => {
    let webImportsUsed = 0;
    let attributed = false;
    prisma.acquisitionTrial.updateMany.mockImplementation(async (args) => {
      if (counterMutation(args, "knowledgeWebImportsUsed", "increment")) {
        if (webImportsUsed >= 1) return { count: 0 };
        webImportsUsed += 1;
        return { count: 1 };
      }
      if (args.data?.knowledgeSourceUsedAt) {
        if (attributed) return { count: 0 };
        attributed = true;
        return { count: 1 };
      }
      return { count: 1 };
    });

    await expect(withTrialKnowledgeImport(
      "org_1",
      "website",
      async () => ({ drafts: 2 }),
      succeeded,
    )).resolves.toEqual({ drafts: 2 });

    await expect(withTrialKnowledgeImport(
      "org_1",
      "gbp",
      vi.fn(),
      succeeded,
    )).rejects.toThrow(/one website or Google Business Profile import/i);

    expect(webImportsUsed).toBe(1);
    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: {
        id: "trial_1",
        convertedAt: null,
        knowledgeWebImportsUsed: { lt: 1 },
      },
      data: { knowledgeWebImportsUsed: { increment: 1 } },
    });
  });

  it("allows three successful file imports and rejects the fourth", async () => {
    let fileImportsUsed = 0;
    prisma.acquisitionTrial.updateMany.mockImplementation(async (args) => {
      if (counterMutation(args, "knowledgeFileImportsUsed", "increment")) {
        if (fileImportsUsed >= 3) return { count: 0 };
        fileImportsUsed += 1;
        return { count: 1 };
      }
      return { count: 0 };
    });
    const work = vi.fn().mockResolvedValue({ drafts: 1 });

    for (let index = 0; index < 3; index += 1) {
      await expect(withTrialKnowledgeImport(
        "org_1",
        "file",
        work,
        succeeded,
      )).resolves.toEqual({ drafts: 1 });
    }
    await expect(withTrialKnowledgeImport(
      "org_1",
      "file",
      work,
      succeeded,
    )).rejects.toThrow(/three file imports/i);

    expect(work).toHaveBeenCalledTimes(3);
    expect(fileImportsUsed).toBe(3);
  });

  it.each([
    ["zero-draft", { drafts: 0 }],
    ["duplicate-only", { drafts: 0, capacityReached: false }],
    ["fact-cap-zero", { drafts: 0, capacityReached: true }],
  ])("refunds only the reserved counter for a %s result", async (_label, result) => {
    await expect(withTrialKnowledgeImport(
      "org_1",
      "file",
      async () => result,
      succeeded,
    )).resolves.toEqual(result);

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "trial_1",
        knowledgeFileImportsUsed: { gt: 0 },
      },
      data: { knowledgeFileImportsUsed: { decrement: 1 } },
    });
    const refund = prisma.acquisitionTrial.updateMany.mock.calls[1][0];
    expect(refund.data).not.toHaveProperty("knowledgeWebImportsUsed");
    expect(refund.data).not.toHaveProperty("knowledgeSource");
  });

  it("refunds a web reservation when import work throws", async () => {
    const failure = new Error("crawl failed");

    await expect(withTrialKnowledgeImport(
      "org_1",
      "website",
      async () => {
        throw failure;
      },
      succeeded,
    )).rejects.toBe(failure);

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "trial_1",
        knowledgeWebImportsUsed: { gt: 0 },
      },
      data: { knowledgeWebImportsUsed: { decrement: 1 } },
    });
  });

  it("preserves the import error when its counter refund also fails", async () => {
    const importFailure = new Error("crawl failed");
    const refundFailure = new Error("refund failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.acquisitionTrial.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(refundFailure);

    await expect(withTrialKnowledgeImport(
      "org_1",
      "website",
      async () => {
        throw importFailure;
      },
      succeeded,
    )).rejects.toBe(importFailure);

    expect(log).toHaveBeenCalledWith(
      "[trial] knowledge quota refund failed",
      expect.objectContaining({ orgId: "org_1", source: "website" }),
      refundFailure,
    );
    log.mockRestore();
  });

  it("refunds a reservation when success evaluation throws", async () => {
    const failure = new Error("bad import result");

    await expect(withTrialKnowledgeImport(
      "org_1",
      "file",
      async () => ({ drafts: 1 }),
      () => {
        throw failure;
      },
    )).rejects.toBe(failure);

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "trial_1",
        knowledgeFileImportsUsed: { gt: 0 },
      },
      data: { knowledgeFileImportsUsed: { decrement: 1 } },
    });
  });

  it("lets only one concurrent caller reserve the final file slot", async () => {
    let fileImportsUsed = 2;
    prisma.acquisitionTrial.updateMany.mockImplementation(async (args) => {
      if (counterMutation(args, "knowledgeFileImportsUsed", "increment")) {
        if (fileImportsUsed >= 3) return { count: 0 };
        fileImportsUsed += 1;
        return { count: 1 };
      }
      return { count: 0 };
    });
    const work = vi.fn().mockResolvedValue({ drafts: 1 });

    const results = await Promise.allSettled([
      withTrialKnowledgeImport("org_1", "file", work, succeeded),
      withTrialKnowledgeImport("org_1", "file", work, succeeded),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(work).toHaveBeenCalledOnce();
    expect(fileImportsUsed).toBe(3);
  });

  it("stamps the first successful source once without overwriting it", async () => {
    let attribution: { source: string; usedAt: Date } | null = null;
    prisma.acquisitionTrial.updateMany.mockImplementation(async (args) => {
      if (
        counterMutation(args, "knowledgeWebImportsUsed", "increment")
        || counterMutation(args, "knowledgeFileImportsUsed", "increment")
      ) {
        return { count: 1 };
      }
      if (args.data?.knowledgeSourceUsedAt) {
        if (attribution) return { count: 0 };
        attribution = {
          source: args.data.knowledgeSource as string,
          usedAt: args.data.knowledgeSourceUsedAt as Date,
        };
        return { count: 1 };
      }
      return { count: 0 };
    });

    await withTrialKnowledgeImport(
      "org_1",
      "website",
      async () => ({ drafts: 1 }),
      succeeded,
    );
    await withTrialKnowledgeImport(
      "org_1",
      "file",
      async () => ({ drafts: 1 }),
      succeeded,
    );

    expect(attribution).toMatchObject({ source: "website" });
    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", knowledgeSourceUsedAt: null },
      data: {
        knowledgeSource: "website",
        knowledgeSourceUsedAt: expect.any(Date),
      },
    });
    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", knowledgeSourceUsedAt: null },
      data: {
        knowledgeSource: "file",
        knowledgeSourceUsedAt: expect.any(Date),
      },
    });
  });

  it("keeps a successful reservation when best-effort attribution fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.acquisitionTrial.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("attribution unavailable"));

    await expect(withTrialKnowledgeImport(
      "org_1",
      "file",
      async () => ({ drafts: 2 }),
      succeeded,
    )).resolves.toEqual({ drafts: 2 });

    expect(log).toHaveBeenCalledWith(
      "[trial] knowledge attribution failed",
      expect.objectContaining({ orgId: "org_1", source: "file" }),
      expect.any(Error),
    );
    expect(prisma.acquisitionTrial.updateMany.mock.calls).toHaveLength(2);
    expect(
      prisma.acquisitionTrial.updateMany.mock.calls.some(([args]) =>
        counterMutation(args, "knowledgeFileImportsUsed", "decrement"),
      ),
    ).toBe(false);
    log.mockRestore();
  });

  it.each([
    ["non-trial", null],
    ["converted", { ...TRIAL, convertedAt: new Date("2026-09-20T00:00:00Z") }],
    ["paid", { ...TRIAL, org: { subscriptionStatus: "active" } }],
  ])("lets %s work bypass import quotas", async (_label, row) => {
    const work = vi.fn().mockResolvedValue({ drafts: 3 });
    prisma.acquisitionTrial.findUnique.mockResolvedValue(row);

    await expect(withTrialKnowledgeImport(
      "org_paid",
      "website",
      work,
      succeeded,
    )).resolves.toEqual({ drafts: 3 });

    expect(work).toHaveBeenCalledOnce();
    expect(prisma.acquisitionTrial.updateMany).not.toHaveBeenCalled();
  });
});
