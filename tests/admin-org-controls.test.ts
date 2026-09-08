import { beforeEach, describe, expect, it, vi } from "vitest";

/** Founder org controls: validation, no-op detection, and the audit row. */
const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    org: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      org: { findUnique: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));

import {
  parseOverridesForm,
  setFeatureOverrides,
  setLiveMode,
  setSubscriptionStatus,
  setSuspended,
  setTrial,
  setVoiceMinutes,
} from "@/modules/admin/org-controls";

const baseOrg = {
  id: "o1",
  name: "Glow Clinic",
  plan: "pro",
  simulated: true,
  suspendedAt: null as Date | null,
  trialEndsAt: null as Date | null,
  subscriptionStatus: "inactive",
  voiceMinutesOverride: null as number | null,
  featureOverrides: {} as unknown,
  whatsappAccounts: [] as { id: string }[],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ ...baseOrg });
  prisma.org.update.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});
  tx.org.update.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work) => work(tx));
});

function lastAudit() {
  return tx.auditLog.create.mock.calls.at(-1)?.[0].data;
}

describe("setTrial", () => {
  it("rejects out-of-range lengths without touching the DB", async () => {
    expect((await setTrial("o1", -1, "f@x.com")).ok).toBe(false);
    expect((await setTrial("o1", 181, "f@x.com")).ok).toBe(false);
    expect((await setTrial("o1", 2.5, "f@x.com")).ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });

  it("sets a future end date and audits before → after with the reason", async () => {
    const res = await setTrial("o1", 14, "f@x.com", "extended for pilot");
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const data = tx.org.update.mock.calls[0][0].data;
    expect(data.trialEndsAt.getTime()).toBeGreaterThan(Date.now() + 13 * 86400000);
    const audit = lastAudit();
    expect(audit.action).toBe("admin.trial_changed");
    expect(audit.actorName).toBe("founder:f@x.com");
    expect(audit.detail).toContain("reason: extended for pilot");
  });

  it("0 days clears the trial", async () => {
    await setTrial("o1", 0, "f@x.com");
    expect(tx.org.update.mock.calls[0][0].data.trialEndsAt).toBeNull();
  });

  it("rejects the transaction when the audit row cannot be written", async () => {
    tx.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(setTrial("o1", 14, "f@x.com")).rejects.toThrow(
      "audit unavailable"
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("setSubscriptionStatus", () => {
  it("rejects unknown statuses and no-ops", async () => {
    expect((await setSubscriptionStatus("o1", "comped", "f@x.com")).ok).toBe(false);
    expect((await setSubscriptionStatus("o1", "inactive", "f@x.com")).ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });

  it("writes the new status and audits it", async () => {
    const res = await setSubscriptionStatus("o1", "active", "f@x.com");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ subscriptionStatus: "active" });
    expect(lastAudit().detail).toContain("inactive → active");
  });
});

describe("setLiveMode", () => {
  it("refuses to go live without a connected WhatsApp number", async () => {
    const res = await setLiveMode("o1", true, "f@x.com");
    expect(res.ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });

  it("goes live once a number exists, and back to test any time", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, whatsappAccounts: [{ id: "w1" }] });
    expect((await setLiveMode("o1", true, "f@x.com", "owner approved", "Glow Clinic")).ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ simulated: false });
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, simulated: false });
    expect((await setLiveMode("o1", false, "f@x.com", "testing an issue", " glow clinic ")).ok).toBe(true);
    expect(lastAudit().action).toBe("admin.mode_changed");
  });

  it("requires the exact organization name before changing send mode", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, whatsappAccounts: [{ id: "w1" }] });

    const res = await setLiveMode("o1", true, "f@x.com", "owner approved", "Glow");

    expect(res.ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });
});

describe("setVoiceMinutes", () => {
  it("validates the range and treats null as 'plan default'", async () => {
    expect((await setVoiceMinutes("o1", -5, "f@x.com")).ok).toBe(false);
    expect((await setVoiceMinutes("o1", null, "f@x.com")).ok).toBe(false); // already null
    const res = await setVoiceMinutes("o1", 250, "f@x.com");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ voiceMinutesOverride: 250 });
    expect(lastAudit().detail).toContain("plan → 250");
  });
});

describe("setSuspended", () => {
  it("requires a reason to suspend", async () => {
    const res = await setSuspended("o1", true, "f@x.com", "  ");
    expect(res.ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });

  it("suspends with a timestamp and lifts with null, auditing each", async () => {
    expect((await setSuspended("o1", true, "f@x.com", "chargeback", "Glow Clinic")).ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data.suspendedAt).toBeInstanceOf(Date);
    expect(lastAudit().action).toBe("admin.suspended");
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, suspendedAt: new Date() });
    expect((await setSuspended("o1", false, "f@x.com", "chargeback resolved", "Glow Clinic")).ok).toBe(true);
    expect(tx.org.update.mock.calls[1][0].data).toEqual({ suspendedAt: null });
    expect(lastAudit().action).toBe("admin.unsuspended");
  });

  it("requires the exact organization name before changing suspension", async () => {
    const res = await setSuspended("o1", true, "f@x.com", "chargeback", "Other Clinic");

    expect(res.ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });
});

describe("feature overrides", () => {
  it("parses the form: inherit / on / off / unlimited / numbers", () => {
    expect(
      parseOverridesForm({ publicApi: "on", byoLlm: "off", contacts: "5000", messagesPerMonth: "unlimited", voiceAgent: "", junk: "maybe" })
    ).toEqual({ publicApi: true, byoLlm: false, contacts: 5000, messagesPerMonth: null });
  });

  it("stores only sanitized keys and audits the diff", async () => {
    const res = await setFeatureOverrides("o1", { publicApi: true, nonsense: 1, contacts: -3 }, "f@x.com");
    expect(res.ok).toBe(true);
    expect(tx.org.update.mock.calls[0][0].data).toEqual({ featureOverrides: { publicApi: true } });
    expect(lastAudit().detail).toContain('{"publicApi":true}');
  });

  it("is a no-op when nothing effectively changes", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...baseOrg, featureOverrides: { publicApi: true } });
    const res = await setFeatureOverrides("o1", { publicApi: true, junk: 2 }, "f@x.com");
    expect(res.ok).toBe(false);
    expect(tx.org.update).not.toHaveBeenCalled();
  });
});
