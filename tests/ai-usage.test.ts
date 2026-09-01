import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * WS2: every LLM call through the model-router records model, tokens and
 * computed cost, attributed to org + conversation. Synthetic counts keep the
 * meter alive in simulation / keyless mode (invariant 4).
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { aiUsage: { create: vi.fn().mockResolvedValue({}) } },
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

import { computeCostMicroUsd, estimateTokens, recordSyntheticUsage } from "@/lib/model-router/usage";
import { chat, runAgent } from "@/lib/model-router";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.aiUsage.create.mockResolvedValue({});
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
    expect(prisma.aiUsage.create.mock.calls[0][0].data.synthetic).toBe(true);
  });
});
