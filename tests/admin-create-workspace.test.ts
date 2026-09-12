import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Founder-created workspaces. The rules that matter: the owner is invited,
 * never issued a password; the workspace opens in test mode on the plan they
 * paid for; and an email that already belongs somewhere is refused, because
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
  sendEmail: vi.fn(async () => ({ ok: true })),
  isEmailConfigured: vi.fn(() => true),
}));
vi.mock("@/modules/email", () => ({
  sendEmail,
  isEmailConfigured,
  appOrigin: () => "https://nudgeagent.app",
}));

import { createWorkspace } from "@/modules/admin/create-workspace";
import { PENDING_OWNER_PREFIX } from "@/modules/orgs/pending-owner";

const tx = (prisma as unknown as { __tx: { org: { create: ReturnType<typeof vi.fn> }; invite: { create: ReturnType<typeof vi.fn> } } }).__tx;

const INPUT = {
  name: "Aster Skin Clinic",
  countryCode: "IN",
  plan: "growth",
  ownerEmail: "  Owner@Aster.in ",
  founderEmail: "founder@nudge.app",
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
  it("creates the workspace on the paid plan, in test mode, in the right market", async () => {
    const res = await createWorkspace(INPUT);

    expect(res.ok).toBe(true);
    const data = tx.org.create.mock.calls[0][0].data;
    expect(data.plan).toBe("growth");
    expect(data.simulated).toBe(true);
    expect(data.currency).toBe("INR");
    expect(data.dialCode).toBe("+91");
    expect(data.timezone).toBe("Asia/Kolkata");
    // No owner exists yet, so the required owner column holds a sentinel.
    expect(String(data.ownerUserId).startsWith(PENDING_OWNER_PREFIX)).toBe(true);
  });

  it("invites the owner by email, normalized, and never issues a password", async () => {
    await createWorkspace(INPUT);

    expect(tx.invite.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", email: "owner@aster.in", role: "OWNER" },
    });
    const mail = sendEmail.mock.calls[0][0] as { text: string; html: string };
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
