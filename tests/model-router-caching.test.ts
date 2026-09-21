import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Anthropic prompt caching. The system prompt (vertical template + the org's
 * knowledge digest) and the tool schemas are byte-identical across every step
 * of an agent loop and every message in a conversation — so they are the
 * cache prefix. Anthropic renders tools → system → messages, so one
 * breakpoint on the system block covers the tool schemas too.
 *
 * Without this the whole prefix is re-billed at full input price on every
 * call, and a two-tool reply pays for it three times.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    aiUsage: { create: vi.fn().mockResolvedValue({ id: "usage_1" }) },
    llmAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    creditDebit: { create: vi.fn().mockResolvedValue({}) },
  },
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

import { chat, generate, runAgent } from "@/lib/model-router";

const EPHEMERAL = { type: "ephemeral" };

/** The system field of the Nth call to messages.create. */
function systemOf(call: number): unknown {
  return mockCreate.mock.calls[call][0].system;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.aiUsage.create.mockResolvedValue({ id: "usage_1" });
});

describe("prompt caching — system prefix", () => {
  it("chat() marks the system prompt as a cache breakpoint", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await chat({
      system: "BUSINESS KNOWLEDGE: we open at 9am",
      messages: [{ role: "user", text: "when do you open?" }],
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });

    expect(systemOf(0)).toEqual([
      {
        type: "text",
        text: "BUSINESS KNOWLEDGE: we open at 9am",
        cache_control: EPHEMERAL,
      },
    ]);
  });

  it("generate() marks the system prompt as a cache breakpoint", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "copy" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await generate({
      system: "You write campaign copy",
      prompt: "write one",
      attribution: { orgId: "org1", purpose: "campaign_copy" },
    });

    expect(systemOf(0)).toEqual([
      { type: "text", text: "You write campaign copy", cache_control: EPHEMERAL },
    ]);
  });
});

describe("prompt caching — the agent loop", () => {
  const tools = [
    { name: "capture_lead", description: "d", input_schema: { type: "object" as const } },
    { name: "ask_owner", description: "d", input_schema: { type: "object" as const } },
  ];

  it("re-sends an identical cached system prefix on every step, so steps after the first read the cache", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "t1", name: "capture_lead", input: {} }],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "done" }],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 30,
          output_tokens: 10,
          cache_read_input_tokens: 900,
        },
      });

    await runAgent({
      system: "SCOPED FRONT DESK PROMPT",
      messages: [{ role: "user", text: "book me in" }],
      tools,
      runTool: async () => ({ result: "ok" }),
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Byte-identical across steps — any drift here silently costs full price.
    expect(systemOf(0)).toEqual(systemOf(1));
    expect(systemOf(0)).toEqual([
      { type: "text", text: "SCOPED FRONT DESK PROMPT", cache_control: EPHEMERAL },
    ]);
  });

  it("keeps tool order stable across steps (the tool block is part of the cached prefix)", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "t1", name: "ask_owner", input: {} }],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "done" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 30, output_tokens: 10 },
      });

    await runAgent({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
      tools,
      runTool: async () => ({ result: "ok" }),
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });

    const names = (call: number) =>
      (mockCreate.mock.calls[call][0].tools as { name: string }[]).map((t) => t.name);
    expect(names(0)).toEqual(["capture_lead", "ask_owner"]);
    expect(names(1)).toEqual(names(0));
  });

  it("caches the system prefix on the cap-out closing call too", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "t1", name: "ask_owner", input: {} }],
      stop_reason: "tool_use",
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const result = await runAgent({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
      tools,
      runTool: async () => ({ result: "ok" }),
      maxSteps: 2,
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });

    expect(result.cappedOut).toBe(true);
    // 2 loop steps + 1 closing call, all sharing the cached prefix.
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(systemOf(2)).toEqual([
      { type: "text", text: "s", cache_control: EPHEMERAL },
    ]);
  });
});

describe("cache accounting reaches the usage row", () => {
  it("records cache read and write tokens separately from input tokens", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 40,
        output_tokens: 12,
        cache_creation_input_tokens: 3_000,
        cache_read_input_tokens: 0,
      },
    });

    await chat({
      system: "big prompt",
      messages: [{ role: "user", text: "hello" }],
      attribution: { orgId: "org1", purpose: "agent_reply" },
    });
    await new Promise((r) => setTimeout(r, 0));

    const data = prisma.aiUsage.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      inputTokens: 40,
      cacheWriteTokens: 3_000,
      cacheReadTokens: 0,
    });
    // A 3k-token cache write must cost more than 3k plain input tokens (1.25x).
    expect(data.costMicroUsd).toBeGreaterThan(0);
  });
});
