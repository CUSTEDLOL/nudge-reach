import { beforeEach, describe, expect, it, vi } from "vitest";

const { trialFindUnique, knowledgeCount, notFound } = vi.hoisted(() => ({
  trialFindUnique: vi.fn(),
  knowledgeCount: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionTrial: { findUnique: trialFindUnique },
    knowledgeEntry: { count: knowledgeCount },
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
    startedAt: new Date("2026-09-20T10:00:00.000Z"),
    expiresAt: new Date("2026-09-27T10:00:00.000Z"),
    repliesUsed: 0,
    replyLimit: 15,
    knowledgeSource: null,
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
    knowledgeCount.mockReset();
    notFound.mockClear();
    knowledgeCount.mockResolvedValue(0);
  });

  it("returns only server-derived workspace state", async () => {
    trialFindUnique.mockResolvedValue(trialRow());

    await expect(getTrialWorkspace("org_1", now)).resolves.toEqual({
      id: "trial_1",
      status: "active",
      expiresAt: "2026-09-27T10:00:00.000Z",
      repliesUsed: 0,
      replyLimit: 15,
      repliesRemaining: 15,
      setupComplete: false,
      knowledgeSource: null,
      knowledgeReady: false,
      knowledgeCount: 0,
      firstReplyAt: null,
      exploreViewed: false,
      tourStep: "welcome",
      tourCompleted: false,
      tourDismissed: false,
      demoBooked: false,
      converted: false,
    });
    expect(knowledgeCount).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: "active" },
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
    knowledgeCount.mockResolvedValue(4);

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
    expect(knowledgeCount).not.toHaveBeenCalled();

    trialFindUnique.mockResolvedValueOnce(
      trialRow({ convertedAt: new Date("2026-09-21T09:00:00.000Z") }),
    );
    await expect(requireAcquisitionTrial("org_1", now)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });
});
