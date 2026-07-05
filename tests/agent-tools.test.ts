import { describe, expect, it, vi } from "vitest";

// The tool handlers import prisma; stub it so we can unit-test validation +
// dispatch (the pure, deterministic parts) without a database.
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { update: vi.fn().mockResolvedValue({}) },
    contact: { update: vi.fn().mockResolvedValue({}) },
    note: { create: vi.fn().mockResolvedValue({}) },
    bookingRequest: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { runTool, toolDefs, calledHandoff, HANDOFF_TOOL_NAME } from "@/lib/agent/tools";
import { buildAgentSystemPrompt, TOOL_GUIDANCE } from "@/lib/agent/prompt";

const ctx = {
  orgId: "org1",
  contactId: "c1",
  conversationId: "cv1",
  contactName: "+919810000000",
  contactPhone: "+919810000000",
};

describe("tool definitions", () => {
  it("exposes exactly the three worker tools with object schemas", () => {
    const names = toolDefs().map((t) => t.name).sort();
    expect(names).toEqual([
      "capture_booking_request",
      "capture_lead",
      "handoff_to_human",
    ]);
    for (const def of toolDefs()) {
      expect(def.input_schema.type).toBe("object");
      expect(def.description.length).toBeGreaterThan(20);
    }
  });
});

describe("runTool — validation & error containment (never throws)", () => {
  it("rejects an unknown tool with an error result", async () => {
    const r = await runTool(ctx, { name: "delete_everything", input: {} });
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/unknown tool/i);
  });

  it("rejects invalid input instead of throwing (booking missing time)", async () => {
    const r = await runTool(ctx, {
      name: "capture_booking_request",
      input: { name: "Rahul" }, // missing requested_for
    });
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/invalid input/i);
  });

  it("rejects a nonsense party size", async () => {
    const r = await runTool(ctx, {
      name: "capture_booking_request",
      input: { name: "Rahul", requested_for: "8pm", party_size: -3 },
    });
    expect(r.isError).toBe(true);
  });

  it("accepts a valid booking and returns a success result", async () => {
    const r = await runTool(ctx, {
      name: "capture_booking_request",
      input: { name: "Rahul", requested_for: "tomorrow 8pm", party_size: 4 },
    });
    expect(r.isError).toBeUndefined();
    expect(r.result).toMatch(/recorded/i);
  });

  it("accepts a valid lead", async () => {
    const r = await runTool(ctx, {
      name: "capture_lead",
      input: { interest: "wants a 2BHK under 50L" },
    });
    expect(r.isError).toBeUndefined();
    expect(r.result).toMatch(/qualified/i);
  });

  it("requires a lead interest", async () => {
    const r = await runTool(ctx, { name: "capture_lead", input: {} });
    expect(r.isError).toBe(true);
  });

  it("runs handoff with no args", async () => {
    const r = await runTool(ctx, { name: HANDOFF_TOOL_NAME, input: {} });
    expect(r.isError).toBeUndefined();
    expect(r.result).toMatch(/team member/i);
  });
});

describe("calledHandoff", () => {
  it("detects a handoff call in the turn", () => {
    expect(calledHandoff([{ name: "capture_lead", input: {} }])).toBe(false);
    expect(calledHandoff([{ name: HANDOFF_TOOL_NAME, input: {} }])).toBe(true);
  });
});

describe("tool-aware system prompt", () => {
  const profile = {
    vertical: "restaurant",
    businessName: "Spice Garden",
    businessInfo: "Open Tue–Sun.",
    tone: "Warm",
    doNots: "",
  };
  it("includes tool guidance only when withTools is set", () => {
    expect(buildAgentSystemPrompt(profile)).not.toContain(TOOL_GUIDANCE);
    expect(buildAgentSystemPrompt(profile, { withTools: true })).toContain(
      TOOL_GUIDANCE
    );
  });
  it("keeps the confirm-before-booking instruction", () => {
    const p = buildAgentSystemPrompt(profile, { withTools: true });
    expect(p).toMatch(/confirm/i);
    expect(p).toContain("capture_booking_request");
  });
});
