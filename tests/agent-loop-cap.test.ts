import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reliability invariant: the agent tool loop is HARD-CAPPED (maxSteps) so a
 * model that keeps calling tools can never spin forever. Mock the Anthropic
 * SDK so we can drive the loop deterministically.
 */

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(_opts: unknown) {}
  },
}));

import { runAgent } from "@/lib/model-router";

const tools = [
  {
    name: "capture_lead",
    description: "capture a qualified lead right now",
    input_schema: { type: "object" as const },
  },
];
const toolUse = {
  stop_reason: "tool_use",
  content: [
    { type: "tool_use", id: "t1", name: "capture_lead", input: { interest: "x" } },
  ],
};
const finalText = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "All set!" }],
};

beforeEach(() => {
  create.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("runAgent — hard tool-loop cap", () => {
  it("caps at maxSteps and returns cappedOut when the model never finishes", async () => {
    create.mockResolvedValue(toolUse);
    const runTool = vi.fn().mockResolvedValue({ result: "ok" });

    const res = await runAgent({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
      tools,
      runTool,
      maxSteps: 3,
    });

    expect(res.cappedOut).toBe(true);
    expect(res.toolCalls).toHaveLength(3);
    expect(runTool).toHaveBeenCalledTimes(3);
    // 3 loop iterations + 1 tools-off closing call.
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("returns immediately (no cap) when the model answers without tools", async () => {
    create.mockResolvedValue(finalText);
    const runTool = vi.fn();

    const res = await runAgent({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
      tools,
      runTool,
      maxSteps: 5,
    });

    expect(res.cappedOut).toBe(false);
    expect(res.toolCalls).toHaveLength(0);
    expect(res.text).toBe("All set!");
    expect(runTool).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
