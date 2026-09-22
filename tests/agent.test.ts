import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isWithinServiceWindow } from "@/modules/agent/window";
import {
  agentIdentity,
  buildAgentSystemPrompt,
  formatNowLine,
  GENERIC_SCOPE,
  HANDOFF_SENTINEL,
} from "@/modules/agent/prompt";
import { questionnaireScript } from "@/modules/knowledge/questionnaire";
import { VERTICALS } from "@/modules/dashboard/verticals";
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
      "BUSINESS INFORMATION — your source of truth for facts (never invent anything not stated here):"
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

/**
 * B2B/software sellers (Nudge's own workspace included) had no vertical that
 * fit: the identity line is hard-written from the vertical, so picking
 * "Clinic" made the agent introduce itself as a clinic. The generic fallback
 * would say "software business" but the dropdown never offered the value.
 */
describe("software / B2B vertical", () => {
  it("introduces itself as a software company, not a clinic or a shop", () => {
    const p = buildAgentSystemPrompt({
      vertical: "software",
      businessName: "Nudge",
      businessInfo: "We sell an AI front desk.",
      tone: "Direct",
      doNots: "",
    });
    expect(p).toContain('You are the WhatsApp assistant for "Nudge", a software company.');
    expect(p).not.toMatch(/a clinic|a shop|a restaurant/);
  });

  it("scopes itself to selling: fit, pricing and booking a call", () => {
    const { scope } = agentIdentity("software");
    expect(scope).toMatch(/pricing/i);
    expect(scope).toMatch(/fit/i);
    expect(scope).toMatch(/call|demo/i);
    // Not the generic fallback — this one is curated.
    expect(scope).not.toBe(GENERIC_SCOPE);
  });

  it("is selectable in the agent setup form", () => {
    const form = readFileSync("src/app/(app)/agent/agent-form.tsx", "utf8");
    expect(form).toContain('<option value="software">');
  });

  it("asks the questionnaire about the right sellable thing", () => {
    const q = questionnaireScript("software");
    expect(JSON.stringify(q)).toMatch(/plans|product/i);
  });
});

/**
 * The beachhead is hair-transplant / aesthetic-derma / cosmetic-dental
 * clinics (AGENTS.md), so "clinic" must reach `VERTICAL_TEMPLATES` and not the
 * generic fallback. Founder decision 2026-09-22: the Training page's business
 * picker therefore renders the canonical taxonomy — a free-text box would have
 * cost exactly these customers their curated scope line.
 */
describe("clinic vertical (the beachhead)", () => {
  it("keeps its curated scope instead of the generic fallback", () => {
    const { noun, scope } = agentIdentity("clinic");
    expect(noun).toBe("clinic");
    expect(scope).toMatch(/treatments/i);
    expect(scope).toMatch(/booking or rescheduling/i);
    expect(scope).not.toBe(GENERIC_SCOPE);
  });

  it("introduces itself as a clinic in the built prompt", () => {
    const p = buildAgentSystemPrompt({
      vertical: "clinic",
      businessName: "Aster Hair",
      businessInfo: "We do hair transplants.",
      tone: "Warm",
      doNots: "",
    });
    expect(p).toContain(
      'You are the WhatsApp assistant for "Aster Hair", a clinic.'
    );
    expect(p).not.toContain(GENERIC_SCOPE);
  });

  it("is pickable on the Training page from the shared taxonomy", () => {
    expect(VERTICALS.some((v) => v.value === "clinic")).toBe(true);
    const section = readFileSync(
      "src/app/(app)/agent/business-section.tsx",
      "utf8"
    );
    // Rendered from the one allowlist, never a list invented in the UI —
    // an invented list is how a vertical stops matching its template.
    expect(section).toContain("VERTICALS");
    expect(section).not.toMatch(/<option value="[a-z_]+">/);
  });
});
