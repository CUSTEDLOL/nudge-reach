import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  automationFindFirst: vi.fn(),
  automationCreate: vi.fn(),
  automationUpdate: vi.fn(),
  stepDeleteMany: vi.fn(),
  stepCreateMany: vi.fn(),
  configUpsert: vi.fn(),
  tx: vi.fn(),
  sendMode: vi.fn(),
  submit: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    template: { findFirst: m.templateFindFirst, findMany: m.templateFindMany, create: m.templateCreate, update: m.templateUpdate },
    automation: { findFirst: m.automationFindFirst, create: m.automationCreate, update: m.automationUpdate },
    automationStep: { deleteMany: m.stepDeleteMany, createMany: m.stepCreateMany },
    followUpConfig: { upsert: m.configUpsert },
    $transaction: m.tx,
  },
}));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode: m.sendMode }));
vi.mock("@/modules/whatsapp/library", () => ({ submitRowToMeta: m.submit }));

import { installRevenueRecoveryPack, saveFollowUpFromSpec } from "@/modules/followup/install";
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
        ? { id: "k1", name: where.name, content: unchangedContent, metaStatus: "APPROVED", metaTemplateId: "meta-1" }
        : { id: "k2", name: where.name, content: { stale: true }, metaStatus: "APPROVED", metaTemplateId: "meta-2" }
    );
    m.submit.mockResolvedValue({});
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    const [first, second] = m.templateUpdate.mock.calls.map((c) => c[0].data);
    expect(first).toMatchObject({ metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    expect(second).toMatchObject({ metaStatus: "PENDING", metaTemplateId: null });
    expect(m.submit).toHaveBeenCalledTimes(1);
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
    m.automationFindFirst.mockResolvedValueOnce({ id: "existing" });
    m.templateFindFirst.mockResolvedValue(null);
    m.templateCreate.mockImplementation(async ({ data }) => ({ id: "t", ...data }));
    m.configUpsert.mockResolvedValue({});
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name).some((n: string) => n.startsWith("lead_nudge"))).toBe(false);
  });
});
