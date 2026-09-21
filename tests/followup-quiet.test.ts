import { describe, it, expect, vi, beforeEach } from "vitest";

const { findAutomations, findTemplates, findRuns, findConversations, runAutomation } = vi.hoisted(() => ({
  findAutomations: vi.fn(),
  findTemplates: vi.fn(),
  findRuns: vi.fn().mockResolvedValue([]),
  findConversations: vi.fn().mockResolvedValue([]),
  runAutomation: vi.fn().mockResolvedValue({ status: "WAITING" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    automation: { findMany: findAutomations },
    template: { findMany: findTemplates },
    automationRun: { findMany: findRuns },
    conversation: { findMany: findConversations },
  },
}));
vi.mock("@/modules/automation/engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/automation/engine")>()),
  runAutomation,
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));

import { fireQuietConversations } from "@/modules/automation/triggers";

const automation = {
  id: "a1",
  orgId: "o1",
  name: "Quiet chase",
  trigger: "conversation_quiet",
  triggerConfig: { hours: 48, stage: "QUALIFIED" },
  org: { plan: "growth" },
  steps: [{ id: "s1", automationId: "a1", order: 1, kind: "send_template", config: { templateId: "t1" } }],
};

beforeEach(() => {
  runAutomation.mockClear();
  findRuns.mockClear().mockResolvedValue([{ contactId: "c-done" }]);
  findConversations.mockClear().mockResolvedValue([]);
  findTemplates.mockReset().mockResolvedValue([{ id: "t1", metaStatus: "APPROVED", category: "MARKETING" }]);
  findAutomations.mockResolvedValue([automation]);
});

describe("fireQuietConversations", () => {
  const now = new Date("2026-09-20T03:00:00Z");
  const cutoff = now.getTime() - 48 * 3_600_000;
  const week = 7 * 24 * 3_600_000;

  it("selects open/pending WhatsApp conversations silent both ways past the cutoff, within the lookback, opted-in, at the stage, never chased before", async () => {
    await fireQuietConversations(now);
    expect(findTemplates.mock.calls[0][0]).toMatchObject({
      where: { orgId: "o1", id: { in: ["t1"] } },
      select: { id: true, metaStatus: true, category: true },
    });
    expect(findRuns.mock.calls[0][0].where).toEqual({
      automationId: "a1",
      contactId: { not: null },
      NOT: { status: "FAILED", currentStep: { lte: 1 } },
    });
    const query = findConversations.mock.calls[0][0];
    const where = query.where;
    expect(where.orgId).toBe("o1");
    expect(where.channel).toBe("whatsapp");
    expect(where.status).toEqual({ in: ["open", "pending"] });
    expect(where.lastInboundAt.not).toBeNull();
    expect(where.lastInboundAt.lte.getTime()).toBe(cutoff);
    expect(where.lastInboundAt.gt.getTime()).toBe(cutoff - week);
    expect(where.lastMessageAt.lte.getTime()).toBe(cutoff);
    expect(where.contact).toEqual({ optedOutAt: null, optedIn: true, leadStage: "QUALIFIED" });
    expect(where.contactId).toEqual({ notIn: ["c-done"] });
    expect(query.orderBy).toEqual({ lastInboundAt: "asc" });
    expect(query.take).toBe(200);
  });

  it("does not require opt-in when every send template is UTILITY", async () => {
    findTemplates.mockResolvedValue([{ id: "t1", metaStatus: "APPROVED", category: "UTILITY" }]);
    await fireQuietConversations(now);
    expect(findConversations.mock.calls[0][0].where.contact).toEqual({ optedOutAt: null, leadStage: "QUALIFIED" });
  });

  it("never looks templates up for an automation with no send_template step", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, steps: [{ id: "s1", automationId: "a1", order: 1, kind: "send_message", config: { text: "Still there?" } }] },
    ]);
    await fireQuietConversations(now);
    expect(findTemplates).not.toHaveBeenCalled();
    expect(findConversations).toHaveBeenCalledTimes(1);
  });

  it("starts nothing while a send template is still pending at Meta", async () => {
    findTemplates.mockResolvedValue([{ id: "t1", metaStatus: "PENDING", category: "MARKETING" }]);
    await expect(fireQuietConversations(now)).resolves.toBe(0);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("starts nothing when a send template is missing from the org's library", async () => {
    findTemplates.mockResolvedValue([]);
    await expect(fireQuietConversations(now)).resolves.toBe(0);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("omits the stage filter when the config has none", async () => {
    findAutomations.mockResolvedValue([{ ...automation, triggerConfig: { hours: 24 } }]);
    await fireQuietConversations(now);
    expect(findConversations.mock.calls[0][0].where.contact).toEqual({ optedOutAt: null, optedIn: true });
  });

  it("starts one run per quiet conversation and reports the count", async () => {
    findConversations.mockResolvedValue([
      { id: "v1", contactId: "c1" },
      { id: "v2", contactId: "c2" },
    ]);
    const started = await fireQuietConversations(now);
    expect(started).toBe(2);
    expect(runAutomation).toHaveBeenCalledWith(automation, { orgId: "o1", contactId: "c1", conversationId: "v1" });
  });

  it("skips a step-less automation and an org off the AI Front Desk plans", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, id: "empty", steps: [] },
      { ...automation, id: "downgraded", org: { plan: "starter" } },
    ]);
    await fireQuietConversations(now);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("keeps going past skipped automations to a valid one", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, id: "empty", steps: [] },
      { ...automation, id: "downgraded", org: { plan: "starter" } },
      automation,
    ]);
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }]);
    await expect(fireQuietConversations(now)).resolves.toBe(1);
    expect(runAutomation).toHaveBeenCalledTimes(1);
    expect(runAutomation.mock.calls[0][0]).toMatchObject({ id: "a1" });
  });

  it("evaluates every automation of an org separately", async () => {
    findAutomations.mockResolvedValue([automation, { ...automation, id: "a2" }]);
    await fireQuietConversations(now);
    expect(findRuns.mock.calls.map((c) => c[0].where.automationId)).toEqual(["a1", "a2"]);
    expect(findConversations).toHaveBeenCalledTimes(2);
  });

  it("survives a failing run and keeps going", async () => {
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }, { id: "v2", contactId: "c2" }]);
    runAutomation.mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fireQuietConversations(now)).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
