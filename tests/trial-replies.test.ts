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
  refundTrialReply,
  reserveTrialReply,
  trialReplySummary,
} from "@/modules/trial/replies";

const NOW = new Date("2026-09-20T00:00:00Z");
const ACTIVE_TRIAL = {
  id: "trial_1",
  orgId: "org_1",
  claimedAt: NOW,
  startedAt: NOW,
  expiresAt: new Date("2026-09-27T00:00:00Z"),
  repliesUsed: 14,
  replyLimit: 15,
  convertedAt: null,
  org: { subscriptionStatus: "inactive" },
};

describe("trial reply allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.acquisitionTrial.findUnique.mockResolvedValue(ACTIVE_TRIAL);
    prisma.acquisitionTrial.updateMany.mockResolvedValue({ count: 1 });
  });

  it("reserves reply 15 with one conditional increment and blocks reply 16", async () => {
    prisma.acquisitionTrial.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(reserveTrialReply("org_1", NOW)).resolves.toMatchObject({
      kind: "reserved",
      repliesUsed: 15,
      repliesRemaining: 0,
    });
    await expect(reserveTrialReply(
      "org_1",
      new Date("2026-09-20T00:00:01Z")
    )).resolves.toMatchObject({ kind: "blocked", status: "exhausted" });
  });

  it("allows only one of two concurrent reservations at reply 15", async () => {
    prisma.acquisitionTrial.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      reserveTrialReply("org_1", NOW),
      reserveTrialReply("org_1", NOW),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual([
      "blocked",
      "reserved",
    ]);
  });

  it("uses one conditional increment scoped to the active allowance", async () => {
    await reserveTrialReply("org_1", NOW);

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: {
        id: "trial_1",
        convertedAt: null,
        expiresAt: { gt: NOW },
        repliesUsed: { lt: 15 },
      },
      data: { repliesUsed: { increment: 1 } },
    });
  });

  it("refunds without allowing the counter below zero", async () => {
    await refundTrialReply("trial_1");

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", repliesUsed: { gt: 0 } },
      data: { repliesUsed: { decrement: 1 } },
    });
  });

  it("does not meter a converted or paid workspace", async () => {
    prisma.acquisitionTrial.findUnique.mockResolvedValue({
      ...ACTIVE_TRIAL,
      org: { subscriptionStatus: "active" },
    });

    await expect(reserveTrialReply("org_1", NOW)).resolves.toEqual({
      kind: "not_trial",
    });
    expect(prisma.acquisitionTrial.updateMany).not.toHaveBeenCalled();
  });

  it("returns an authoritative exhausted summary", async () => {
    prisma.acquisitionTrial.findUnique.mockResolvedValue({
      ...ACTIVE_TRIAL,
      repliesUsed: 15,
    });

    await expect(trialReplySummary("org_1", NOW)).resolves.toEqual({
      status: "exhausted",
      repliesUsed: 15,
      replyLimit: 15,
      repliesRemaining: 0,
    });
  });
});
