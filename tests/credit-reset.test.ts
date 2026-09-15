import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credit grants (docs/superpowers/plans/2026-09-15-credit-ledger.md, Task 3):
 * the 100-credit trial grant, the included grant issued per paid period and
 * keyed on currentPeriodEnd ("reset on the payment date"), the cron
 * back-fill for comped/Enterprise orgs, and the same-period top-up.
 */

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    org: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    creditGrant: { update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return {
    tx,
    prisma: {
      org: { findMany: vi.fn(), findUnique: vi.fn() },
      creditGrant: { create: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));

import {
  MICRO_USD_PER_CREDIT,
  ensureIncludedGrant,
  issueIncludedCredits,
  issueTrialGrant,
  topUpIncludedGrant,
} from "@/modules/billing/credits";
import { setTrial } from "@/modules/admin/org-controls";

const NOW = new Date("2026-09-15T10:00:00Z");
const PERIOD_END = new Date("2026-10-15T09:30:00Z");

const starter = {
  id: "o1",
  plan: "starter",
  featureOverrides: {},
  includedCreditsOverride: null,
  trialEndsAt: null,
  subscriptionStatus: "active",
  currentPeriodEnd: PERIOD_END,
};

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.creditGrant.create.mockResolvedValue({});
  prisma.creditGrant.findMany.mockResolvedValue([]);
  prisma.org.findMany.mockResolvedValue([]);
  tx.org.update.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({});
  tx.creditGrant.update.mockResolvedValue({});
  tx.creditGrant.upsert.mockResolvedValue({});
  tx.creditGrant.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation(async (work) => work(tx));
});

const created = (i = 0) => prisma.creditGrant.create.mock.calls[i][0].data;

describe("ensureIncludedGrant", () => {
  it("keys the grant on currentPeriodEnd and expires it there", async () => {
    expect(await ensureIncludedGrant(starter, NOW)).toBe(true);
    expect(created()).toEqual({
      orgId: "o1",
      kind: "included",
      sourceKey: "2026-10-15",
      amountMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      remainingMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      expiresAt: PERIOD_END,
    });
  });

  it("a second call for the same period is a no-op (P2002)", async () => {
    prisma.creditGrant.create.mockRejectedValueOnce(duplicate());
    expect(await ensureIncludedGrant(starter, NOW)).toBe(false);
    // Anything else is a real failure and must surface.
    prisma.creditGrant.create.mockRejectedValueOnce(new Error("db down"));
    await expect(ensureIncludedGrant(starter, NOW)).rejects.toThrow("db down");
  });

  it("a renewal (new currentPeriodEnd) issues a fresh grant", async () => {
    await ensureIncludedGrant(starter, NOW);
    const renewed = new Date("2026-11-15T09:30:00Z");
    await ensureIncludedGrant({ ...starter, currentPeriodEnd: renewed }, new Date("2026-10-15T12:00:00Z"));
    expect(created(0).sourceKey).toBe("2026-10-15");
    expect(created(1).sourceKey).toBe("2026-11-15");
    expect(created(1).expiresAt).toBe(renewed);
  });

  it("issues nothing to unmetered, inactive, lapsed or trialling orgs", async () => {
    expect(await ensureIncludedGrant({ ...starter, plan: "front_desk" }, NOW)).toBe(false);
    expect(await ensureIncludedGrant({ ...starter, subscriptionStatus: "past_due" }, NOW)).toBe(false);
    expect(await ensureIncludedGrant({ ...starter, currentPeriodEnd: null }, NOW)).toBe(false);
    expect(await ensureIncludedGrant({ ...starter, currentPeriodEnd: new Date("2026-09-01T00:00:00Z") }, NOW)).toBe(false);
    expect(await ensureIncludedGrant({ ...starter, trialEndsAt: new Date("2026-09-20T00:00:00Z") }, NOW)).toBe(false);
    expect(prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("enterprise uses includedCreditsOverride, and a missing override still anchors a 0 grant", async () => {
    await ensureIncludedGrant({ ...starter, plan: "enterprise", includedCreditsOverride: 3_000 }, NOW);
    expect(created(0).amountMicroUsd).toBe(3_000 * MICRO_USD_PER_CREDIT);
    await ensureIncludedGrant({ ...starter, plan: "enterprise" }, NOW);
    expect(created(1).amountMicroUsd).toBe(0);
    expect(created(1).remainingMicroUsd).toBe(0);
  });
});

describe("issueIncludedCredits", () => {
  it("back-fills only active, non-trial, metered orgs with a future currentPeriodEnd", async () => {
    prisma.org.findMany.mockResolvedValue([
      starter,
      { ...starter, id: "o2", plan: "front_desk" }, // legacy: unmetered
      { ...starter, id: "o3", plan: "growth" }, // already has this period's grant
    ]);
    prisma.creditGrant.findMany.mockResolvedValue([{ orgId: "o3", sourceKey: "2026-10-15" }]);

    expect(await issueIncludedCredits(NOW)).toBe(1);

    expect(prisma.org.findMany.mock.calls[0][0].where).toEqual({
      subscriptionStatus: "active",
      currentPeriodEnd: { gt: NOW },
      OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: NOW } }],
    });
    expect(prisma.creditGrant.create).toHaveBeenCalledTimes(1);
    expect(created().orgId).toBe("o1");
  });
});

describe("topUpIncludedGrant", () => {
  const lockedGrant = (amountCredits: number) =>
    tx.$queryRaw.mockResolvedValue([{ id: "g1", amountMicroUsd: amountCredits * MICRO_USD_PER_CREDIT }]);

  it("adds only the difference on upgrade and nothing on downgrade", async () => {
    // Starter (1,000) → Growth (2,500) inside the same period.
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "growth" });
    lockedGrant(1_000);
    expect(await topUpIncludedGrant("o1", NOW)).toBe(true);
    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: {
        amountMicroUsd: { increment: 1_500 * MICRO_USD_PER_CREDIT },
        remainingMicroUsd: { increment: 1_500 * MICRO_USD_PER_CREDIT },
      },
    });

    // Growth (2,500) → Starter (1,000): the grant is left alone.
    prisma.org.findUnique.mockResolvedValue(starter);
    lockedGrant(2_500);
    expect(await topUpIncludedGrant("o1", NOW)).toBe(false);
    expect(tx.creditGrant.update).toHaveBeenCalledTimes(1);
  });

  it("issues the period's grant when there is none yet", async () => {
    prisma.org.findUnique.mockResolvedValue(starter);
    tx.$queryRaw.mockResolvedValue([]);
    expect(await topUpIncludedGrant("o1", NOW)).toBe(true);
    expect(created().sourceKey).toBe("2026-10-15");
    expect(tx.creditGrant.update).not.toHaveBeenCalled();
  });

  it("does nothing for an org that is not due an included grant", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, subscriptionStatus: "cancelled" });
    expect(await topUpIncludedGrant("o1", NOW)).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("issueTrialGrant", () => {
  it("is 100 credits expiring at trialEndsAt", async () => {
    const trialEndsAt = new Date("2026-09-22T10:00:00Z");
    await issueTrialGrant("o1", trialEndsAt);
    expect(created()).toEqual({
      orgId: "o1",
      kind: "trial",
      sourceKey: "trial",
      amountMicroUsd: 100 * MICRO_USD_PER_CREDIT,
      remainingMicroUsd: 100 * MICRO_USD_PER_CREDIT,
      expiresAt: trialEndsAt,
    });
    // Already issued → quiet.
    prisma.creditGrant.create.mockRejectedValueOnce(duplicate());
    await expect(issueTrialGrant("o1", trialEndsAt)).resolves.toBeUndefined();
  });
});

describe("setTrial", () => {
  beforeEach(() => {
    prisma.org.findUnique.mockResolvedValue({
      id: "o1",
      name: "Glow Clinic",
      trialEndsAt: null,
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
    });
  });

  it("moves the trial grant expiry", async () => {
    expect((await setTrial("o1", 14, "f@x.com")).ok).toBe(true);
    const trialEndsAt = tx.org.update.mock.calls[0][0].data.trialEndsAt;
    const upsert = tx.creditGrant.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({
      orgId_kind_sourceKey: { orgId: "o1", kind: "trial", sourceKey: "trial" },
    });
    expect(upsert.update).toEqual({ expiresAt: trialEndsAt });
    // A workspace that never had a trial grant gets the standard one.
    expect(upsert.create).toMatchObject({
      orgId: "o1",
      kind: "trial",
      amountMicroUsd: 100 * MICRO_USD_PER_CREDIT,
      expiresAt: trialEndsAt,
    });
  });

  it("0 days expires the trial grant now", async () => {
    await setTrial("o1", 0, "f@x.com");
    expect(tx.creditGrant.upsert).not.toHaveBeenCalled();
    const call = tx.creditGrant.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ orgId: "o1", kind: "trial" });
    expect(call.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
