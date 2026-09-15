import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reconciler (Task 4 of docs/superpowers/plans/2026-09-15-credit-ledger.md):
 * every platform, non-synthetic AiUsage row newer than CREDIT_LEDGER_EPOCH
 * with no CreditDebit is re-debited on the cron tick — idempotent on the
 * usage row, absorbed for ingest/distill and legacy unmetered orgs, counted
 * and logged but never thrown on a per-row failure.
 */

const { prisma, tx, envState } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    creditGrant: { update: vi.fn() },
    creditDebit: { create: vi.fn() },
  };
  return {
    tx,
    envState: { SEND_MODE: "live", CREDIT_LEDGER_EPOCH: "2026-09-15" },
    prisma: {
      aiUsage: { findMany: vi.fn() },
      org: { findMany: vi.fn() },
      creditDebit: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));

import { reconcileCreditDebits } from "@/modules/billing/credits";

const NOW = new Date("2026-09-16T10:00:00Z");
const row = (id: string, purpose = "agent_reply", orgId = "o1") => ({
  id,
  orgId,
  purpose,
  model: "claude-haiku-4-5",
  inputTokens: 4_000,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  envState.SEND_MODE = "live";
  prisma.aiUsage.findMany.mockResolvedValue([]);
  prisma.org.findMany.mockResolvedValue([]);
  prisma.creditDebit.create.mockResolvedValue({});
  tx.$queryRaw.mockResolvedValue([{ id: "g1", remainingMicroUsd: 100_000, expiresAt: new Date("2026-10-15") }]);
  tx.creditGrant.update.mockResolvedValue({});
  tx.creditDebit.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work: (t: typeof tx) => unknown) => work(tx));
});

describe("reconcileCreditDebits", () => {
  it("re-debits platform non-synthetic AiUsage rows after the epoch with no CreditDebit", async () => {
    prisma.aiUsage.findMany.mockResolvedValue([row("u1"), row("u2")]);
    await expect(reconcileCreditDebits(NOW)).resolves.toEqual({ debited: 2, failed: 0 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.creditDebit.create.mock.calls.map((c) => c[0].data.aiUsageId)).toEqual(["u1", "u2"]);
    expect(tx.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      orgId: "o1",
      amountMicroUsd: 4_000,
      simulated: false,
      absorbed: false,
    });
  });

  it("ignores byok, synthetic and pre-epoch rows, oldest first, in a bounded batch", async () => {
    await reconcileCreditDebits(NOW);
    expect(prisma.aiUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          byok: false,
          synthetic: false,
          createdAt: { gte: new Date("2026-09-15") },
          creditDebit: null,
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      })
    );
  });

  it("marks ingest/distill rows absorbed", async () => {
    prisma.aiUsage.findMany.mockResolvedValue([row("u1", "ingest"), row("u2", "distill")]);
    await expect(reconcileCreditDebits(NOW)).resolves.toEqual({ debited: 2, failed: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    for (const call of prisma.creditDebit.create.mock.calls) {
      expect(call[0].data).toMatchObject({ allocations: [], absorbed: true, simulated: false });
    }
  });

  it("marks a legacy unmetered org's rows absorbed", async () => {
    prisma.aiUsage.findMany.mockResolvedValue([row("u1", "agent_reply", "legacy")]);
    prisma.org.findMany.mockResolvedValue([
      { id: "legacy", plan: "front_desk", featureOverrides: {}, includedCreditsOverride: null, trialEndsAt: null },
    ]);
    await expect(reconcileCreditDebits(NOW)).resolves.toEqual({ debited: 1, failed: 0 });
    expect(prisma.org.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["legacy"] } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({ absorbed: true });
  });

  it("under SEND_MODE=simulation the re-debit is a shadow debit", async () => {
    envState.SEND_MODE = "simulation";
    prisma.aiUsage.findMany.mockResolvedValue([row("u1")]);
    await reconcileCreditDebits(NOW);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({ simulated: true });
  });

  it("reports counts and keeps going after a failed row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.aiUsage.findMany.mockResolvedValue([row("u1"), row("u2")]);
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(reconcileCreditDebits(NOW)).resolves.toEqual({ debited: 1, failed: 1 });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits]"),
      expect.objectContaining({ orgId: "o1", aiUsageId: "u1", purpose: "agent_reply" }),
      expect.anything()
    );
    error.mockRestore();
  });

  it("counts a row debited in the meantime (P2002) as debited", async () => {
    prisma.aiUsage.findMany.mockResolvedValue([row("u1")]);
    tx.creditDebit.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })
    );
    await expect(reconcileCreditDebits(NOW)).resolves.toEqual({ debited: 1, failed: 0 });
  });
});
