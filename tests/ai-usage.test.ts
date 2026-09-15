import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * WS2: every LLM call through the model-router records model, tokens and
 * computed cost, attributed to org + conversation. Synthetic counts keep the
 * meter alive in simulation / keyless mode (invariant 4).
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { aiUsage: { create: vi.fn().mockResolvedValue({ id: "usage_1" }) } },
}));
vi.mock("@/lib/db", () => ({ prisma }));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    ANTHROPIC_API_KEY: "sk-test",
    RUNTIME_MODEL: "claude-sonnet-5",
    SEND_MODE: "simulation",
  },
}));

import {
  computeCostMicroUsd,
  estimateTokens,
  recordSyntheticUsage,
  recordUsage,
} from "@/lib/model-router/usage";
import { chat, runAgent } from "@/lib/model-router";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.aiUsage.create.mockResolvedValue({ id: "usage_1" });
});

describe("computeCostMicroUsd", () => {
  it("prices Sonnet at $3/MTok in, $15/MTok out", () => {
    // 1M in + 1M out = $18 = 18_000_000 micro-USD
    expect(computeCostMicroUsd("claude-sonnet-5", 1_000_000, 1_000_000)).toBe(
      18_000_000
    );
  });

  it("prices Haiku cheaper than Sonnet", () => {
    expect(
      computeCostMicroUsd("claude-haiku-4-5", 1_000_000, 1_000_000)
    ).toBeLessThan(computeCostMicroUsd("claude-sonnet-5", 1_000_000, 1_000_000));
  });

  it("prices an unknown model as Sonnet (conservative)", () => {
    expect(computeCostMicroUsd("mystery-model", 1000, 1000)).toBe(
      computeCostMicroUsd("claude-sonnet-5", 1000, 1000)
    );
  });
});

describe("router usage recording", () => {
  it("chat() with attribution writes an AiUsage row from response.usage", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 120, output_tokens: 40 },
    });
    await chat({
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      attribution: { orgId: "org1", conversationId: "c1", purpose: "agent_reply" },
    });
    // fire-and-forget: flush microtasks
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.aiUsage.create).toHaveBeenCalledOnce();
    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      orgId: "org1",
      conversationId: "c1",
      purpose: "agent_reply",
      model: "claude-sonnet-5",
      inputTokens: 120,
      outputTokens: 40,
      synthetic: false,
    });
    expect(data.costMicroUsd).toBeGreaterThan(0);
    // No caching on this call → the cache columns are explicit zeros.
    expect(data.cacheReadTokens).toBe(0);
    expect(data.cacheWriteTokens).toBe(0);
  });

  it("chat() stores Anthropic cache read/write tokens on the AiUsage row", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 120,
        output_tokens: 40,
        cache_read_input_tokens: 800,
        cache_creation_input_tokens: 200,
      },
    });
    await chat({
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });
    await new Promise((r) => setTimeout(r, 0));
    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      inputTokens: 120,
      outputTokens: 40,
      cacheReadTokens: 800,
      cacheWriteTokens: 200,
    });
  });

  it("chat() without attribution writes nothing", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    await chat({ system: "s", messages: [{ role: "user", text: "x" }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.aiUsage.create).not.toHaveBeenCalled();
  });

  it("runAgent() accumulates usage across loop steps into one row", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "t1", name: "noop", input: {} },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "done" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 150, output_tokens: 30 },
      });
    await runAgent({
      system: "s",
      messages: [{ role: "user", text: "go" }],
      tools: [{ name: "noop", description: "d", input_schema: { type: "object" } }],
      runTool: async () => ({ result: "ok" }),
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.aiUsage.create).toHaveBeenCalledOnce();
    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data.inputTokens).toBe(250);
    expect(data.outputTokens).toBe(50);
  });
});

describe("recordUsage", () => {
  const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2 };

  it("resolves to the new AiUsage row id and stores cache tokens", async () => {
    const id = await recordUsage({ orgId: "org1", purpose: "suggest" }, "claude-sonnet-5", usage);
    expect(id).toBe("usage_1");
    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 3,
      cacheWriteTokens: 2,
      byok: false,
    });
  });

  it("resolves to null and never throws when the write fails", async () => {
    prisma.aiUsage.create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordUsage({ orgId: "org1", purpose: "suggest" }, "claude-sonnet-5", usage)
    ).resolves.toBeNull();
  });
});

describe("synthetic usage (simulation / keyless)", () => {
  it("estimateTokens approximates chars/4 with a floor of 1", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("")).toBe(1);
  });

  it("recordSyntheticUsage writes a synthetic row", async () => {
    recordSyntheticUsage(
      { orgId: "org1", purpose: "suggest" },
      "some prompt text",
      "reply text"
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.aiUsage.create).toHaveBeenCalledOnce();
    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data.synthetic).toBe(true);
    // Synthetic rows never carry cache tokens.
    expect(data.cacheReadTokens).toBe(0);
    expect(data.cacheWriteTokens).toBe(0);
  });
});
