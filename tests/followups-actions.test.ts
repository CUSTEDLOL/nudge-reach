// tests/followups-actions.test.ts
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The follow-up server actions: every one is ADMIN-gated, flagship-gated where
 * it costs AI, org-scoped on read, and never shows the owner a raw zod string.
 */

const {
  requireOrgContext,
  revalidatePath,
  recordAudit,
  checkAiFrontDesk,
  checkAutomationLimit,
  saveFollowUpFromSpec,
  installRevenueRecoveryPack,
  draftFollowUp,
  draftStarterSet,
  automationFindFirst,
  automationFindMany,
  automationDelete,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  revalidatePath: vi.fn(),
  recordAudit: vi.fn(),
  checkAiFrontDesk: vi.fn(),
  checkAutomationLimit: vi.fn(),
  saveFollowUpFromSpec: vi.fn(),
  installRevenueRecoveryPack: vi.fn(),
  draftFollowUp: vi.fn(),
  draftStarterSet: vi.fn(),
  automationFindFirst: vi.fn(),
  automationFindMany: vi.fn(),
  automationDelete: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({
  prisma: {
    automation: {
      findFirst: automationFindFirst,
      findMany: automationFindMany,
      delete: automationDelete,
    },
  },
}));
vi.mock("@/modules/orgs/auth", () => {
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrgContext,
    requireRole: (ctx: { role: string }, min: string) => {
      if (ORDER[ctx.role] < ORDER[min]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/billing/limits", () => ({ checkAiFrontDesk, checkAutomationLimit }));
vi.mock("@/modules/followup/install", () => ({
  saveFollowUpFromSpec,
  installRevenueRecoveryPack,
  getFollowUpConfig: vi.fn(),
  setFollowUpEnabled: vi.fn(),
  setFollowUpFlag: vi.fn(),
  setFollowUpTiming: vi.fn(),
}));
vi.mock("@/modules/followup/draft", () => ({ draftFollowUp, draftStarterSet }));

import {
  createFollowUpAction,
  deleteFollowUpAction,
  draftFollowUpAction,
  updateFollowUpAction,
  writeStarterSetAction,
} from "@/app/(app)/automations/followup-actions";

const ctx = (role: "OWNER" | "ADMIN" | "AGENT" = "ADMIN") => ({
  role,
  org: { id: "org1" },
  userId: "u1",
  email: "owner@example.com",
  membership: { displayName: "Asha" },
});

const spec = (over: Record<string, unknown> = {}) => ({
  name: "Quiet-lead chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "" },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue(ctx());
  checkAiFrontDesk.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  saveFollowUpFromSpec.mockResolvedValue({ id: "auto1" });
  automationFindMany.mockResolvedValue([]);
});

describe("draftFollowUpAction", () => {
  it("returns the spec for review and saves nothing", async () => {
    draftFollowUp.mockResolvedValue(spec());
    const r = await draftFollowUpAction("chase quiet leads after 2 days");
    expect(r.ok).toBe(true);
    expect(r.spec?.name).toBe("Quiet-lead chase");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
    expect(draftFollowUp).toHaveBeenCalledWith({
      orgId: "org1",
      request: "chase quiet leads after 2 days",
    });
  });

  it("caps the request so a pasted essay can't run up the bill", async () => {
    draftFollowUp.mockResolvedValue(spec());
    await draftFollowUpAction("x".repeat(900));
    expect(draftFollowUp.mock.calls[0][0].request).toHaveLength(500);
  });

  it("refuses an agent and a workspace without the flagship", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await draftFollowUpAction("chase")).ok).toBe(false);

    requireOrgContext.mockResolvedValue(ctx());
    checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    const r = await draftFollowUpAction("chase");
    expect(r).toEqual({ ok: false, message: "Upgrade first." });
    expect(draftFollowUp).not.toHaveBeenCalled();
  });

  it("passes the drafter's own friendly failure through", async () => {
    draftFollowUp.mockRejectedValue(new Error("We couldn't write that follow-up just now — try rephrasing."));
    const r = await draftFollowUpAction("chase");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("couldn't write that follow-up");
  });
});

describe("createFollowUpAction", () => {
  it("saves a reviewed spec as an AI follow-up that lands off", async () => {
    const r = await createFollowUpAction(spec());
    expect(r).toMatchObject({ ok: true, id: "auto1" });
    expect(r.message).toMatch(/off/i);
    const arg = saveFollowUpFromSpec.mock.calls[0][0];
    expect(arg.orgId).toBe("org1");
    expect(arg.source).toBe("ai");
    expect(arg.spec.messages[0].footer).toContain("STOP");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.created", "Quiet-lead chase");
    expect(revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("shows an owner-facing sentence, not a zod string, for an invalid spec", async () => {
    const long = spec({
      messages: [
        { afterDays: 0, category: "MARKETING", header: "Hi", body: `Hi {{1}} ${"x".repeat(700)}`, footer: "" },
      ],
    });
    const r = await createFollowUpAction(long);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("That message is too long — keep it under 600 characters.");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("checks the plan's automation limit before saving", async () => {
    checkAutomationLimit.mockResolvedValue({
      allowed: false,
      message: "You've reached the Starter plan's limit of 3 automations.",
      used: 3,
      limit: 3,
    });
    const r = await createFollowUpAction(spec());
    expect(r.ok).toBe(false);
    expect(r.message).toContain("limit of 3 automations");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("refuses an agent", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await createFollowUpAction(spec())).ok).toBe(false);
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });
});

describe("updateFollowUpAction", () => {
  it("re-saves over an org-scoped follow-up and keeps a pack follow-up in the pack", async () => {
    automationFindFirst.mockResolvedValue({ id: "a1", source: "pack" });
    const r = await updateFollowUpAction("a1", spec());
    expect(r.ok).toBe(true);
    expect(automationFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", orgId: "org1" });
    expect(saveFollowUpFromSpec).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", automationId: "a1", source: "pack" })
    );
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.updated", "Quiet-lead chase");
  });

  it("a hand-built follow-up edited here becomes an AI-spec one", async () => {
    automationFindFirst.mockResolvedValue({ id: "a1", source: "builder" });
    await updateFollowUpAction("a1", spec());
    expect(saveFollowUpFromSpec.mock.calls[0][0].source).toBe("ai");
  });

  it("refuses another org's id and an invalid spec", async () => {
    automationFindFirst.mockResolvedValue(null);
    expect(await updateFollowUpAction("other", spec())).toEqual({
      ok: false,
      message: "Follow-up not found.",
    });

    automationFindFirst.mockResolvedValue({ id: "a1", source: "ai" });
    const r = await updateFollowUpAction("a1", spec({ situation: { kind: "nonsense" } }));
    expect(r.ok).toBe(false);
    expect(r.message).toBe("We couldn't tell what should start that follow-up — try rewording it.");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });
});

describe("deleteFollowUpAction", () => {
  it("deletes an org-scoped follow-up and says the templates stay", async () => {
    automationFindFirst.mockResolvedValue({ name: "Quiet-lead chase" });
    const r = await deleteFollowUpAction("a1");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/templates/i);
    expect(automationFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", orgId: "org1" });
    expect(automationDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.deleted", "Quiet-lead chase");
  });

  it("refuses another org's id", async () => {
    automationFindFirst.mockResolvedValue(null);
    expect(await deleteFollowUpAction("other")).toEqual({ ok: false, message: "Follow-up not found." });
    expect(automationDelete).not.toHaveBeenCalled();
  });
});

describe("writeStarterSetAction", () => {
  it("installs the ready-made pack, then saves the drafted set, all off", async () => {
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" })]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(2);
    expect(r.message).toContain("2 follow-ups");
    expect(installRevenueRecoveryPack).toHaveBeenCalledWith("org1");
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(2);
    expect(saveFollowUpFromSpec.mock.calls[0][0].source).toBe("ai");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.drafted", "2 drafted");
  });

  it("skips a name the org already has, whatever its casing", async () => {
    automationFindMany.mockResolvedValue([{ name: "quiet-lead CHASE" }]);
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" })]);
    const r = await writeStarterSetAction();
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
    expect(saveFollowUpFromSpec.mock.calls[0][0].spec.name).toBe("Welcome");
  });

  it("keeps the installed pack when drafting fails", async () => {
    draftStarterSet.mockRejectedValue(new Error("credits exhausted"));
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.message).toBe(
      "Installed the ready-made follow-ups, but couldn't draft the extra ones just now — try the bar above."
    );
    expect(installRevenueRecoveryPack).toHaveBeenCalledWith("org1");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("stops at the plan's automation limit and reports what it created", async () => {
    checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 4, limit: 5 });
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" }), spec({ name: "Rebook" })]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
    expect(r.message).toContain("1 follow-up");
    expect(r.message).toMatch(/plan allows/i);
  });

  it("says nothing was new when the org already has every drafted name", async () => {
    automationFindMany.mockResolvedValue([{ name: "Quiet-lead chase" }]);
    draftStarterSet.mockResolvedValue([spec()]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(0);
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("installs nothing without the flagship, and refuses an agent", async () => {
    checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    expect(await writeStarterSetAction()).toMatchObject({ ok: false, message: "Upgrade first." });

    checkAiFrontDesk.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await writeStarterSetAction()).ok).toBe(false);
    expect(installRevenueRecoveryPack).not.toHaveBeenCalled();
  });
});

describe("the builder writes over a spec", () => {
  // Source-level: saveAutomation drags in the engine + draft parser, so this
  // one line is asserted on the file. A hand edit invalidates the spec the
  // follow-up card renders from, so the row must stop claiming to have one.
  const source = readFileSync("src/app/(app)/automations/actions.ts", "utf8");

  it("clears the spec and marks the automation hand-built on a builder save", () => {
    const update = source.slice(source.indexOf("prisma.automation.update"));
    expect(update).toContain("spec: Prisma.DbNull");
    expect(update).toContain('source: "builder"');
    expect(source).toContain('import { Prisma } from "@prisma/client"');
  });
});
