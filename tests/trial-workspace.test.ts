import { beforeEach, describe, expect, it, vi } from "vitest";

const { trialFindUnique, knowledgeGroupBy, notFound } = vi.hoisted(() => ({
  trialFindUnique: vi.fn(),
  knowledgeGroupBy: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("react", () => ({
  cache: <Args extends unknown[], Result>(
    work: (...args: Args) => Result,
  ) => {
    const entries: Array<{ args: Args; result: Result }> = [];
    return (...args: Args) => {
      const cached = entries.find(
        (entry) =>
          entry.args.length === args.length &&
          entry.args.every((value, index) => Object.is(value, args[index])),
      );
      if (cached) return cached.result;
      const result = work(...args);
      entries.push({ args, result });
      return result;
    };
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionTrial: { findUnique: trialFindUnique },
    knowledgeEntry: { groupBy: knowledgeGroupBy },
  },
}));

import {
  getTrialWorkspace,
  requireAcquisitionTrial,
} from "@/modules/trial/workspace";

const now = new Date("2026-09-21T10:00:00.000Z");

function trialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "trial_1",
    orgId: "org_1",
    claimedAt: new Date("2026-09-20T10:00:00.000Z"),
    emailVerifiedAt: null,
    startedAt: new Date("2026-09-20T10:00:00.000Z"),
    expiresAt: new Date("2026-09-27T10:00:00.000Z"),
    repliesUsed: 0,
    replyLimit: 15,
    knowledgeSource: null,
    knowledgeWebImportsUsed: 0,
    knowledgeFileImportsUsed: 0,
    tourStep: "welcome",
    tourCompletedAt: null,
    tourDismissedAt: null,
    firstReplyAt: null,
    exploreViewedAt: null,
    demoBookedAt: null,
    convertedAt: null,
    org: { subscriptionStatus: "inactive", onboardedAt: null },
    ...overrides,
  };
}

describe("trial workspace projection", () => {
  beforeEach(() => {
    trialFindUnique.mockReset();
    knowledgeGroupBy.mockReset();
    notFound.mockClear();
    knowledgeGroupBy.mockResolvedValue([]);
  });

  it("returns only server-derived workspace state", async () => {
    trialFindUnique.mockResolvedValue(trialRow());

    await expect(getTrialWorkspace("org_1", now)).resolves.toEqual({
      id: "trial_1",
      status: "active",
      emailVerified: false,
      expiresAt: "2026-09-27T10:00:00.000Z",
      repliesUsed: 0,
      replyLimit: 15,
      repliesRemaining: 15,
      setupComplete: false,
      knowledgeSource: null,
      knowledgeReady: false,
      knowledgeCount: 0,
      approvedFactCount: 0,
      draftFactCount: 0,
      factCount: 0,
      factLimit: 50,
      webImportsUsed: 0,
      webImportLimit: 1,
      fileImportsUsed: 0,
      fileImportLimit: 3,
      firstReplyAt: null,
      exploreViewed: false,
      tourStep: "welcome",
      tourCompleted: false,
      tourDismissed: false,
      demoBooked: false,
      converted: false,
    });
    const select = trialFindUnique.mock.calls[0][0].select;
    expect(select.emailVerifiedAt).toBe(true);
    expect(select).not.toHaveProperty("email");
    expect(select).not.toHaveProperty("emailNormalized");
    expect(knowledgeGroupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { orgId: "org_1", status: { in: ["active", "draft"] } },
      _count: { _all: true },
    });
  });

  it("projects verified email proof only as a boolean", async () => {
    trialFindUnique.mockResolvedValue(
      trialRow({
        emailVerifiedAt: new Date("2026-09-22T09:00:00.000Z"),
      }),
    );

    const workspace = await getTrialWorkspace("org_verified", now);

    expect(workspace).toMatchObject({ emailVerified: true });
    expect(workspace).not.toHaveProperty("emailVerifiedAt");
    expect(workspace).not.toHaveProperty("email");
  });

  it("reuses the implicit request-time projection for the same organization", async () => {
    trialFindUnique.mockResolvedValue(trialRow());
    knowledgeGroupBy.mockResolvedValue([
      { status: "active", _count: { _all: 2 } },
    ]);

    const [first, second] = await Promise.all([
      getTrialWorkspace("org_cached"),
      getTrialWorkspace("org_cached"),
    ]);

    expect(first).toBe(second);
    expect(trialFindUnique).toHaveBeenCalledOnce();
    expect(knowledgeGroupBy).toHaveBeenCalledOnce();
  });

  it("projects approved and draft facts plus bounded source allowances", async () => {
    trialFindUnique.mockResolvedValue(
      trialRow({
        knowledgeSource: "website",
        knowledgeWebImportsUsed: 1,
        knowledgeFileImportsUsed: 2,
      }),
    );
    knowledgeGroupBy.mockResolvedValue([
      { status: "active", _count: { _all: 12 } },
      { status: "draft", _count: { _all: 5 } },
    ]);

    await expect(getTrialWorkspace("org_1", now)).resolves.toMatchObject({
      knowledgeReady: true,
      knowledgeCount: 12,
      approvedFactCount: 12,
      draftFactCount: 5,
      factCount: 17,
      factLimit: 50,
      webImportsUsed: 1,
      webImportLimit: 1,
      fileImportsUsed: 2,
      fileImportLimit: 3,
    });
    expect(knowledgeGroupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { orgId: "org_1", status: { in: ["active", "draft"] } },
      _count: { _all: true },
    });
  });

  it("clamps the visible allowance and normalizes persisted UI state", async () => {
    trialFindUnique.mockResolvedValue(
      trialRow({
        repliesUsed: 18,
        replyLimit: 15,
        knowledgeSource: "website",
        tourStep: "unexpected-step",
        firstReplyAt: new Date("2026-09-21T09:00:00.000Z"),
        exploreViewedAt: new Date("2026-09-21T09:10:00.000Z"),
      }),
    );
    knowledgeGroupBy.mockResolvedValue([
      { status: "active", _count: { _all: 4 } },
    ]);

    await expect(getTrialWorkspace("org_1", now)).resolves.toMatchObject({
      status: "exhausted",
      repliesRemaining: 0,
      knowledgeSource: "website",
      knowledgeReady: true,
      knowledgeCount: 4,
      firstReplyAt: "2026-09-21T09:00:00.000Z",
      exploreViewed: true,
      tourStep: "welcome",
    });
  });

  it("returns null for normal workspaces and 404s converted trial routes", async () => {
    trialFindUnique.mockResolvedValueOnce(null);
    await expect(getTrialWorkspace("org_1", now)).resolves.toBeNull();
    expect(knowledgeGroupBy).not.toHaveBeenCalled();

    trialFindUnique.mockResolvedValueOnce(
      trialRow({ convertedAt: new Date("2026-09-21T09:00:00.000Z") }),
    );
    await expect(requireAcquisitionTrial("org_1", now)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });
});
