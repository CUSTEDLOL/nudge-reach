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
  findConversations.mockClear();
  findTemplates.mockReset().mockResolvedValue([{ id: "t1", metaStatus: "APPROVED" }]);
  findRuns.mockResolvedValue([{ contactId: "c-done" }]);
  findAutomations.mockResolvedValue([automation]);
});

describe("fireQuietConversations", () => {
  const now = new Date("2026-09-20T03:00:00Z");

  it("selects open/pending WhatsApp conversations quiet past the cutoff, opted-in, at the stage, never chased before", async () => {
    await fireQuietConversations(now);
    const where = findConversations.mock.calls[0][0].where;
    expect(where.orgId).toBe("o1");
    expect(where.channel).toBe("whatsapp");
    expect(where.status).toEqual({ in: ["open", "pending"] });
    expect(where.lastInboundAt.lte.getTime()).toBe(now.getTime() - 48 * 3_600_000);
    expect(where.lastInboundAt.not).toBeNull();
    expect(where.contact).toMatchObject({ optedOutAt: null, leadStage: "QUALIFIED" });
    expect(where.contactId).toEqual({ notIn: ["c-done"] });
    expect(findTemplates.mock.calls[0][0].where).toMatchObject({ orgId: "o1", id: { in: ["t1"] } });
  });

  it("starts nothing while a send template is still pending at Meta", async () => {
    findTemplates.mockResolvedValue([{ id: "t1", metaStatus: "PENDING" }]);
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
    expect(findConversations.mock.calls[0][0].where.contact).toEqual({ optedOutAt: null });
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

  it("survives a failing run and keeps going", async () => {
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }, { id: "v2", contactId: "c2" }]);
    runAutomation.mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fireQuietConversations(now)).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
