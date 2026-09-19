import { describe, expect, it } from "vitest";
import { compileFollowUp, slugify, waitChunksMinutes } from "@/modules/followup/compile";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { MAX_WAIT_MINUTES } from "@/modules/automation/definitions";
import type { FollowUpSpec } from "@/modules/followup/spec";

const spec: FollowUpSpec = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2, stage: "QUALIFIED" },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [] },
    { afterDays: 10, category: "MARKETING", header: "One last note", body: "Hi {{1}}, here when you're ready.", footer: "Reply STOP to unsubscribe", buttons: [] },
  ],
  stopOn: ["reply", "booking", "payment"],
};

describe("compileFollowUp", () => {
  const out = compileFollowUp(spec);

  it("maps the situation onto an engine trigger", () => {
    expect(out.trigger).toBe("conversation_quiet");
    expect(out.triggerConfig).toEqual({ hours: 48, stage: "QUALIFIED" });
    expect(compileFollowUp({ ...spec, situation: { kind: "booked" } }).trigger).toBe("booking_created");
    expect(compileFollowUp({ ...spec, situation: { kind: "new_lead" } }).trigger).toBe("contact_created");
    expect(compileFollowUp({ ...spec, situation: { kind: "keyword", keywords: ["Price"] } })).toMatchObject({
      trigger: "keyword",
      triggerConfig: { keywords: ["Price"], match: "contains" },
    });
  });

  it("emits only wait and send_template steps, in order, chunking waits at the engine clamp", () => {
    expect(out.steps.map((s) => s.kind)).toEqual(["send_template", "wait", "wait", "send_template"]);
    const waits = out.steps.filter((s) => s.kind === "wait").map((s) => s.config.minutes);
    expect(waits).toEqual([7 * 1440, 3 * 1440]);
    for (const w of waits) expect(w as number).toBeLessThanOrEqual(MAX_WAIT_MINUTES);
    expect(out.steps.some((s) => (s.kind as string) === "send_message")).toBe(false);
  });

  it("produces one valid, Meta-safe library template per message", () => {
    expect(out.templates.map((t) => t.name)).toEqual(["fu_pricing_chase_1", "fu_pricing_chase_2"]);
    for (const t of out.templates) {
      // Meta template names: lowercase letters, digits, underscores, ≤512 chars.
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      expect(t.name.length).toBeLessThanOrEqual(512);
      expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
      expect(t.content.body.match(/\{\{1\}\}/g)).toHaveLength(1);
    }
    expect(out.steps[0].config.templateName).toBe("fu_pricing_chase_1");
  });

  it("lets the caller pin template names (the pack keeps its historical names)", () => {
    const pinned = compileFollowUp(spec, { templateNames: ["lead_nudge_1", "lead_nudge_2"] });
    expect(pinned.templates.map((t) => t.name)).toEqual(["lead_nudge_1", "lead_nudge_2"]);
  });

  it("gives a UTILITY message with no footer a non-empty one (campaignContentSchema requires it)", () => {
    const utility = compileFollowUp({
      ...spec,
      situation: { kind: "booked" },
      messages: [
        { afterDays: 1, category: "UTILITY", header: "See you tomorrow", body: "Hi {{1}}, your appointment is tomorrow.", footer: "", buttons: [] },
      ],
    });
    expect(utility.templates).toHaveLength(1);
    const [t] = utility.templates;
    expect(t.category).toBe("UTILITY");
    expect(t.content.footer.length).toBeGreaterThan(0);
    expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
  });

  it("falls back to the follow_up slug when the name slugifies to nothing", () => {
    const punct = compileFollowUp({ ...spec, name: "!!!" });
    expect(punct.templates.map((t) => t.name)).toEqual(["fu_follow_up_1", "fu_follow_up_2"]);
  });
});

describe("helpers", () => {
  it("slugify is lowercase, underscore-joined and capped", () => {
    expect(slugify("Post-consult check in!")).toBe("post_consult_check_in");
    expect(slugify("x".repeat(80))).toHaveLength(40);
  });
  it("waitChunksMinutes splits days into ≤7-day waits", () => {
    expect(waitChunksMinutes(0)).toEqual([]);
    expect(waitChunksMinutes(7)).toEqual([7 * 1440]);
    expect(waitChunksMinutes(14)).toEqual([7 * 1440, 7 * 1440]);
  });
  it("waitChunksMinutes derives its chunk size from the engine's wait clamp", () => {
    expect(waitChunksMinutes(8)).toEqual([MAX_WAIT_MINUTES, 1440]);
  });
});
