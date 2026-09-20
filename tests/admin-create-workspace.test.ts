import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Founder-created workspaces. The rules that matter: the owner is invited,
 * never issued a password; a CLIENT workspace is live from the first sign-in
 * and a TEST one is simulated (founder rule, 2026-09-17); and an email that
 * already belongs somewhere is refused, because
 * an existing membership resolves before any pending invite so the invite
 * would silently never apply.
 */

const { prisma } = vi.hoisted(() => {
  const tx = {
    org: { create: vi.fn() },
    invite: { create: vi.fn() },
  };
  return {
    prisma: {
      membership: { findFirst: vi.fn() },
      invite: { findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));

const { founderAudit } = vi.hoisted(() => ({ founderAudit: vi.fn() }));
vi.mock("@/modules/admin/audit", () => ({ founderAudit }));

const { sendEmail, isEmailConfigured } = vi.hoisted(() => ({
  sendEmail: vi.fn(async (input: { text: string; html: string }) => {
    void input;
    return { ok: true };
  }),
  isEmailConfigured: vi.fn(() => true),
}));
vi.mock("@/modules/email", () => ({
  sendEmail,
  isEmailConfigured,
  appOrigin: () => "https://nudgeagent.app",
}));

const { createOwnerSetupToken } = vi.hoisted(() => ({
  createOwnerSetupToken: vi.fn(() => ({
    token: "a".repeat(43),
    hash: "hashed-owner-setup-token",
    expiresAt: new Date("2026-09-22T12:00:00.000Z"),
  })),
}));
vi.mock("@/modules/orgs/owner-setup", () => ({ createOwnerSetupToken }));

const { ensureIncludedGrantFor } = vi.hoisted(() => ({
  ensureIncludedGrantFor: vi.fn(async (orgId: string) => {
    void orgId;
    return true;
  }),
}));
vi.mock("@/modules/billing/credits", () => ({ ensureIncludedGrantFor }));

import { createWorkspace } from "@/modules/admin/create-workspace";
import { PENDING_OWNER_PREFIX } from "@/modules/orgs/pending-owner";

const tx = (prisma as unknown as { __tx: { org: { create: ReturnType<typeof vi.fn> }; invite: { create: ReturnType<typeof vi.fn> } } }).__tx;

const INPUT = {
  name: "Aster Skin Clinic",
  countryCode: "IN",
  plan: "growth",
  ownerEmail: "  Owner@Aster.in ",
  founderEmail: "founder@nudge.app",
  mode: "client",
};

beforeEach(() => {
  vi.clearAllMocks();
  isEmailConfigured.mockReturnValue(true);
  sendEmail.mockResolvedValue({ ok: true });
  prisma.membership.findFirst.mockResolvedValue(null);
  prisma.invite.findFirst.mockResolvedValue(null);
  tx.org.create.mockResolvedValue({ id: "org-1", name: "Aster Skin Clinic" });
  tx.invite.create.mockResolvedValue({});
});

describe("createWorkspace", () => {
  it("creates a CLIENT workspace live from day one, on the paid plan, in the right market", async () => {
    const res = await createWorkspace(INPUT);

    expect(res.ok).toBe(true);
    const data = tx.org.create.mock.calls[0][0].data;
    expect(data.plan).toBe("growth");
    expect(data.simulated).toBe(false);
    expect(data.currency).toBe("INR");
    expect(data.dialCode).toBe("+91");
    expect(data.timezone).toBe("Asia/Kolkata");
    // No owner exists yet, so the required owner column holds a sentinel.
    expect(String(data.ownerUserId).startsWith(PENDING_OWNER_PREFIX)).toBe(true);
  });

  // Found 2026-09-19, hours before the first production client: the workspace
  // was created "inactive" with no paid period, so in live mode the credit
  // ledger issued nothing and the AI refused its very first reply.
  it("starts the first paid month and issues the plan's AI credits", async () => {
    await createWorkspace(INPUT);
    const data = tx.org.create.mock.calls[0][0].data;
    expect(data.subscriptionStatus).toBe("active");
    expect(data.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect(ensureIncludedGrantFor).toHaveBeenCalledWith("org-1");
  });

  it("still creates the workspace when issuing credits fails", async () => {
    ensureIncludedGrantFor.mockRejectedValueOnce(new Error("ledger down"));
    const res = await createWorkspace(INPUT);
    expect(res.ok).toBe(true);
  });

  it("creates a TEST workspace simulated, and refuses when no mode is chosen", async () => {
    const test = await createWorkspace({ ...INPUT, mode: "test" });
    expect(test.ok).toBe(true);
    expect(tx.org.create.mock.calls[0][0].data.simulated).toBe(true);

    const none = await createWorkspace({ ...INPUT, mode: "" });
    expect(none.ok).toBe(false);
    expect(none.message).toMatch(/client workspace or a test one/);
    expect(tx.org.create).toHaveBeenCalledTimes(1);
  });

  it("invites the owner by email, normalized, and never issues a password", async () => {
    const result = await createWorkspace(INPUT);

    expect(tx.invite.create).toHaveBeenCalledWith({
      data: {
        orgId: "org-1",
        email: "owner@aster.in",
        role: "OWNER",
        setupTokenHash: "hashed-owner-setup-token",
        setupTokenExpiresAt: new Date("2026-09-22T12:00:00.000Z"),
      },
    });
    expect(result.setupLink).toEqual({
      url: `https://nudgeagent.app/invite/${"a".repeat(43)}`,
      email: "owner@aster.in",
      expiresAt: "2026-09-22T12:00:00.000Z",
    });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.text).toContain(result.setupLink?.url);
    expect(mail.html).toContain(result.setupLink?.url);
    expect(mail.text).not.toMatch(/password is|temporary password/i);
    expect(mail.html).toContain("you choose your own");
  });

  it("refuses an email that already belongs to a workspace", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      org: { id: "org-9", name: "Other Clinic" },
    });

    const res = await createWorkspace(INPUT);

    expect(res.ok).toBe(false);
    expect(res.message).toContain("Other Clinic");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a second pending invite for the same email", async () => {
    prisma.invite.findFirst.mockResolvedValue({ org: { name: "Other Clinic" } });

    const res = await createWorkspace(INPUT);

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/pending invite/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a bad email, a missing name, an unknown country and a retired plan", async () => {
    for (const bad of [
      { ...INPUT, ownerEmail: "not-an-email" },
      { ...INPUT, name: "A" },
      { ...INPUT, countryCode: "ZZ" },
      { ...INPUT, plan: "front_desk" }, // retired, never assignable
    ]) {
      const res = await createWorkspace(bad);
      expect(res.ok).toBe(false);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("still reports success when the email cannot be sent, and says what to do", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));

    const res = await createWorkspace(INPUT);

    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/couldn't be sent/i);
    expect(res.setupLink?.url).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  });

  it("records the creation in the workspace's own audit log", async () => {
    await createWorkspace(INPUT);
    expect(founderAudit).toHaveBeenCalledWith(
      "org-1",
      "founder@nudge.app",
      "admin.workspace_created",
      "Aster Skin Clinic",
      expect.stringContaining("owner@aster.in"),
      expect.anything()
    );
  });
});
