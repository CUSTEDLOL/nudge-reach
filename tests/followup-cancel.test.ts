// tests/followup-cancel.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findRuns, updateRun } = vi.hoisted(() => ({
  findRuns: vi.fn(),
  updateRun: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/db", () => ({
  prisma: { automationRun: { findMany: findRuns, update: updateRun } },
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage: vi.fn() }));

import { cancelWaitingRuns } from "@/modules/automation/engine";

const runs = [
  { id: "r1", status: "WAITING", log: [], automation: { spec: { stopOn: ["reply"] } } },
  { id: "r2", status: "WAITING", log: [{ step: 1, kind: "wait", ok: true, detail: "", at: "" }], automation: { spec: null } },
];

beforeEach(() => {
  updateRun.mockClear();
  findRuns.mockResolvedValue(runs);
});

describe("cancelWaitingRuns", () => {
  it("only looks at this org + contact's WAITING runs", async () => {
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(findRuns.mock.calls[0][0].where).toMatchObject({ orgId: "o1", contactId: "c1", status: "WAITING" });
  });

  it("a reply cancels every waiting run, appending a log line", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "reply");
    expect(n).toBe(2);
    expect(updateRun).toHaveBeenCalledTimes(2);
    const second = updateRun.mock.calls[1][0];
    expect(second.where).toEqual({ id: "r2" });
    expect(second.data.status).toBe("CANCELLED");
    expect(second.data.resumeAt).toBeNull();
    expect(second.data.log).toHaveLength(2);
    expect(second.data.log[1].detail).toMatch(/replied/i);
  });

  it("a booking honours stopOn: skips the spec that excludes it, cancels the spec-less run", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "booking");
    expect(n).toBe(1);
    expect(updateRun.mock.calls[0][0].where).toEqual({ id: "r2" });
  });

  it("an opt-out cancels everything regardless of stopOn", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "opt_out");
    expect(n).toBe(2);
    expect(updateRun.mock.calls[0][0].data.log[0].detail).toMatch(/opted out/i);
  });

  it("never throws — a database error is logged and returns 0", async () => {
    findRuns.mockRejectedValueOnce(new Error("db down"));
    await expect(cancelWaitingRuns("o1", "c1", "payment")).resolves.toBe(0);
  });
});
