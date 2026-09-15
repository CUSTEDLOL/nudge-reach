import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The debit path (docs/superpowers/plans/2026-09-15-credit-ledger.md, Task 4):
 * an exact post-hoc debit allocated FIFO-by-expiry under a row lock and
 * idempotent on the usage row it prices; shadow (simulated), absorbed and
 * unmetered debits are recorded but touch no grant; settleDebit never throws.
 */

const { prisma, tx, envState } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    creditGrant: { update: vi.fn() },
    creditDebit: { create: vi.fn() },
  };
  return {
    tx,
    envState: { SEND_MODE: "live" },
    prisma: { creditDebit: { create: vi.fn() }, $transaction: vi.fn() },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));

import { RATE_CARD_VERSION, UnpricedModelError } from "@/modules/billing/credit-rates";
import { debitAiUsage, settleDebit } from "@/modules/billing/credits";

const FUTURE = new Date("2026-10-15T00:00:00Z");
// Haiku input is 1,000,000 micro-USD per MTok, so 1 input token = 1 micro-USD.
const usage = { inputTokens: 4_000, outputTokens: 0 };
const metered = {
  orgId: "o1",
  aiUsageId: "u1",
  purpose: "agent_reply",
  model: "claude-haiku-4-5",
  usage,
  simulated: false,
  absorbed: false,
};

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

beforeEach(() => {
  vi.clearAllMocks();
  envState.SEND_MODE = "live";
  prisma.creditDebit.create.mockResolvedValue({});
  tx.creditGrant.update.mockResolvedValue({});
  tx.creditDebit.create.mockResolvedValue({});
  tx.$queryRaw.mockResolvedValue([
    { id: "g1", remainingMicroUsd: 3_000, expiresAt: FUTURE },
    { id: "g2", remainingMicroUsd: 5_000, expiresAt: new Date("2026-11-01T00:00:00Z") },
  ]);
  prisma.$transaction.mockImplementation(async (work) => work(tx));
});

describe("debitAiUsage — metered", () => {
  it("locks the org's unexpired grants with SELECT … FOR UPDATE ordered by expiresAt", async () => {
    await debitAiUsage(metered);
    const [strings, orgId] = tx.$queryRaw.mock.calls[0];
    const sql = (strings as string[]).join("$").replace(/\s+/g, " ").trim();
    expect(sql).toContain('SELECT id, "remainingMicroUsd", "expiresAt" FROM "CreditGrant"');
    expect(sql).toContain('WHERE "orgId" = $ AND "expiresAt" > now()');
    expect(sql).toMatch(/ORDER BY "expiresAt" ASC, "issuedAt" ASC FOR UPDATE$/);
    expect(orgId).toBe("o1");
  });

  it("writes allocations and decrements each grant", async () => {
    await debitAiUsage(metered);
    expect(tx.creditGrant.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "g1" }, data: { remainingMicroUsd: { decrement: 3_000 } } },
      { where: { id: "g2" }, data: { remainingMicroUsd: { decrement: 1_000 } } },
    ]);
    expect(tx.creditDebit.create).toHaveBeenCalledOnce();
    expect(tx.creditDebit.create.mock.calls[0][0].data).toEqual({
      orgId: "o1",
      amountMicroUsd: 4_000,
      purpose: "agent_reply",
      model: "claude-haiku-4-5",
      rateCardVersion: RATE_CARD_VERSION,
      aiUsageId: "u1",
      allocations: [
        { grantId: "g1", microUsd: 3_000 },
        { grantId: "g2", microUsd: 1_000 },
      ],
      simulated: false,
      absorbed: false,
    });
    expect(prisma.creditDebit.create).not.toHaveBeenCalled();
  });

  it("overdraws the latest-expiring grant when the grants are short", async () => {
    tx.$queryRaw.mockResolvedValue([{ id: "g1", remainingMicroUsd: 1_000, expiresAt: FUTURE }]);
    await debitAiUsage(metered);
    expect(tx.creditGrant.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "g1" }, data: { remainingMicroUsd: { decrement: 1_000 } } },
      { where: { id: "g1" }, data: { remainingMicroUsd: { decrement: 3_000 } } },
    ]);
    expect(tx.creditDebit.create.mock.calls[0][0].data.allocations).toEqual([
      { grantId: "g1", microUsd: 1_000 },
    ]);
  });

  it("P2002 on aiUsageId returns without a second decrement", async () => {
    tx.creditDebit.create.mockRejectedValueOnce(duplicate());
    await expect(debitAiUsage(metered)).resolves.toBeUndefined();
    expect(tx.creditGrant.update).not.toHaveBeenCalled();
  });

  it("throws when the org has no unexpired grant (the reconciler retries)", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(debitAiUsage(metered)).rejects.toThrow(/no grant/);
    expect(tx.creditDebit.create).not.toHaveBeenCalled();
  });

  it("refuses an unpriced model before anything is written", async () => {
    await expect(debitAiUsage({ ...metered, model: "gpt-5" })).rejects.toBeInstanceOf(
      UnpricedModelError
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create).not.toHaveBeenCalled();
  });
});

describe("debitAiUsage — no grant touched", () => {
  it("simulated debit writes allocations [] and touches no grant", async () => {
    await debitAiUsage({ ...metered, simulated: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      orgId: "o1",
      amountMicroUsd: 4_000,
      aiUsageId: "u1",
      allocations: [],
      simulated: true,
      absorbed: false,
    });
  });

  it("absorbed debit (ingest/distill) writes allocations [] and touches no grant", async () => {
    await debitAiUsage({ ...metered, purpose: "ingest", absorbed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      purpose: "ingest",
      allocations: [],
      simulated: false,
      absorbed: true,
    });
  });

  it("a repeated simulated debit (P2002) is quiet", async () => {
    prisma.creditDebit.create.mockRejectedValueOnce(duplicate());
    await expect(debitAiUsage({ ...metered, simulated: true })).resolves.toBeUndefined();
  });
});

describe("settleDebit — never throws, never silent", () => {
  const attribution = { orgId: "o1", conversationId: "c1", purpose: "agent_reply" as const };
  const base = { attribution, model: "claude-haiku-4-5", usage, aiUsageId: "u1" };

  it("debits a metered call under the lock", async () => {
    await settleDebit({ ...base, metering: "metered" });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      aiUsageId: "u1",
      simulated: false,
      absorbed: false,
    });
  });

  it("records a shadow debit for simulation and an absorbed one for ingest", async () => {
    await settleDebit({ ...base, metering: "shadow" });
    await settleDebit({ ...base, attribution: { ...attribution, purpose: "ingest" }, metering: "absorbed" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({ simulated: true });
    expect(prisma.creditDebit.create.mock.calls[1][0].data).toMatchObject({ absorbed: true });
  });

  it("records a legacy unmetered org's debit as absorbed (Nudge pays, no grant to charge)", async () => {
    await settleDebit({ ...base, metering: "unmetered" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      allocations: [],
      simulated: false,
      absorbed: true,
    });
  });

  it("logs [credits] and returns when the debit fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(settleDebit({ ...base, metering: "metered" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits] debit failed"),
      { orgId: "o1", aiUsageId: "u1", purpose: "agent_reply" },
      expect.anything()
    );
    error.mockRestore();
  });

  it("logs [credits] usage row missing when there is no usage row to anchor on", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await settleDebit({ ...base, aiUsageId: null, metering: "metered" });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits] usage row missing"),
      expect.objectContaining({ orgId: "o1", purpose: "agent_reply" })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
