// tests/followup-cancel.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findRuns, claimRun } = vi.hoisted(() => ({
  findRuns: vi.fn(),
  claimRun: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { automationRun: { findMany: findRuns, updateMany: claimRun } },
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage: vi.fn() }));

import { cancelWaitingRuns } from "@/modules/automation/engine";

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

// Shaped like the engine's select: the log is whatever Postgres holds.
const runs = [
  { id: "r1", currentStep: 1, log: [], automation: { spec: { stopOn: ["reply"] } } },
  {
    id: "r2",
    currentStep: 1,
    log: [{ step: 1, kind: "wait", ok: true, detail: "", at: "" }],
    automation: { spec: null },
  },
];

beforeEach(() => {
  errorLog.mockClear();
  claimRun.mockReset().mockResolvedValue({ count: 1 });
  findRuns.mockResolvedValue(runs);
});

describe("cancelWaitingRuns", () => {
  it("only looks at this org + contact's WAITING runs", async () => {
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(findRuns.mock.calls[0][0].where).toMatchObject({ orgId: "o1", contactId: "c1", status: "WAITING" });
  });

  it("a reply cancels every waiting run — claimed atomically, with a log line for the step that was next", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "reply");
    expect(n).toBe(2);
    expect(claimRun).toHaveBeenCalledTimes(2);
    const second = claimRun.mock.calls[1][0];
    expect(second.where).toEqual({ id: "r2", status: "WAITING" });
    expect(second.data.status).toBe("CANCELLED");
    expect(second.data.resumeAt).toBeNull();
    expect(second.data.log).toHaveLength(2);
    expect(second.data.log[1]).toMatchObject({ step: 2, kind: "cancel", ok: true });
    expect(second.data.log[1].detail).toMatch(/replied/i);
  });

  it("a booking honours stopOn: skips the spec that excludes it, cancels the spec-less run", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "booking");
    expect(n).toBe(1);
    expect(claimRun.mock.calls[0][0].where).toEqual({ id: "r2", status: "WAITING" });
  });

  it("an opt-out cancels everything regardless of stopOn", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "opt_out");
    expect(n).toBe(2);
    expect(claimRun.mock.calls[0][0].data.log[0].detail).toMatch(/opted out/i);
  });

  it("a run the tick claimed first (count 0) is not counted as cancelled", async () => {
    claimRun.mockResolvedValueOnce({ count: 0 });
    await expect(cancelWaitingRuns("o1", "c1", "reply")).resolves.toBe(1);
    expect(claimRun).toHaveBeenCalledTimes(2);
  });

  it("one bad row is logged and skipped — the rest still cancel", async () => {
    claimRun.mockRejectedValueOnce(new Error("row locked"));
    await expect(cancelWaitingRuns("o1", "c1", "reply")).resolves.toBe(1);
    expect(claimRun).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it("a corrupt log is replaced by exactly the cancel entry", async () => {
    findRuns.mockResolvedValue([{ id: "r3", currentStep: 1, log: "garbage", automation: { spec: null } }]);
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(claimRun.mock.calls[0][0].data.log).toEqual([
      { step: 2, kind: "cancel", ok: true, detail: "Cancelled — the customer replied.", at: expect.any(String) },
    ]);
  });

  it("never throws — a database error is logged and returns 0", async () => {
    findRuns.mockRejectedValueOnce(new Error("db down"));
    await expect(cancelWaitingRuns("o1", "c1", "payment")).resolves.toBe(0);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });
});
