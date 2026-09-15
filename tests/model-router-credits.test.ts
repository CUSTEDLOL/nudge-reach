import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The credit ledger's hook in the single doorway (Task 4 of
 * docs/superpowers/plans/2026-09-15-credit-ledger.md): a zero-balance
 * preflight before the provider is called, an exact debit after it, and the
 * paths that are never gated — BYOK, simulation, absorbed purposes, legacy
 * unmetered plans. Extends the tests/ai-usage.test.ts harness.
 */

const { prisma, tx, envState, mockCreate } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    creditGrant: { update: vi.fn() },
    creditDebit: { create: vi.fn() },
  };
  return {
    tx,
    mockCreate: vi.fn(),
    envState: {
      ANTHROPIC_API_KEY: "sk-test",
      RUNTIME_MODEL: "claude-sonnet-5",
      SEND_MODE: "live",
      TOKEN_ENCRYPTION_KEY: "k".repeat(32),
    },
    prisma: {
      aiUsage: { create: vi.fn() },
      org: { findUnique: vi.fn() },
      llmAccount: { findUnique: vi.fn() },
      creditGrant: { aggregate: vi.fn(), create: vi.fn() },
      creditDebit: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { encryptSecret } from "@/lib/crypto";
import { chat, generate, runAgent } from "@/lib/model-router";
import type { UsagePurpose } from "@/lib/model-router/usage";
import { priceCall, UnpricedModelError } from "@/modules/billing/credit-rates";
import { CREDITS_EXHAUSTED_MESSAGE, CreditsExhaustedError } from "@/modules/billing/credits";

const FUTURE = new Date(Date.now() + 30 * 86_400_000);
const starter = {
  id: "org1",
  plan: "starter",
  featureOverrides: {},
  includedCreditsOverride: null,
  trialEndsAt: null,
  subscriptionStatus: "active",
  currentPeriodEnd: FUTURE,
};
const attribution = { orgId: "org1", conversationId: "c1", purpose: "agent_reply" as const };

const reply = (usage: Record<string, number>) => ({
  content: [{ type: "text", text: "hi" }],
  stop_reason: "end_turn",
  usage,
});
const balance = (micro: number | null) => ({ _sum: { remainingMicroUsd: micro } });
const say = (purpose: UsagePurpose = "agent_reply") =>
  chat({ system: "s", messages: [{ role: "user", text: "hello" }], attribution: { ...attribution, purpose } });
const debitRow = () => tx.creditDebit.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  envState.RUNTIME_MODEL = "claude-sonnet-5";
  envState.SEND_MODE = "live";
  prisma.aiUsage.create.mockResolvedValue({ id: "usage_1" });
  prisma.llmAccount.findUnique.mockResolvedValue(null);
  prisma.org.findUnique.mockResolvedValue(starter);
  prisma.creditGrant.aggregate.mockResolvedValue(balance(500_000));
  prisma.creditGrant.create.mockResolvedValue({});
  prisma.creditDebit.create.mockResolvedValue({});
  tx.$queryRaw.mockResolvedValue([{ id: "g1", remainingMicroUsd: 500_000, expiresAt: FUTURE }]);
  tx.creditGrant.update.mockResolvedValue({});
  tx.creditDebit.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work: (t: typeof tx) => unknown) => work(tx));
  mockCreate.mockResolvedValue(reply({ input_tokens: 120, output_tokens: 40 }));
});

describe("metered platform call", () => {
  it("preflights the org's balance, runs the provider, then debits the exact price under the lock", async () => {
    await expect(say()).resolves.toBe("hi");
    expect(prisma.org.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org1" } })
    );
    expect(prisma.creditGrant.aggregate.mock.calls[0][0].where).toMatchObject({ orgId: "org1" });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(prisma.aiUsage.create).toHaveBeenCalledOnce();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(debitRow()).toMatchObject({
      orgId: "org1",
      aiUsageId: "usage_1",
      purpose: "agent_reply",
      model: "claude-sonnet-5",
      amountMicroUsd: priceCall("claude-sonnet-5", { inputTokens: 120, outputTokens: 40 }),
      simulated: false,
      absorbed: false,
    });
  });

  it("preflight throws CreditsExhaustedError at balance ≤ 0 and the provider is never called", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    const err = await say().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CreditsExhaustedError);
    expect((err as Error).message).toBe(CREDITS_EXHAUSTED_MESSAGE);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(prisma.aiUsage.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("preflight retries via ensureIncludedGrant before refusing", async () => {
    prisma.creditGrant.aggregate
      .mockResolvedValueOnce(balance(null)) // no grant yet (comped org before the cron)
      .mockResolvedValueOnce(balance(5_000_000));
    await expect(say()).resolves.toBe("hi");
    expect(prisma.creditGrant.create.mock.calls[0][0].data).toMatchObject({
      orgId: "org1",
      kind: "included",
    });
    expect(prisma.creditGrant.aggregate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("generate() is gated the same way", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue(balance(-200));
    await expect(
      generate({ system: "s", prompt: "p", attribution: { orgId: "org1", purpose: "campaign_copy" } })
    ).rejects.toBeInstanceOf(CreditsExhaustedError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("debit failure is logged with [credits] and the reply is still returned", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(say()).resolves.toBe("hi");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits]"),
      expect.objectContaining({ orgId: "org1", aiUsageId: "usage_1", purpose: "agent_reply" }),
      expect.anything()
    );
    error.mockRestore();
  });

  it("a missing usage row is logged as [credits] usage row missing and nothing is debited", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.aiUsage.create.mockRejectedValueOnce(new Error("db down"));
    await expect(say()).resolves.toBe("hi");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits] usage row missing"),
      expect.objectContaining({ orgId: "org1" })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("runAgent debits once for the whole loop including cache tokens", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "t1", name: "noop", input: {} }],
        stop_reason: "tool_use",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 800,
          cache_creation_input_tokens: 200,
        },
      })
      .mockResolvedValueOnce(
        reply({ input_tokens: 150, output_tokens: 30, cache_read_input_tokens: 1_000 })
      );
    await runAgent({
      system: "s",
      messages: [{ role: "user", text: "go" }],
      tools: [{ name: "noop", description: "d", input_schema: { type: "object" } }],
      runTool: async () => ({ result: "ok" }),
      attribution,
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(debitRow().amountMicroUsd).toBe(
      priceCall("claude-sonnet-5", {
        inputTokens: 250,
        outputTokens: 50,
        cacheReadTokens: 1_800,
        cacheWriteTokens: 200,
      })
    );
  });
});

describe("never gated", () => {
  it("ingest/distill purposes are never preflighted even at balance 0", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    for (const purpose of ["ingest", "distill"] as const) {
      await expect(say(purpose)).resolves.toBe("hi");
    }
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    for (const [i, purpose] of ["ingest", "distill"].entries()) {
      expect(prisma.creditDebit.create.mock.calls[i][0].data).toMatchObject({
        purpose,
        allocations: [],
        absorbed: true,
        simulated: false,
      });
    }
  });

  it("BYOK path skips preflight and debit", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "enterprise" });
    prisma.llmAccount.findUnique.mockResolvedValue({
      orgId: "org1",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKeyEncrypted: encryptSecret("sk-customer"),
    });
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(say()).resolves.toBe("hi");
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5");
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create).not.toHaveBeenCalled();
    expect(prisma.aiUsage.create.mock.calls[0][0].data.byok).toBe(true);
  });

  it("SEND_MODE=simulation → no gate, shadow debit", async () => {
    envState.SEND_MODE = "simulation";
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(say()).resolves.toBe("hi");
    expect(prisma.org.findUnique).not.toHaveBeenCalled();
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      aiUsageId: "usage_1",
      allocations: [],
      simulated: true,
      absorbed: false,
    });
  });

  it("legacy front_desk org is unmetered — never gated, debit recorded", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "front_desk" });
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(say()).resolves.toBe("hi");
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditDebit.create.mock.calls[0][0].data).toMatchObject({
      aiUsageId: "usage_1",
      allocations: [],
      absorbed: true,
    });
  });
});

describe("refused before the provider", () => {
  it("unpriced RUNTIME_MODEL is refused before the provider is called", async () => {
    envState.RUNTIME_MODEL = "claude-sonnet-5-turbo";
    await expect(say()).rejects.toBeInstanceOf(UnpricedModelError);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
  });

  it("platform call without attribution is refused", async () => {
    await expect(
      chat({ system: "s", messages: [{ role: "user", text: "x" }] } as never)
    ).rejects.toThrow(/attribution/);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(prisma.aiUsage.create).not.toHaveBeenCalled();
  });
});
