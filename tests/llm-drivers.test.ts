import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E3: the OpenAI and Gemini drivers marshal the neutral chat/agent shapes
 * into their SDK wire formats correctly — tool loop included. SDKs mocked.
 * The Anthropic driver additionally surfaces prompt-cache tokens, which the
 * credit ledger prices separately (cache reads are ~10% of input price).
 */

const { openaiCreate, geminiGenerate, anthropicCreate } = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  geminiGenerate: vi.fn(),
  anthropicCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiGenerate };
  },
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));

import { openaiDriver } from "@/lib/model-router/drivers/openai";
import { geminiDriver } from "@/lib/model-router/drivers/gemini";
import { anthropicDriver } from "@/lib/model-router/drivers/anthropic";

const rt = { model: "test-model", apiKey: "sk-x" };
const TOOLS = [
  {
    name: "check_order_status",
    description: "look up an order",
    input_schema: { type: "object" as const, properties: {} },
  },
];

beforeEach(() => {
  openaiCreate.mockReset();
  geminiGenerate.mockReset();
  anthropicCreate.mockReset();
});

describe("anthropicDriver", () => {
  it("chat: surfaces cache read/write tokens alongside input/output", async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: " hello " }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 11,
        output_tokens: 7,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 100,
      },
    });
    const r = await anthropicDriver.chat(rt, {
      system: "sys",
      messages: [{ role: "user", text: "hi" }],
      maxTokens: 100,
    });
    expect(r.text).toBe("hello");
    expect(r.usage).toEqual({
      inputTokens: 11,
      outputTokens: 7,
      cacheReadTokens: 900,
      cacheWriteTokens: 100,
    });
  });

  it("chat: null cache fields (no caching) read as 0", async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 5,
        output_tokens: 2,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
      },
    });
    const r = await anthropicDriver.chat(rt, {
      system: "sys",
      messages: [{ role: "user", text: "hi" }],
      maxTokens: 100,
    });
    expect(r.usage).toEqual({
      inputTokens: 5,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });

  it("agent loop: tallies cache tokens across every step, closing call included", async () => {
    anthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "t1", name: "check_order_status", input: {} }],
        stop_reason: "tool_use",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 20,
        },
      })
      // maxSteps: 1 → the loop is capped and one closing call follows.
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Wrapping up." }],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 15,
          output_tokens: 6,
          cache_read_input_tokens: 200,
          cache_creation_input_tokens: 30,
        },
      });
    const runTool = vi.fn().mockResolvedValue({ result: "shipped" });

    const r = await anthropicDriver.runAgent(rt, {
      system: "sys",
      messages: [{ role: "user", text: "where is order 9?" }],
      tools: TOOLS,
      runTool,
      maxTokens: 100,
      maxSteps: 1,
    });
    expect(runTool).toHaveBeenCalledOnce();
    expect(r.cappedOut).toBe(true);
    expect(r.usage).toEqual({
      inputTokens: 25,
      outputTokens: 11,
      cacheReadTokens: 300,
      cacheWriteTokens: 50,
    });
  });
});

describe("openaiDriver", () => {
  it("chat: system + turns in, text + usage out", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: " hello " } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const r = await openaiDriver.chat(rt, {
      system: "sys",
      messages: [{ role: "user", text: "hi" }],
      maxTokens: 100,
    });
    expect(r.text).toBe("hello");
    expect(r.usage).toMatchObject({ inputTokens: 11, outputTokens: 7 });
    const call = openaiCreate.mock.calls[0][0];
    expect(call.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(call.model).toBe("test-model");
  });

  it("agent loop: executes a tool call, feeds the result back, returns final text", async () => {
    openaiCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "c1",
                  type: "function",
                  function: { name: "check_order_status", arguments: '{"order_id":"9"}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Order 9 has shipped!" } }],
        usage: { prompt_tokens: 20, completion_tokens: 8 },
      });
    const runTool = vi.fn().mockResolvedValue({ result: "shipped" });

    const r = await openaiDriver.runAgent(rt, {
      system: "sys",
      messages: [{ role: "user", text: "where is order 9?" }],
      tools: TOOLS,
      runTool,
      maxTokens: 100,
      maxSteps: 5,
    });
    expect(runTool).toHaveBeenCalledWith({
      name: "check_order_status",
      input: { order_id: "9" },
    });
    expect(r.text).toBe("Order 9 has shipped!");
    expect(r.toolCalls).toHaveLength(1);
    expect(r.cappedOut).toBe(false);
    expect(r.usage).toMatchObject({ inputTokens: 30, outputTokens: 13 });
    // The tool result went back as a role:"tool" message.
    const second = openaiCreate.mock.calls[1][0];
    expect(second.messages.some((m: { role: string }) => m.role === "tool")).toBe(true);
  });
});

describe("geminiDriver", () => {
  it("chat: assistant turns map to role model; usage mapped", async () => {
    geminiGenerate.mockResolvedValue({
      text: "namaste",
      usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 },
    });
    const r = await geminiDriver.chat(rt, {
      system: "sys",
      messages: [
        { role: "user", text: "hi" },
        { role: "assistant", text: "hello" },
        { role: "user", text: "book me" },
      ],
      maxTokens: 100,
    });
    expect(r.text).toBe("namaste");
    expect(r.usage).toMatchObject({ inputTokens: 9, outputTokens: 4 });
    const call = geminiGenerate.mock.calls[0][0];
    expect(call.contents[1].role).toBe("model");
    expect(call.config.systemInstruction).toBe("sys");
  });

  it("agent loop: functionCalls round-trip then final text", async () => {
    geminiGenerate
      .mockResolvedValueOnce({
        functionCalls: [{ name: "check_order_status", args: { order_id: "9" } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      })
      .mockResolvedValueOnce({
        text: "Order 9 has shipped!",
        functionCalls: [],
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 6 },
      });
    const runTool = vi.fn().mockResolvedValue({ result: "shipped" });

    const r = await geminiDriver.runAgent(rt, {
      system: "sys",
      messages: [{ role: "user", text: "where is order 9?" }],
      tools: TOOLS,
      runTool,
      maxTokens: 100,
      maxSteps: 5,
    });
    expect(runTool).toHaveBeenCalledWith({
      name: "check_order_status",
      input: { order_id: "9" },
    });
    expect(r.text).toBe("Order 9 has shipped!");
    expect(r.cappedOut).toBe(false);
    expect(r.usage).toMatchObject({ inputTokens: 25, outputTokens: 11 });
    // The function response went back as a user-role functionResponse part.
    const second = geminiGenerate.mock.calls[1][0];
    const last = second.contents[second.contents.length - 1];
    expect(last.role).toBe("user");
    expect(last.parts[0].functionResponse.name).toBe("check_order_status");
  });
});

/**
 * Cross-provider cache accounting. `DriverUsage.inputTokens` means UNCACHED
 * input on every provider, so the rate card can price it uniformly.
 *
 * Anthropic already reports it that way (`input_tokens` excludes cached
 * tokens). OpenAI and Google do the opposite — their prompt-token count
 * INCLUDES the cached portion — so the driver has to subtract it. Without
 * that subtraction a BYO-key org's dashboard bills cached tokens at the full
 * input rate, when the provider charged a tenth of it.
 */
describe("BYO-provider cache tokens", () => {
  it("openai: splits cached tokens out of prompt_tokens", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 5_000,
        completion_tokens: 40,
        prompt_tokens_details: { cached_tokens: 4_000 },
      },
    });

    const { usage } = await openaiDriver.chat(rt, {
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      maxTokens: 100,
    });

    // 5,000 prompt tokens, 4,000 of them cached → 1,000 billed at full rate.
    expect(usage.inputTokens).toBe(1_000);
    expect(usage.cacheReadTokens).toBe(4_000);
    expect(usage.outputTokens).toBe(40);
    // OpenAI caching is automatic — there is no write to bill.
    expect(usage.cacheWriteTokens ?? 0).toBe(0);
  });

  it("openai: no cache details means everything is uncached", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 300, completion_tokens: 20 },
    });

    const { usage } = await openaiDriver.chat(rt, {
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      maxTokens: 100,
    });

    expect(usage.inputTokens).toBe(300);
    expect(usage.cacheReadTokens ?? 0).toBe(0);
  });

  it("gemini: splits cachedContentTokenCount out of promptTokenCount", async () => {
    geminiGenerate.mockResolvedValue({
      text: "hi",
      usageMetadata: {
        promptTokenCount: 2_000,
        candidatesTokenCount: 30,
        cachedContentTokenCount: 1_500,
      },
    });

    const { usage } = await geminiDriver.chat(rt, {
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      maxTokens: 100,
    });

    expect(usage.inputTokens).toBe(500);
    expect(usage.cacheReadTokens).toBe(1_500);
  });

  it("never reports negative uncached input if a provider's counts disagree", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: 900 },
      },
    });

    const { usage } = await openaiDriver.chat(rt, {
      system: "s",
      messages: [{ role: "user", text: "hello" }],
      maxTokens: 100,
    });

    expect(usage.inputTokens).toBe(0);
  });
});
