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
  withTrialReplyReservation,
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

  it("does not run an inbound callback after the trial limit", async () => {
    prisma.acquisitionTrial.updateMany.mockResolvedValue({ count: 0 });
    const inbound = vi.fn();

    await expect(
      withTrialReplyReservation("org_1", inbound, NOW)
    ).resolves.toMatchObject({ kind: "blocked", status: "exhausted" });
    expect(inbound).not.toHaveBeenCalled();
  });

  it.each([
    ["provider fallback", { reply: "A person will follow up.", aiFailed: true }],
    ["automation", { reply: "Automated answer", automated: true }],
    ["no reply", { skipped: "no_profile" }],
  ])("refunds the reservation for a non-AI %s", async (_case, result) => {
    const inbound = vi.fn().mockResolvedValue(result);

    await expect(
      withTrialReplyReservation("org_1", inbound, NOW)
    ).resolves.toMatchObject({ kind: "handled", result });

    expect(prisma.acquisitionTrial.updateMany).toHaveBeenLastCalledWith({
      where: { id: "trial_1", repliesUsed: { gt: 0 } },
      data: { repliesUsed: { decrement: 1 } },
    });
  });

  it("keeps the reservation only for an explicitly AI-generated reply", async () => {
    prisma.acquisitionTrial.findUnique
      .mockResolvedValueOnce(ACTIVE_TRIAL)
      .mockResolvedValueOnce({ ...ACTIVE_TRIAL, repliesUsed: 15 });
    const result = {
      conversationId: "conversation_1",
      reply: "We are open tomorrow.",
      generatedByAi: true as const,
    };

    await expect(
      withTrialReplyReservation(
        "org_1",
        vi.fn().mockResolvedValue(result),
        NOW
      )
    ).resolves.toEqual({
      kind: "handled",
      result,
      trial: {
        status: "exhausted",
        repliesUsed: 15,
        replyLimit: 15,
        repliesRemaining: 0,
      },
    });
    expect(prisma.acquisitionTrial.updateMany).toHaveBeenCalledTimes(1);
  });
});
