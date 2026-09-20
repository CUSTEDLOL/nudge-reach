// tests/admin-followups.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Concierge onboarding writes a client's follow-ups from the founder panel,
 * down the same path the client will later use on /automations: a sentence
 * drafts one, an empty box writes the whole starter set, and everything lands
 * off. Deliberately NOT flagship-gated — the founder sets a client up before
 * they are billed — but a below-plan draft has to say so, in the founder's
 * toast and in the org's audit log, because it spends AI on us.
 */

const m = vi.hoisted(() => ({
  orgFindUnique: vi.fn(),
  draftFollowUp: vi.fn(),
  saveFollowUpFromSpec: vi.fn(),
  writeStarterSet: vi.fn(),
  founderAudit: vi.fn(),
  checkAiFrontDesk: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { org: { findUnique: m.orgFindUnique } } }));
vi.mock("@/modules/followup/draft", () => ({ draftFollowUp: m.draftFollowUp }));
vi.mock("@/modules/followup/install", () => ({
  saveFollowUpFromSpec: m.saveFollowUpFromSpec,
  writeStarterSet: m.writeStarterSet,
  installRevenueRecoveryPack: vi.fn(),
  setFollowUpEnabled: vi.fn(),
}));
vi.mock("@/modules/billing/limits", () => ({ checkAiFrontDesk: m.checkAiFrontDesk }));
vi.mock("@/modules/admin/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/audit")>()),
  founderAudit: m.founderAudit,
}));

import { founderDraftFollowUps } from "@/modules/admin/concierge";

const spec = (over: Record<string, unknown> = {}) => ({
  name: "Quiet-lead chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "" },
  ],
  ...over,
});

const outcome = (over: Record<string, unknown> = {}) => ({
  created: 0,
  stopped: false,
  draftFailed: false,
  failed: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.orgFindUnique.mockResolvedValue({ id: "org1" });
  m.checkAiFrontDesk.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  m.draftFollowUp.mockResolvedValue(spec());
  m.saveFollowUpFromSpec.mockResolvedValue({ id: "auto1" });
  m.writeStarterSet.mockResolvedValue(outcome());
});

describe("founderDraftFollowUps — a sentence", () => {
  it("drafts one follow-up for the org and saves it off", async () => {
    const res = await founderDraftFollowUps(
      "org1",
      "chase anyone who asked about pricing but didn't book, after 2 days",
      "founder@nudge.test",
      "onboarding call"
    );
    expect(res).toMatchObject({ ok: true });
    expect(m.draftFollowUp).toHaveBeenCalledWith({
      orgId: "org1",
      request: "chase anyone who asked about pricing but didn't book, after 2 days",
    });
    const saved = m.saveFollowUpFromSpec.mock.calls[0][0];
    expect(saved).toMatchObject({ orgId: "org1", source: "ai" });
    // Off is the default in saveFollowUpFromSpec; the founder never switches a
    // client's follow-ups on behind their back.
    expect(saved.enabled).toBeUndefined();
    expect(saved.spec.messages[0].footer).toContain("STOP");
    expect(res.ok && res.message).toMatch(/off/i);
    expect(m.writeStarterSet).not.toHaveBeenCalled();
  });

  it("caps the request so a pasted essay can't run up the client's bill", async () => {
    await founderDraftFollowUps("org1", "x".repeat(900), "founder@nudge.test");
    expect(m.draftFollowUp.mock.calls[0][0].request).toHaveLength(500);
  });

  it("audits the count against the org, with the founder's reason", async () => {
    await founderDraftFollowUps("org1", "chase quiet leads", "founder@nudge.test", "onboarding call");
    expect(m.founderAudit).toHaveBeenCalledWith(
      "org1",
      "founder@nudge.test",
      "admin.followups_drafted",
      null,
      "1 drafted — reason: onboarding call"
    );
  });

  it("shows the drafter's own sentence when drafting fails, and saves nothing", async () => {
    m.draftFollowUp.mockRejectedValue(new Error("We couldn't write that follow-up just now — try rephrasing."));
    const res = await founderDraftFollowUps("org1", "chase quiet leads", "founder@nudge.test");
    expect(res).toEqual({ ok: false, error: "We couldn't write that follow-up just now — try rephrasing." });
    expect(m.saveFollowUpFromSpec).not.toHaveBeenCalled();
    expect(m.founderAudit).not.toHaveBeenCalled();
  });

  it("refuses a draft that doesn't validate, in words the founder can act on", async () => {
    m.draftFollowUp.mockResolvedValue(spec({ situation: { kind: "nonsense" } }));
    const res = await founderDraftFollowUps("org1", "chase quiet leads", "founder@nudge.test");
    expect(res).toEqual({
      ok: false,
      error: "We couldn't tell what should start that follow-up — try rewording it.",
    });
    expect(m.saveFollowUpFromSpec).not.toHaveBeenCalled();
  });
});

describe("founderDraftFollowUps — the starter set", () => {
  it("writes the client's starter set when the box is empty", async () => {
    m.writeStarterSet.mockResolvedValue(outcome({ created: 3 }));
    const res = await founderDraftFollowUps("org1", "   ", "founder@nudge.test", "onboarding call");
    expect(m.writeStarterSet).toHaveBeenCalledWith("org1");
    expect(m.draftFollowUp).not.toHaveBeenCalled();
    expect(res.ok && res.message).toContain("3 follow-ups");
    expect(res.ok && res.message).toMatch(/off/i);
    expect(m.founderAudit).toHaveBeenCalledWith(
      "org1",
      "founder@nudge.test",
      "admin.followups_drafted",
      null,
      "3 drafted — reason: onboarding call"
    );
  });

  it("tells the founder when drafting failed but the ready-made pack went in", async () => {
    m.writeStarterSet.mockResolvedValue(outcome({ draftFailed: true }));
    const res = await founderDraftFollowUps("org1", "", "founder@nudge.test");
    expect(res.ok).toBe(true);
    expect(res.ok && res.message).toMatch(/ready-made pack/i);
    expect(res.ok && res.message).toMatch(/couldn't draft/i);
  });

  it("names the plan's automation limit when it stopped there", async () => {
    m.writeStarterSet.mockResolvedValue(outcome({ created: 2, stopped: true }));
    const res = await founderDraftFollowUps("org1", "", "founder@nudge.test");
    expect(res.ok && res.message).toContain("2 follow-ups");
    expect(res.ok && res.message).toMatch(/plan allows/i);
  });

  it("says the rest weren't written when a save failed partway", async () => {
    m.writeStarterSet.mockResolvedValue(outcome({ created: 1, failed: true }));
    const res = await founderDraftFollowUps("org1", "", "founder@nudge.test");
    expect(res.ok && res.message).toContain("1 follow-up");
    expect(res.ok && res.message).toMatch(/rest/i);
  });

  it("says nothing was new when the client already has them", async () => {
    const res = await founderDraftFollowUps("org1", "", "founder@nudge.test");
    expect(res.ok).toBe(true);
    expect(res.ok && res.message).toMatch(/already/i);
  });
});

describe("founderDraftFollowUps — guards", () => {
  it("refuses an org that doesn't exist, before anything costs AI", async () => {
    m.orgFindUnique.mockResolvedValue(null);
    const res = await founderDraftFollowUps("nope", "chase quiet leads", "founder@nudge.test");
    expect(res).toEqual({ ok: false, error: "Org not found." });
    expect(m.draftFollowUp).not.toHaveBeenCalled();
    expect(m.writeStarterSet).not.toHaveBeenCalled();
    expect(m.founderAudit).not.toHaveBeenCalled();
  });

  it("still drafts below the flagship — onboarding precedes billing — but says so, and records it", async () => {
    m.checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    const res = await founderDraftFollowUps("org1", "chase quiet leads", "founder@nudge.test", "pre-sales demo");
    expect(res.ok).toBe(true);
    expect(m.saveFollowUpFromSpec).toHaveBeenCalled();
    expect(res.ok && res.message).toMatch(/below the AI Front Desk plan/i);
    expect(m.founderAudit.mock.calls[0][4]).toContain("below the AI Front Desk plan");
  });
});
