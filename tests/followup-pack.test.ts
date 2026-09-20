import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  PACK_TEMPLATES,
  PACK_LEAD_NUDGE_SPEC,
  PACK_LEAD_NUDGE_TEMPLATE_NAMES,
  FOLLOW_UP_FLAGS,
  FOLLOW_UP_KINDS,
  MAX_TIMING_HOURS,
  MIN_TIMING_HOURS,
  TIMING_DEFAULTS,
  normalizeTiming,
} from "@/modules/followup/pack";
import { parseFollowUpSpec } from "@/modules/followup/spec";
import { compileFollowUp } from "@/modules/followup/compile";
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

describe("owner-facing follow-up rows", () => {
  it("surfaces every tick-driven pack template; the nudge lives on its own card", () => {
    const listed = FOLLOW_UP_KINDS.flatMap((k) => k.templateNames).sort();
    expect([...listed, ...PACK_LEAD_NUDGE_TEMPLATE_NAMES].sort()).toEqual(
      PACK_TEMPLATES.map((t) => t.name).sort()
    );
  });

  it("every row maps to a real FollowUpConfig switch", () => {
    const flags = FOLLOW_UP_KINDS.map((k) => k.flag);
    expect(flags).toEqual([...FOLLOW_UP_FLAGS]);
    expect(new Set(flags).size).toBe(flags.length);
  });
});

describe("follow-up timing", () => {
  it("keeps the owner's hours when they're sane", () => {
    expect(
      normalizeTiming({
        reminder1Hours: 48,
        reminder2Hours: 3,
        reviewDelayHours: 6,
      })
    ).toEqual({ reminder1Hours: 48, reminder2Hours: 3, reviewDelayHours: 6 });
  });

  it("falls back to the defaults for missing or unparseable values", () => {
    expect(normalizeTiming({})).toEqual(TIMING_DEFAULTS);
    expect(
      normalizeTiming({ reviewDelayHours: Number.NaN }).reviewDelayHours
    ).toBe(TIMING_DEFAULTS.reviewDelayHours);
  });

  it("clamps to the supported range instead of rejecting", () => {
    const t = normalizeTiming({
      reminder2Hours: 0,
      reviewDelayHours: 10_000,
    });
    expect(t.reminder2Hours).toBe(MIN_TIMING_HOURS);
    expect(t.reviewDelayHours).toBe(MAX_TIMING_HOURS);
  });

  it("never lets the early reminder land at or after the late one", () => {
    // Inverted input would otherwise give the first reminder an empty window,
    // so it would silently never send.
    const t = normalizeTiming({ reminder1Hours: 2, reminder2Hours: 12 });
    expect(t.reminder1Hours).toBeGreaterThan(t.reminder2Hours);
  });
});

describe("pack quiet-lead nudge (a spec, like every other follow-up)", () => {
  it("chases once after 3 quiet days, then once more 3 days later, and stops on any signal", () => {
    expect(PACK_LEAD_NUDGE_SPEC.situation).toEqual({ kind: "went_quiet", afterDays: 3 });
    expect(PACK_LEAD_NUDGE_SPEC.messages.map((m) => m.afterDays)).toEqual([0, 3]);
    expect(PACK_LEAD_NUDGE_SPEC.stopOn).toEqual(["reply", "booking", "payment"]);
    expect(parseFollowUpSpec(PACK_LEAD_NUDGE_SPEC).ok).toBe(true);
  });

  it("compiles onto the historical lead_nudge template names", () => {
    const out = compileFollowUp(PACK_LEAD_NUDGE_SPEC, { templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES });
    expect(out.trigger).toBe("conversation_quiet");
    expect(out.templates.map((t) => t.name)).toEqual(["lead_nudge_1", "lead_nudge_2"]);
  });
});

describe("AI Front Desk gating", () => {
  it("Growth and up can chase; Starter and the retired free tier cannot", () => {
    expect(planHasAiFrontDesk("growth")).toBe(true);
    expect(planHasAiFrontDesk("pro")).toBe(true);
    expect(planHasAiFrontDesk("enterprise")).toBe(true);
    // The retired flagship keeps everything it was sold with.
    expect(planHasAiFrontDesk("front_desk")).toBe(true);
    expect(planHasAiFrontDesk("starter")).toBe(false);
    expect(planHasAiFrontDesk("free")).toBe(false);
    expect(planHasAiFrontDesk("unknown")).toBe(false);
  });
});
