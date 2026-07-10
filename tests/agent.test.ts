import { describe, expect, it } from "vitest";
import { isWithinServiceWindow } from "@/modules/agent/window";
import {
  buildAgentSystemPrompt,
  formatNowLine,
  GENERIC_SCOPE,
  HANDOFF_SENTINEL,
} from "@/modules/agent/prompt";
import { buildHistory } from "@/modules/agent/reply";

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

  it("introduces itself from the org's own vertical when no curated template exists (no restaurant fallback)", () => {
    const p = buildAgentSystemPrompt({ ...profile, vertical: "jewellery" });
    expect(p).toContain("a jewellery business");
    expect(p).not.toContain("restaurant");
    expect(p).toContain(GENERIC_SCOPE);
  });

  it("handles underscored vertical slugs and empty verticals", () => {
    expect(
      buildAgentSystemPrompt({ ...profile, vertical: "home_decor" })
    ).toContain("a home decor business");
    expect(buildAgentSystemPrompt({ ...profile, vertical: "" })).toContain(
      'for "Spice Garden", a business'
    );
  });

  it("keeps the curated template when one exists", () => {
    const p = buildAgentSystemPrompt({ ...profile, vertical: "clinic" });
    expect(p).toContain("a clinic");
    expect(p).toContain("practitioners");
  });
});

describe("buildAgentSystemPrompt (knowledge digest + time awareness)", () => {
  const profile = {
    vertical: "restaurant",
    businessName: "Spice Garden",
    businessInfo: "Legacy blob info here.",
    tone: "Warm",
    doNots: "",
  };
  const digest =
    "MENU & SERVICES:\n- Chicken dishes available — only: weekends only";
  const now = new Date("2026-07-14T09:42:00Z"); // Tuesday 3:12 PM in Kolkata

  it("formatNowLine renders org-local weekday and time", () => {
    const line = formatNowLine(now, "Asia/Kolkata");
    expect(line).toContain("Tuesday");
    expect(line).toContain("3:12 PM");
  });

  it("formatNowLine survives a bad timezone", () => {
    expect(formatNowLine(now, "Not/AZone")).toContain("2026");
  });

  it("injects TODAY + the conditional-facts rule only when time context is given", () => {
    const p = buildAgentSystemPrompt(profile, {
      now,
      timezone: "Asia/Kolkata",
    });
    expect(p).toContain("TODAY: Tuesday");
    expect(p).toContain("— only:");
    const bare = buildAgentSystemPrompt(profile);
    expect(bare).not.toContain("TODAY:");
  });

  it("puts the knowledge digest above the legacy blob and demotes the blob header", () => {
    const p = buildAgentSystemPrompt(profile, { knowledgeDigest: digest });
    expect(p.indexOf("BUSINESS KNOWLEDGE")).toBeGreaterThan(-1);
    expect(p.indexOf("BUSINESS KNOWLEDGE")).toBeLessThan(
      p.indexOf("ADDITIONAL BUSINESS INFORMATION")
    );
    expect(p).toContain("Chicken dishes available");
    expect(p).toContain("Legacy blob info here.");
  });

  it("without a digest the original blob section is unchanged", () => {
    const p = buildAgentSystemPrompt(profile);
    expect(p).toContain(
      "BUSINESS INFORMATION (this is your only source of truth"
    );
    expect(p).not.toContain("ADDITIONAL BUSINESS INFORMATION");
  });

  it("tool guidance teaches ask_owner", () => {
    const p = buildAgentSystemPrompt(profile, { withTools: true });
    expect(p).toContain("ask_owner");
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
