import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { PACK_TEMPLATES, leadNudgeAutomation } from "@/modules/followup/pack";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { planHasAiFrontDesk } from "@/modules/billing/limits";

describe("Revenue-Recovery pack templates", () => {
  it("has the four recovery recipes' templates", () => {
    const names = PACK_TEMPLATES.map((t) => t.name).sort();
    expect(names).toEqual([
      "appt_reminder_24h",
      "appt_reminder_2h",
      "lead_nudge_1",
      "lead_nudge_2",
      "no_show_rebook",
      "review_ask",
    ]);
  });

  it("every template is valid campaign content with exactly one {{1}}", () => {
    for (const t of PACK_TEMPLATES) {
      expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
      const hits = t.content.body.match(/\{\{1\}\}/g) ?? [];
      expect(hits).toHaveLength(1);
    }
  });

  it("uses Meta-safe names (lowercase + underscores)", () => {
    for (const t of PACK_TEMPLATES) {
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("MARKETING templates carry an opt-out footer; reminders are UTILITY", () => {
    for (const t of PACK_TEMPLATES) {
      if (t.category === "MARKETING") {
        expect(t.content.footer.toLowerCase()).toContain("stop");
      }
    }
    const reminders = PACK_TEMPLATES.filter((t) => t.name.startsWith("appt_reminder"));
    expect(reminders.every((t) => t.category === "UTILITY")).toBe(true);
  });
});

describe("lead-nudge automation (composed, exactly two nudges)", () => {
  const a = leadNudgeAutomation("t1", "t2");

  it("fires on campaign_reply and sends exactly two templates, spaced by waits", () => {
    expect(a.trigger).toBe("campaign_reply");
    const kinds = a.steps.map((s) => s.kind);
    expect(kinds).toEqual(["wait", "send_template", "wait", "send_template"]);
    const templateIds = a.steps
      .filter((s) => s.kind === "send_template")
      .map((s) => s.config.templateId);
    expect(templateIds).toEqual(["t1", "t2"]);
  });

  it("each wait is within the 7-day clamp", () => {
    for (const s of a.steps) {
      if (s.kind === "wait") {
        expect(s.config.minutes as number).toBeLessThanOrEqual(7 * 24 * 60);
      }
    }
  });
});

describe("AI Front Desk gating", () => {
  it("only the flagship plan has the capability", () => {
    expect(planHasAiFrontDesk("front_desk")).toBe(true);
    expect(planHasAiFrontDesk("pro")).toBe(false);
    expect(planHasAiFrontDesk("free")).toBe(false);
    expect(planHasAiFrontDesk("unknown")).toBe(false);
  });
});
