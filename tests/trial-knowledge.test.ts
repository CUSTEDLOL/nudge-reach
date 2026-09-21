import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    acquisitionTrial: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import {
  TRIAL_INGEST_BUDGET,
  TRIAL_INTERVIEW_IDS,
  withTrialKnowledgeSource,
} from "@/modules/trial/knowledge";

const TRIAL = {
  id: "trial_1",
  convertedAt: null,
  knowledgeSource: null,
  knowledgeSourceUsedAt: null,
  org: { subscriptionStatus: "inactive" },
};

describe("trial knowledge budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.acquisitionTrial.findUnique.mockResolvedValue(TRIAL);
    prisma.acquisitionTrial.updateMany.mockResolvedValue({ count: 1 });
    prisma.acquisitionTrial.update.mockResolvedValue({});
  });

  it("uses the approved short interview and crawl budget", () => {
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
  });

  it("releases a reserved source when work returns no facts", async () => {
    const result = await withTrialKnowledgeSource(
      "org_1",
      "website",
      async () => ({ drafts: 0 }),
      (value) => value.drafts > 0
    );

    expect(result).toEqual({ drafts: 0 });
    expect(prisma.acquisitionTrial.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "trial_1",
        knowledgeSource: "website",
        knowledgeSourceUsedAt: null,
      },
      data: { knowledgeSource: null },
    });
  });

  it("commits the source when work creates facts", async () => {
    await withTrialKnowledgeSource(
      "org_1",
      "file",
      async () => ({ drafts: 2 }),
      (value) => value.drafts > 0
    );

    expect(prisma.acquisitionTrial.update).toHaveBeenCalledWith({
      where: { id: "trial_1" },
      data: {
        knowledgeSource: "file",
        knowledgeSourceUsedAt: expect.any(Date),
      },
    });
  });

  it("lets paid and non-trial work bypass the allowance", async () => {
    const work = vi.fn(async () => ({ drafts: 3 }));
    prisma.acquisitionTrial.findUnique.mockResolvedValue(null);

    await expect(withTrialKnowledgeSource(
      "org_paid",
      "website",
      work,
      (value) => value.drafts > 0
    )).resolves.toEqual({ drafts: 3 });

    expect(work).toHaveBeenCalledOnce();
    expect(prisma.acquisitionTrial.updateMany).not.toHaveBeenCalled();
  });

  it("bypasses the allowance after a paid subscription activates", async () => {
    const work = vi.fn(async () => ({ drafts: 3 }));
    prisma.acquisitionTrial.findUnique.mockResolvedValue({
      ...TRIAL,
      org: { subscriptionStatus: "active" },
    });

    await expect(withTrialKnowledgeSource(
      "org_paid",
      "website",
      work,
      (value) => value.drafts > 0
    )).resolves.toEqual({ drafts: 3 });

    expect(work).toHaveBeenCalledOnce();
    expect(prisma.acquisitionTrial.updateMany).not.toHaveBeenCalled();
  });

  it("rejects another source after one succeeds", async () => {
    prisma.acquisitionTrial.findUnique.mockResolvedValue({
      ...TRIAL,
      knowledgeSource: "website",
      knowledgeSourceUsedAt: new Date("2026-09-20T00:00:00Z"),
    });

    await expect(withTrialKnowledgeSource(
      "org_1",
      "file",
      vi.fn(),
      () => true
    )).rejects.toThrow("already used its setup source");
  });

  it("fails closed when a concurrent reservation loses", async () => {
    const work = vi.fn();
    prisma.acquisitionTrial.updateMany.mockResolvedValue({ count: 0 });

    await expect(withTrialKnowledgeSource(
      "org_1",
      "website",
      work,
      () => true
    )).rejects.toThrow("Another setup source is already running.");
    expect(work).not.toHaveBeenCalled();
  });
});
