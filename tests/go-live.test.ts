import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The moment a workspace can send for real. Found 2026-09-18 while preparing
 * the founder's test workspace for its first live number: six follow-up
 * templates "approved" by test mode with mock ids Meta has never seen, and a
 * test calendar that would have taken real customers' bookings.
 */

const { prisma, orgSendMode, submitRowToMeta } = vi.hoisted(() => ({
  prisma: {
    calendarAccount: { deleteMany: vi.fn() },
    whatsappAccount: { count: vi.fn() },
    template: {
      findMany: vi.fn(),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        void args;
        return {};
      }),
    },
  },
  orgSendMode: vi.fn(),
  submitRowToMeta: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode }));
vi.mock("@/modules/whatsapp/library", () => ({ submitRowToMeta }));

import { neverSeenByMeta, prepareWorkspaceForLive } from "@/modules/orgs/go-live";

const row = (id: string, metaTemplateId: string | null) => ({ id, name: id, metaTemplateId });

beforeEach(() => {
  vi.clearAllMocks();
  orgSendMode.mockResolvedValue("live");
  prisma.calendarAccount.deleteMany.mockResolvedValue({ count: 1 });
  prisma.whatsappAccount.count.mockResolvedValue(1);
  prisma.template.findMany.mockResolvedValue([
    row("appt_reminder_24h", "sim-tpl-appt_reminder_24h"),
    row("lead_nudge_1", null),
    row("welcome", "1234567890123456"), // really at Meta
  ]);
  submitRowToMeta.mockResolvedValue({});
});

describe("prepareWorkspaceForLive", () => {
  it("knows a mock approval from a real Meta id", () => {
    expect(neverSeenByMeta("sim-tpl-lead_nudge_1")).toBe(true);
    expect(neverSeenByMeta(null)).toBe(true);
    expect(neverSeenByMeta("1234567890123456")).toBe(false);
  });

  it("removes the test calendar and submits only what Meta has never seen", async () => {
    const r = await prepareWorkspaceForLive("o1");
    expect(prisma.calendarAccount.deleteMany).toHaveBeenCalledWith({ where: { orgId: "o1", simulated: true } });
    expect(submitRowToMeta).toHaveBeenCalledTimes(2);
    expect(submitRowToMeta.mock.calls.map((c) => c[1].id)).toEqual(["appt_reminder_24h", "lead_nudge_1"]);
    expect(r).toEqual({ testCalendarRemoved: true, templatesSubmitted: 2, templatesRefused: 0 });
  });

  it("does nothing to a workspace still in test mode", async () => {
    orgSendMode.mockResolvedValue("simulation");
    const r = await prepareWorkspaceForLive("o1");
    expect(prisma.calendarAccount.deleteMany).not.toHaveBeenCalled();
    expect(submitRowToMeta).not.toHaveBeenCalled();
    expect(r.templatesSubmitted).toBe(0);
  });

  it("waits for a number before talking to Meta, but still drops the test calendar", async () => {
    prisma.whatsappAccount.count.mockResolvedValue(0);
    const r = await prepareWorkspaceForLive("o1");
    expect(r.testCalendarRemoved).toBe(true);
    expect(submitRowToMeta).not.toHaveBeenCalled();
  });

  it("records Meta's refusal on the row and never throws", async () => {
    submitRowToMeta.mockRejectedValueOnce(new Error("Invalid parameter"));
    const r = await prepareWorkspaceForLive("o1");
    expect(r).toMatchObject({ templatesSubmitted: 1, templatesRefused: 1 });
    expect(prisma.template.update.mock.calls[0][0].data).toMatchObject({
      metaStatus: "REJECTED",
      rejectionReason: "Invalid parameter",
    });
  });
});
