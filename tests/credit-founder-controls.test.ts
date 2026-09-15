import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Founder credit controls (credit ledger, Task 7): validation, the founder
 * grant written in the same transaction as its audit row, the Enterprise
 * included-credits override, and the admin card's summary query.
 */
const { prisma, tx, topUpIncludedGrant } = vi.hoisted(() => {
  const tx = {
    org: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    creditGrant: { create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    topUpIncludedGrant: vi.fn(),
    prisma: {
      org: { findUnique: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      creditGrant: { aggregate: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/billing/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/billing/credits")>()),
  topUpIncludedGrant,
}));

import { grantCredits, setIncludedCreditsOverride } from "@/modules/admin/org-controls";
import { orgCreditSummary } from "@/modules/billing/credit-admin";
import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credits";

const DAY_MS = 86_400_000;

const baseOrg = {
  id: "o1",
  name: "Glow Clinic",
  plan: "enterprise",
  simulated: true,
  suspendedAt: null as Date | null,
  trialEndsAt: null as Date | null,
  subscriptionStatus: "active",
  currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS) as Date | null,
  voiceMinutesOverride: null as number | null,
  includedCreditsOverride: null as number | null,
  featureOverrides: {} as unknown,
  whatsappAccounts: [] as { id: string }[],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ ...baseOrg });
  tx.org.update.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
  tx.creditGrant.create.mockResolvedValue({ id: "g-founder" });
  prisma.$transaction.mockImplementation(async (work) => work(tx));
  topUpIncludedGrant.mockResolvedValue(true);
});

function lastAudit() {
  return tx.auditLog.create.mock.calls.at(-1)?.[0].data;
}

describe("grantCredits", () => {
  it("rejects 0, non-integers, > 400,000, > 730 days without touching the DB", async () => {
    expect((await grantCredits("o1", 0, null, "f@x.com")).ok).toBe(false);
    expect((await grantCredits("o1", 12.5, null, "f@x.com")).ok).toBe(false);
    expect((await grantCredits("o1", 400_001, null, "f@x.com")).ok).toBe(false);
    expect((await grantCredits("o1", 100, 731, "f@x.com")).ok).toBe(false);
    expect((await grantCredits("o1", 100, 0, "f@x.com")).ok).toBe(false);
    expect((await grantCredits("o1", 100, 1.5, "f@x.com")).ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.creditGrant.create).not.toHaveBeenCalled();
  });

  it("writes the founder grant in the same transaction as the admin.credits_granted audit row, keyed on the audit id", async () => {
    const res = await grantCredits("o1", 1_000, null, "f@x.com", "pilot goodwill");
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.creditGrant.create).not.toHaveBeenCalled(); // never outside the tx

    const audit = lastAudit();
    expect(audit.action).toBe("admin.credits_granted");
    expect(audit.actorName).toBe("founder:f@x.com");
    expect(audit.detail).toContain("reason: pilot goodwill");

    const grant = tx.creditGrant.create.mock.calls[0][0].data;
    expect(grant).toMatchObject({
      orgId: "o1",
      kind: "founder",
      sourceKey: "audit-1",
      amountMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      remainingMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      note: "pilot goodwill",
    });
    // Default expiry is 365 days out.
    expect(grant.expiresAt.getTime()).toBeGreaterThan(Date.now() + 364 * DAY_MS);
    expect(grant.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 365 * DAY_MS);
    // The audit row is written first: its id is the grant's idempotency key.
    expect(tx.auditLog.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.creditGrant.create.mock.invocationCallOrder[0]
    );
  });

  it("honours an explicit expiry in days", async () => {
    await grantCredits("o1", 50, 30, "f@x.com");
    const grant = tx.creditGrant.create.mock.calls[0][0].data;
    expect(grant.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    expect(grant.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS);
  });

  it("rejects the transaction when the audit row cannot be written", async () => {
    tx.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(grantCredits("o1", 100, null, "f@x.com")).rejects.toThrow("audit unavailable");
    expect(tx.creditGrant.create).not.toHaveBeenCalled();
  });
});

describe("setIncludedCreditsOverride", () => {
  it("audits before → after and tops up this period", async () => {
    const res = await setIncludedCreditsOverride("o1", 5_000, "f@x.com", "enterprise deal");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0]).toEqual({
      where: { id: "o1" },
      data: { includedCreditsOverride: 5_000 },
    });
    const audit = lastAudit();
    expect(audit.action).toBe("admin.included_credits_changed");
    expect(audit.detail).toContain("none → 5000");
    expect(audit.detail).toContain("reason: enterprise deal");
    expect(topUpIncludedGrant).toHaveBeenCalledWith("o1");
    // Top-up runs after the override is committed, never inside the transaction.
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      topUpIncludedGrant.mock.invocationCallOrder[0]
    );
  });

  it("null clears the override", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, includedCreditsOverride: 5_000 });
    const res = await setIncludedCreditsOverride("o1", null, "f@x.com");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ includedCreditsOverride: null });
    expect(lastAudit().detail).toContain("5000 → none");
  });

  it("rejects negative or non-integer overrides, and a no-op", async () => {
    expect((await setIncludedCreditsOverride("o1", -1, "f@x.com")).ok).toBe(false);
    expect((await setIncludedCreditsOverride("o1", 2.5, "f@x.com")).ok).toBe(false);
    expect((await setIncludedCreditsOverride("o1", 400_001, "f@x.com")).ok).toBe(false);
    expect((await setIncludedCreditsOverride("o1", null, "f@x.com")).ok).toBe(false); // already null
    expect(tx.org.update).not.toHaveBeenCalled();
    expect(topUpIncludedGrant).not.toHaveBeenCalled();
  });

  it("accepts 0 (Enterprise with AI deliberately paused)", async () => {
    const res = await setIncludedCreditsOverride("o1", 0, "f@x.com");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ includedCreditsOverride: 0 });
  });
});

describe("orgCreditSummary", () => {
  it("lists only the org's unexpired grants, newest first, with the balance", async () => {
    const soon = new Date(Date.now() + 5 * DAY_MS);
    prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: 12_345 } });
    prisma.creditGrant.findMany.mockResolvedValue([
      {
        id: "g2",
        kind: "founder",
        amountMicroUsd: 10_000,
        remainingMicroUsd: 7_500,
        expiresAt: soon,
        issuedAt: new Date(),
        note: "pilot",
      },
    ]);

    const summary = await orgCreditSummary("o1");

    expect(summary.balanceMicroUsd).toBe(12_345);
    expect(summary.grants).toEqual([
      expect.objectContaining({ id: "g2", kind: "founder", remainingMicroUsd: 7_500, note: "pilot" }),
    ]);
    const aggArgs = prisma.creditGrant.aggregate.mock.calls[0][0];
    expect(aggArgs.where.orgId).toBe("o1");
    expect(aggArgs.where.expiresAt.gt).toBeInstanceOf(Date);
    const listArgs = prisma.creditGrant.findMany.mock.calls[0][0];
    expect(listArgs.where.orgId).toBe("o1");
    expect(listArgs.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(listArgs.orderBy).toEqual({ issuedAt: "desc" });
  });
});
