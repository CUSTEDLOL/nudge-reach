import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  automationFindFirst: vi.fn(),
  automationFindMany: vi.fn(),
  automationCreate: vi.fn(),
  automationUpdate: vi.fn(),
  stepDeleteMany: vi.fn(),
  stepCreateMany: vi.fn(),
  runUpdateMany: vi.fn(),
  configUpsert: vi.fn(),
  tx: vi.fn(),
  sendMode: vi.fn(),
  submit: vi.fn(),
  draftStarterSet: vi.fn(),
  checkAutomationLimit: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    template: { findFirst: m.templateFindFirst, findMany: m.templateFindMany, create: m.templateCreate, update: m.templateUpdate },
    automation: { findFirst: m.automationFindFirst, findMany: m.automationFindMany, create: m.automationCreate, update: m.automationUpdate },
    automationStep: { deleteMany: m.stepDeleteMany, createMany: m.stepCreateMany },
    automationRun: { updateMany: m.runUpdateMany },
    followUpConfig: { upsert: m.configUpsert },
    $transaction: m.tx,
  },
}));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode: m.sendMode }));
vi.mock("@/modules/whatsapp/library", () => ({ submitRowToMeta: m.submit }));
vi.mock("@/modules/followup/draft", () => ({ draftStarterSet: m.draftStarterSet }));
vi.mock("@/modules/billing/limits", () => ({ checkAutomationLimit: m.checkAutomationLimit }));

import {
  installRevenueRecoveryPack,
  saveFollowUpFromSpec,
  setFollowUpFlag,
  writeStarterSet,
} from "@/modules/followup/install";
import type { FollowUpSpec } from "@/modules/followup/spec";

const spec: FollowUpSpec = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [] },
    { afterDays: 3, category: "MARKETING", header: "One last note", body: "Hi {{1}}, here when ready.", footer: "Reply STOP to unsubscribe", buttons: [] },
  ],
  stopOn: ["reply", "booking", "payment"],
};

let seq = 0;
beforeEach(() => {
  for (const fn of Object.values(m)) if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  m.calls.length = 0;
  seq = 0;
  m.sendMode.mockResolvedValue("simulation");
  m.tx.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  m.templateFindFirst.mockImplementation(async () => { m.calls.push("template.findFirst"); return null; });
  m.templateCreate.mockImplementation(async ({ data }) => { m.calls.push("template.create"); return { id: `t${++seq}`, ...data }; });
  m.templateUpdate.mockImplementation(async ({ where, data }) => { m.calls.push("template.update"); return { id: where.id, ...data }; });
  m.automationCreate.mockImplementation(async () => { m.calls.push("automation.create"); return { id: "cmauto0000000abcdefgh" }; });
  m.automationUpdate.mockImplementation(async () => { m.calls.push("automation.update"); return {}; });
  m.stepDeleteMany.mockResolvedValue({ count: 0 });
  m.stepCreateMany.mockImplementation(async () => { m.calls.push("step.createMany"); return { count: 0 }; });
  m.runUpdateMany.mockResolvedValue({ count: 0 });
  m.configUpsert.mockResolvedValue({});
  m.templateFindMany.mockResolvedValue([]);
});

describe("saveFollowUpFromSpec — create", () => {
  it("writes the automation first (off, no steps), keys template names on its id, then steps", async () => {
    const { id } = await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    expect(id).toBe("cmauto0000000abcdefgh");
    expect(m.calls.indexOf("automation.create")).toBeLessThan(m.calls.indexOf("template.findFirst"));
    expect(m.calls.indexOf("template.create")).toBeLessThan(m.calls.indexOf("step.createMany"));
    const created = m.automationCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ orgId: "o1", enabled: false, source: "ai", trigger: "conversation_quiet" });
    expect(created.spec).toEqual(spec);
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name);
    expect(names).toEqual(["fu_pricing_chase_abcdefgh_1", "fu_pricing_chase_abcdefgh_2"]);
    // Nothing can be waiting on a brand-new automation.
    expect(m.runUpdateMany).not.toHaveBeenCalled();
  });

  it("stores the Meta components ARRAY, not the whole payload, and resolves templateId into the steps", async () => {
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    for (const c of m.templateCreate.mock.calls) expect(Array.isArray(c[0].data.componentsJson)).toBe(true);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(["send_template", "wait", "send_template"]);
    expect(steps[0].config).toEqual({ templateId: "t1" });
    expect(steps[2].config).toEqual({ templateId: "t2" });
    expect(steps.every((s: { automationId: string }) => s.automationId === "cmauto0000000abcdefgh")).toBe(true);
  });

  it("can create it switched on when the caller says so (the pack)", async () => {
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "pack", enabled: true, name: "Custom name" });
    expect(m.automationCreate.mock.calls[0][0].data).toMatchObject({ enabled: true, name: "Custom name" });
  });
});

describe("saveFollowUpFromSpec — update", () => {
  const existing = {
    id: "cmauto0000000abcdefgh",
    orgId: "o1",
    spec: { ...spec },
    steps: [
      { order: 1, kind: "send_template", config: { templateId: "old1" } },
      { order: 2, kind: "wait", config: { minutes: 4320 } },
      { order: 3, kind: "send_template", config: { templateId: "old2" } },
    ],
  };

  it("keeps the templates a spec-backed automation already sends, even after a rename", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    m.templateFindMany.mockResolvedValue([{ id: "old1", name: "lead_nudge_1" }, { id: "old2", name: "lead_nudge_2" }]);
    m.templateFindFirst.mockImplementation(async ({ where }) => ({ id: where.name === "lead_nudge_1" ? "old1" : "old2", name: where.name, content: {}, metaStatus: "APPROVED", metaTemplateId: "x" }));
    await saveFollowUpFromSpec({ orgId: "o1", spec: { ...spec, name: "Renamed chase" }, source: "ai", automationId: existing.id });
    expect(m.templateCreate).not.toHaveBeenCalled();
    expect(m.templateUpdate.mock.calls.map((c) => c[0].where.id)).toEqual(["old1", "old2"]);
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.stepDeleteMany).toHaveBeenCalledWith({ where: { automationId: existing.id } });
    expect(m.automationUpdate.mock.calls[0][0].data).toMatchObject({ name: "Renamed chase", source: "ai" });
    // A run waiting on the old steps would otherwise resume against the new list.
    expect(m.runUpdateMany).toHaveBeenCalledWith({
      where: { automationId: existing.id, status: "WAITING" },
      data: { status: "CANCELLED", resumeAt: null },
    });
    expect(m.calls.indexOf("template.update")).toBeLessThan(m.calls.indexOf("step.createMany"));
  });

  it("pins only what it can: a shorter templateNames list derives the rest from the key", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    const three = { ...spec, messages: [...spec.messages, { ...spec.messages[1], header: "Last call" }] };
    await saveFollowUpFromSpec({ orgId: "o1", spec: three, source: "ai", automationId: existing.id, templateNames: ["lead_nudge_1", "lead_nudge_2"] });
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["lead_nudge_1", "lead_nudge_2", "fu_pricing_chase_abcdefgh_3"]);
  });

  it("falls back to the derived name for a pinned step whose template row is gone", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    m.templateFindMany.mockResolvedValue([{ id: "old1", name: "lead_nudge_1" }]);
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai", automationId: existing.id });
    expect(m.templateFindMany.mock.calls[0][0].where).toMatchObject({ orgId: "o1", id: { in: ["old1", "old2"] } });
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["lead_nudge_1", "fu_pricing_chase_abcdefgh_2"]);
  });

  it("never pins onto a builder-made automation's steps (they may be shared library templates)", async () => {
    m.automationFindFirst.mockResolvedValue({ ...existing, spec: null });
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai", automationId: existing.id });
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["fu_pricing_chase_abcdefgh_1", "fu_pricing_chase_abcdefgh_2"]);
  });

  it("refuses an automation outside the org", async () => {
    m.automationFindFirst.mockResolvedValue(null);
    await expect(saveFollowUpFromSpec({ orgId: "o2", spec, source: "ai", automationId: "nope" })).rejects.toThrow(/not found/i);
  });
});

describe("live mode template handling", () => {
  it("keeps an unchanged row's approval and resubmits changed copy", async () => {
    m.sendMode.mockResolvedValue("live");
    const unchangedContent = { productName: "Pricing chase — message 1", campaignAngle: "Follow-up.", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [], sampleName: "Priya", imageTreatment: "", notes: "Created from a follow-up." };
    m.templateFindFirst.mockImplementation(async ({ where }) =>
      where.name.endsWith("_1")
        ? { id: "k1", name: where.name, category: "MARKETING", content: unchangedContent, metaStatus: "APPROVED", metaTemplateId: "meta-1" }
        : { id: "k2", name: where.name, category: "MARKETING", content: { stale: true }, metaStatus: "APPROVED", metaTemplateId: "meta-2" }
    );
    m.submit.mockResolvedValue({});
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    const [first, second] = m.templateUpdate.mock.calls.map((c) => c[0].data);
    expect(first).toMatchObject({ metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    // The Meta id survives a copy change: the edit endpoint will need it.
    expect(second).toMatchObject({ metaStatus: "PENDING", metaTemplateId: "meta-2" });
    expect(m.submit).toHaveBeenCalledTimes(1);
  });

  it("treats a jsonb-reordered row with the same copy as unchanged (metadata differences ignored)", async () => {
    m.sendMode.mockResolvedValue("live");
    // Keys as Postgres jsonb stores them (by length, then bytes), with different
    // productName/notes — what Meta reviews is identical.
    const stored = {
      body: "Hi {{1}}, any questions?",
      notes: "Edited in the library.",
      footer: "Reply STOP to unsubscribe",
      header: "Still deciding?",
      buttons: [],
      sampleName: "Priya",
      productName: "Old name",
      campaignAngle: "Follow-up.",
      imageTreatment: "",
    };
    m.templateFindFirst.mockResolvedValue({ id: "k1", name: "fu_pricing_chase_abcdefgh_1", category: "MARKETING", content: stored, metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    await saveFollowUpFromSpec({ orgId: "o1", spec: { ...spec, messages: [spec.messages[0]] }, source: "ai" });
    expect(m.templateUpdate).toHaveBeenCalledTimes(1);
    expect(m.templateUpdate.mock.calls[0][0].data).toMatchObject({ metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    expect(m.submit).not.toHaveBeenCalled();
  });

  it("records a Meta refusal on the row, keeps going, and still wires the step", async () => {
    m.sendMode.mockResolvedValue("live");
    m.submit.mockRejectedValue(new Error("Meta said no"));
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    expect(m.submit).toHaveBeenCalledTimes(2);
    expect(m.templateUpdate.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "t1" }, data: { metaStatus: "REJECTED", rejectionReason: "Meta said no" } },
      { where: { id: "t2" }, data: { metaStatus: "REJECTED", rejectionReason: "Meta said no" } },
    ]);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps[0].config).toEqual({ templateId: "t1" });
    expect(steps[2].config).toEqual({ templateId: "t2" });
  });
});

describe("installRevenueRecoveryPack", () => {
  it("creates the nudge once, switched on, with its historical template names — and never overwrites it", async () => {
    m.automationFindFirst.mockResolvedValueOnce(null);
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).toHaveBeenCalledTimes(1);
    expect(m.automationCreate.mock.calls[0][0].data).toMatchObject({ enabled: true, source: "pack", name: "Revenue Recovery — quiet-lead nudge" });
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name).sort();
    expect(names).toEqual(["appt_reminder_24h", "appt_reminder_2h", "lead_nudge_1", "lead_nudge_2", "no_show_rebook", "review_ask"]);
    expect(m.configUpsert).toHaveBeenCalled();

    vi.clearAllMocks();
    m.sendMode.mockResolvedValue("simulation");
    m.automationFindFirst.mockResolvedValueOnce({ id: "existing", spec });
    m.templateFindFirst.mockResolvedValue(null);
    m.templateCreate.mockImplementation(async ({ data }) => ({ id: "t", ...data }));
    m.configUpsert.mockResolvedValue({});
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.automationUpdate).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name).some((n: string) => n.startsWith("lead_nudge"))).toBe(false);
  });

  it("upgrades a legacy campaign-reply install (no spec) in place, keeping its id and switch", async () => {
    const legacy = {
      id: "legacy",
      orgId: "o1",
      spec: null,
      steps: [
        { order: 1, kind: "wait", config: { minutes: 4320 } },
        { order: 2, kind: "send_template", config: { templateId: "old1" } },
        { order: 3, kind: "wait", config: { minutes: 4320 } },
        { order: 4, kind: "send_template", config: { templateId: "old2" } },
      ],
    };
    // Looked up twice: the installer's own check, then saveFollowUpFromSpec's update path.
    m.automationFindFirst.mockResolvedValueOnce({ id: "legacy", spec: null }).mockResolvedValueOnce(legacy);
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.runUpdateMany).toHaveBeenCalledWith({
      where: { automationId: "legacy", status: "WAITING" },
      data: { status: "CANCELLED", resumeAt: null },
    });
    expect(m.stepDeleteMany).toHaveBeenCalledWith({ where: { automationId: "legacy" } });
    const update = m.automationUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: "legacy" });
    expect(update.data).toMatchObject({ trigger: "conversation_quiet", source: "pack", name: "Revenue Recovery — quiet-lead nudge" });
    expect(update.data).not.toHaveProperty("enabled");
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name);
    expect(names.filter((n: string) => n.startsWith("lead_nudge"))).toEqual(["lead_nudge_1", "lead_nudge_2"]);
    expect(names.some((n: string) => n.startsWith("fu_"))).toBe(false);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(["send_template", "wait", "send_template"]);
    expect(steps.every((s: { automationId: string }) => s.automationId === "legacy")).toBe(true);
  });
});

/**
 * `followUpConfig.enabled` is the pack's master switch, and since the
 * pause/resume card was removed the only UI that touches it is a row switch.
 * Turning any row on therefore has to resume the pack, or a founder-side pause
 * (`founderSetFollowUpsEnabled`) is a dead end the owner can never leave.
 */
describe("setFollowUpFlag", () => {
  it("resumes a paused pack when a row is switched on", async () => {
    await setFollowUpFlag("o1", "bookingReminders", true);
    const args = m.configUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ orgId: "o1" });
    expect(args.update).toEqual({ bookingReminders: true, enabled: true });
  });

  it("never pauses the pack when a row is switched off", async () => {
    await setFollowUpFlag("o1", "bookingReminders", false);
    const args = m.configUpsert.mock.calls[0][0];
    expect(args.update).toEqual({ bookingReminders: false });
    expect(args.update).not.toHaveProperty("enabled");
  });
});

/**
 * The starter set: ready-made pack + a drafted set, per org. Lifted out of the
 * client action so the founder panel runs the same sequence for a client it is
 * onboarding — so these are the action's old behavioural tests, on the module.
 */
describe("writeStarterSet", () => {
  const drafted = (name: string): FollowUpSpec => ({ ...spec, name });
  /** Only the drafted follow-ups: the pack's nudge already exists below. */
  const createdNames = () => m.automationCreate.mock.calls.map((c) => c[0].data.name);

  beforeEach(() => {
    // Spec-backed, so installRevenueRecoveryPack leaves it alone and every
    // automation.create in these tests is one of the drafted follow-ups.
    m.automationFindFirst.mockResolvedValue({ id: "nudge", spec });
    m.automationFindMany.mockResolvedValue([]);
    m.checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  });

  it("installs the ready-made pack, then writes the drafted set, all off", async () => {
    m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase"), drafted("Welcome")]);
    const outcome = await writeStarterSet("o1");
    expect(outcome).toEqual({ created: 2, stopped: false, draftFailed: false, failed: false });
    expect(m.configUpsert).toHaveBeenCalled(); // the pack install
    expect(createdNames()).toEqual(["Quiet-lead chase", "Welcome"]);
    expect(m.automationCreate.mock.calls.every((c) => c[0].data.enabled === false)).toBe(true);
    expect(m.automationCreate.mock.calls.every((c) => c[0].data.source === "ai")).toBe(true);
  });

  it("skips a name the org already has, whatever its casing", async () => {
    m.automationFindMany.mockResolvedValue([{ name: "quiet-lead CHASE" }]);
    m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase"), drafted("Welcome")]);
    const outcome = await writeStarterSet("o1");
    expect(outcome.created).toBe(1);
    expect(createdNames()).toEqual(["Welcome"]);
  });

  it("keeps the installed pack when drafting fails, and logs the reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      m.draftStarterSet.mockRejectedValue(new Error("credits exhausted"));
      const outcome = await writeStarterSet("o1");
      expect(outcome).toEqual({ created: 0, stopped: false, draftFailed: true, failed: false });
      expect(m.configUpsert).toHaveBeenCalled();
      expect(m.automationCreate).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[followup-starter-set] drafting failed",
        expect.objectContaining({ orgId: "o1" })
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps what it saved when a save fails partway, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase"), drafted("Welcome"), drafted("Rebook")]);
      m.automationCreate
        .mockImplementationOnce(async () => ({ id: "cmauto0000000abcdefgh" }))
        .mockRejectedValueOnce(new Error("db went away"));
      const outcome = await writeStarterSet("o1");
      expect(outcome).toMatchObject({ created: 1, failed: true });
      expect(warn).toHaveBeenCalledWith(
        "[followup-starter-set] save failed",
        expect.objectContaining({ orgId: "o1", name: "Welcome" })
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("writes one follow-up when the model returns the same name twice", async () => {
    m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase"), drafted("QUIET-LEAD CHASE")]);
    expect((await writeStarterSet("o1")).created).toBe(1);
    expect(m.automationCreate).toHaveBeenCalledTimes(1);
  });

  it("skips a spec that doesn't validate instead of saving it", async () => {
    m.draftStarterSet.mockResolvedValue([
      { ...spec, situation: { kind: "nonsense" } } as unknown as FollowUpSpec,
      drafted("Welcome"),
    ]);
    expect((await writeStarterSet("o1")).created).toBe(1);
    expect(createdNames()).toEqual(["Welcome"]);
  });

  it("stops at the plan's automation limit and reports what it wrote", async () => {
    m.checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 4, limit: 5 });
    m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase"), drafted("Welcome"), drafted("Rebook")]);
    const outcome = await writeStarterSet("o1");
    expect(outcome).toMatchObject({ created: 1, stopped: true });
    expect(m.automationCreate).toHaveBeenCalledTimes(1);
  });

  it("creates nothing when the org already has every drafted name", async () => {
    m.automationFindMany.mockResolvedValue([{ name: "Quiet-lead chase" }]);
    m.draftStarterSet.mockResolvedValue([drafted("Quiet-lead chase")]);
    const outcome = await writeStarterSet("o1");
    expect(outcome).toEqual({ created: 0, stopped: false, draftFailed: false, failed: false });
    expect(m.automationCreate).not.toHaveBeenCalled();
  });
});
