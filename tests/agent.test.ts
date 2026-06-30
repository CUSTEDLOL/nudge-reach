import { describe, expect, it } from "vitest";
import { isWithinServiceWindow } from "@/lib/agent/window";
import {
  buildAgentSystemPrompt,
  HANDOFF_SENTINEL,
} from "@/lib/agent/prompt";
import { buildHistory } from "@/lib/agent/reply";

describe("isWithinServiceWindow (24h customer-service window)", () => {
  const now = new Date("2026-06-30T12:00:00Z");
  it("is false with no prior inbound", () => {
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });
  it("is true within 24h", () => {
    expect(
      isWithinServiceWindow(new Date("2026-06-30T01:00:00Z"), now)
    ).toBe(true);
  });
  it("is false just past 24h", () => {
    expect(
      isWithinServiceWindow(new Date("2026-06-29T11:59:00Z"), now)
    ).toBe(false);
  });
});

describe("buildAgentSystemPrompt (scoped, compliant)", () => {
  const profile = {
    vertical: "restaurant",
    businessName: "Spice Garden",
    businessInfo: "Open Tue–Sun 12–11pm. Paneer Tikka ₹280.",
    tone: "Warm and concise",
    doNots: "Don't quote delivery times",
  };

  it("includes the business name, vertical scope, and the owner's info", () => {
    const p = buildAgentSystemPrompt(profile);
    expect(p).toContain("Spice Garden");
    expect(p).toContain("restaurant");
    expect(p).toContain("Paneer Tikka ₹280");
  });

  it("enforces the on-topic guardrail (Meta 2026 policy compliance)", () => {
    const p = buildAgentSystemPrompt(profile);
    expect(p.toLowerCase()).toContain("only help with");
    expect(p.toLowerCase()).toContain("not a general assistant");
  });

  it("forbids inventing facts and includes the handoff sentinel", () => {
    const p = buildAgentSystemPrompt(profile);
    expect(p.toLowerCase()).toContain("never invent");
    expect(p).toContain(HANDOFF_SENTINEL);
  });

  it("folds in the owner's custom do-nots", () => {
    expect(buildAgentSystemPrompt(profile)).toContain(
      "Don't quote delivery times"
    );
  });

  it("falls back to the restaurant template for an unknown vertical", () => {
    const p = buildAgentSystemPrompt({ ...profile, vertical: "spaceship" });
    expect(p).toContain("restaurant");
  });
});

describe("buildHistory (transcript shaping)", () => {
  it("maps inbound→user and outbound→assistant", () => {
    const turns = buildHistory([
      { direction: "inbound", body: "Hi" },
      { direction: "outbound", body: "Hello!" },
      { direction: "inbound", body: "Open today?" },
    ]);
    expect(turns).toEqual([
      { role: "user", text: "Hi" },
      { role: "assistant", text: "Hello!" },
      { role: "user", text: "Open today?" },
    ]);
  });

  it("merges consecutive same-role messages", () => {
    const turns = buildHistory([
      { direction: "inbound", body: "Hi" },
      { direction: "inbound", body: "you there?" },
    ]);
    expect(turns).toEqual([{ role: "user", text: "Hi\nyou there?" }]);
  });

  it("drops a leading assistant turn so it starts with the customer", () => {
    const turns = buildHistory([
      { direction: "outbound", body: "Welcome!" },
      { direction: "inbound", body: "Hi" },
    ]);
    expect(turns[0]).toEqual({ role: "user", text: "Hi" });
  });
});
