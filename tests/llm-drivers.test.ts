import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E3: the OpenAI and Gemini drivers marshal the neutral chat/agent shapes
 * into their SDK wire formats correctly — tool loop included. SDKs mocked.
 */

const { openaiCreate, geminiGenerate } = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  geminiGenerate: vi.fn(),
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

import { openaiDriver } from "@/lib/model-router/drivers/openai";
import { geminiDriver } from "@/lib/model-router/drivers/gemini";

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
    expect(r.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
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
    expect(r.usage).toEqual({ inputTokens: 30, outputTokens: 13 });
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
    expect(r.usage).toEqual({ inputTokens: 9, outputTokens: 4 });
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
    expect(r.usage).toEqual({ inputTokens: 25, outputTokens: 11 });
    // The function response went back as a user-role functionResponse part.
    const second = geminiGenerate.mock.calls[1][0];
    const last = second.contents[second.contents.length - 1];
    expect(last.role).toBe("user");
    expect(last.parts[0].functionResponse.name).toBe("check_order_status");
  });
});
