import { beforeEach, describe, expect, it, vi } from "vitest";

/** Founder team controls: ownerless-org guard, transfer semantics, audit. */
const {
  prisma,
  tx,
  checkTeamLimit,
  isEmailConfigured,
  sendEmail,
  appOrigin,
} = vi.hoisted(() => {
  const tx = {
    membership: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    org: { update: vi.fn() },
    invite: { delete: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      membership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
      org: { findUnique: vi.fn(), update: vi.fn() },
      invite: { findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    checkTeamLimit: vi.fn(),
    isEmailConfigured: vi.fn(),
    sendEmail: vi.fn(),
    appOrigin: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/billing/limits", () => ({ checkTeamLimit }));
vi.mock("@/modules/email", () => ({
  isEmailConfigured,
  sendEmail,
  appOrigin,
}));

import {
  inviteMember,
  removeMember,
  resendInvite,
  revokeInvite,
  setMemberRole,
  transferOwnership,
} from "@/modules/admin/team";

const owner = { id: "m1", userId: "u1", email: "owner@x.com", displayName: "Owner", role: "OWNER" };
const agent = { id: "m2", userId: "u2", email: "agent@x.com", displayName: null, role: "AGENT" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.membership.update.mockResolvedValue({});
  prisma.membership.updateMany.mockResolvedValue({});
  prisma.membership.delete.mockResolvedValue({});
  prisma.org.update.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});
  prisma.membership.findFirst.mockResolvedValue(null);
  prisma.invite.findUnique.mockResolvedValue(null);
  prisma.org.findUnique.mockResolvedValue({ ownerUserId: "u1", name: "Glow Clinic" });
  tx.membership.count.mockResolvedValue(2);
  tx.membership.update.mockResolvedValue({});
  tx.membership.updateMany.mockResolvedValue({});
  tx.membership.delete.mockResolvedValue({});
  tx.org.update.mockResolvedValue({});
  tx.invite.delete.mockResolvedValue({});
  tx.invite.upsert.mockResolvedValue({ id: "i1" });
  tx.auditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work) => work(tx));
  checkTeamLimit.mockResolvedValue({ allowed: true, message: "", used: 1, limit: 5 });
  isEmailConfigured.mockReturnValue(false);
  sendEmail.mockResolvedValue({ ok: true });
  appOrigin.mockReturnValue("https://nudgeagent.app");
});

describe("setMemberRole", () => {
  it("rejects unknown roles and members outside the org", async () => {
    expect((await setMemberRole("o1", "m2", "SUPER", "f@x.com")).ok).toBe(false);
    prisma.membership.findFirst.mockResolvedValue(null);
    expect((await setMemberRole("o1", "m9", "ADMIN", "f@x.com")).ok).toBe(false);
    expect(tx.membership.update).not.toHaveBeenCalled();
  });

  it("never demotes the last owner", async () => {
    prisma.membership.findFirst.mockResolvedValue(owner);
    prisma.membership.count.mockResolvedValue(1);
    tx.membership.count.mockResolvedValue(1);
    const res = await setMemberRole("o1", "m1", "ADMIN", "f@x.com");
    expect(res.ok).toBe(false);
    expect(tx.membership.update).not.toHaveBeenCalled();
  });

  it("promotes and audits with the founder as actor", async () => {
    prisma.membership.findFirst.mockResolvedValue(agent);
    const res = await setMemberRole("o1", "m2", "ADMIN", "f@x.com", "runs the front desk");
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.membership.update).toHaveBeenCalledWith({ where: { id: "m2" }, data: { role: "ADMIN" } });
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("admin.member_role_changed");
    expect(audit.actorName).toBe("founder:f@x.com");
    expect(audit.detail).toContain("AGENT → ADMIN");
  });
});

describe("removeMember", () => {
  it("refuses to remove the last owner", async () => {
    prisma.membership.findFirst.mockResolvedValue(owner);
    prisma.membership.count.mockResolvedValue(1);
    tx.membership.count.mockResolvedValue(1);
    expect((await removeMember("o1", "m1", "f@x.com")).ok).toBe(false);
    expect(tx.membership.delete).not.toHaveBeenCalled();
  });

  it("removes a non-owner", async () => {
    prisma.membership.findFirst.mockResolvedValue(agent);
    expect((await removeMember("o1", "m2", "f@x.com")).ok).toBe(true);
    expect(tx.membership.delete).toHaveBeenCalledWith({ where: { id: "m2" } });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe("admin.member_removed");
  });
});

describe("transferOwnership", () => {
  it("is a no-op when the target already owns the org", async () => {
    prisma.membership.findFirst.mockResolvedValue(owner);
    prisma.org.findUnique.mockResolvedValue({ ownerUserId: "u1", name: "Glow" });
    expect((await transferOwnership("o1", "m1", "f@x.com")).ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("demotes other owners, promotes the target and moves Org.ownerUserId atomically", async () => {
    prisma.membership.findFirst.mockResolvedValue(agent);
    prisma.org.findUnique.mockResolvedValue({ ownerUserId: "u1", name: "Glow" });
    const res = await transferOwnership("o1", "m2", "f@x.com", "founder left the clinic", "agent@x.com");
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.membership.updateMany).toHaveBeenCalledWith({
      where: { orgId: "o1", role: "OWNER", NOT: { id: "m2" } },
      data: { role: "ADMIN" },
    });
    expect(tx.membership.update).toHaveBeenCalledWith({ where: { id: "m2" }, data: { role: "OWNER" } });
    expect(tx.org.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { ownerUserId: "u2" } });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe("admin.ownership_transferred");
  });

  it("requires the target email before transferring ownership", async () => {
    prisma.membership.findFirst.mockResolvedValue(agent);
    prisma.org.findUnique.mockResolvedValue({ ownerUserId: "u1", name: "Glow" });

    const res = await transferOwnership(
      "o1",
      "m2",
      "f@x.com",
      "founder left the clinic",
      "owner@x.com"
    );

    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("inviteMember", () => {
  it("rejects invalid email addresses and roles", async () => {
    expect((await inviteMember("o1", "not-an-email", "AGENT", "f@x.com")).ok).toBe(false);
    expect((await inviteMember("o1", "new@x.com", "OWNER", "f@x.com")).ok).toBe(false);
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an existing member or pending invite in the selected org", async () => {
    prisma.membership.findFirst.mockResolvedValueOnce(agent);
    expect((await inviteMember("o1", "agent@x.com", "AGENT", "f@x.com")).ok).toBe(false);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { orgId: "o1", email: "agent@x.com" },
    });

    prisma.membership.findFirst.mockResolvedValueOnce(null);
    prisma.invite.findUnique.mockResolvedValueOnce({ status: "pending" });
    expect((await inviteMember("o1", "new@x.com", "ADMIN", "f@x.com")).ok).toBe(false);
    expect(prisma.invite.findUnique).toHaveBeenCalledWith({
      where: { orgId_email: { orgId: "o1", email: "new@x.com" } },
    });
  });

  it("enforces the team-plan limit before creating an invite", async () => {
    checkTeamLimit.mockResolvedValueOnce({
      allowed: false,
      message: "Starter allows 2 team seats.",
      used: 2,
      limit: 2,
    });

    const res = await inviteMember("o1", "new@x.com", "AGENT", "f@x.com");

    expect(res).toEqual({ ok: false, error: "Starter allows 2 team seats." });
    expect(tx.invite.upsert).not.toHaveBeenCalled();
  });

  it("upserts within the org and audits the founder in the same transaction", async () => {
    const res = await inviteMember("o1", " NEW@X.COM ", "ADMIN", "f@x.com");

    expect(res.ok).toBe(true);
    expect(tx.invite.upsert).toHaveBeenCalledWith({
      where: { orgId_email: { orgId: "o1", email: "new@x.com" } },
      create: { orgId: "o1", email: "new@x.com", role: "ADMIN" },
      update: { role: "ADMIN", status: "pending" },
    });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      orgId: "o1",
      actorName: "founder:f@x.com",
      action: "admin.invite_created",
      target: "new@x.com",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends escaped AI Front Desk copy and records successful delivery", async () => {
    isEmailConfigured.mockReturnValue(true);
    prisma.org.findUnique.mockResolvedValue({
      ownerUserId: "u1",
      name: "Glow <Clinic>",
    });

    const res = await inviteMember("o1", "new@x.com", "AGENT", "f@x.com");

    expect(res.ok).toBe(true);
    const email = sendEmail.mock.calls[0][0];
    expect(email.html).toContain("AI Front Desk");
    expect(email.html).not.toContain("WhatsApp CRM");
    expect(email.html).toContain("Glow &lt;Clinic&gt;");
    expect(email.html).not.toContain("Glow <Clinic>");
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      actorName: "founder:f@x.com",
      action: "admin.invite_delivery",
      target: "new@x.com",
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.detail).toContain("sent");
  });

  it("keeps a valid invite when email delivery fails", async () => {
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValueOnce({ ok: false, error: "Resend unavailable" });

    const res = await inviteMember("o1", "new@x.com", "AGENT", "f@x.com");

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.message).toContain("couldn't be sent");
    expect(prisma.auditLog.create.mock.calls[0][0].data.detail).toContain("failed");
  });
});

describe("resendInvite", () => {
  it("resends only a pending invite scoped to the selected org", async () => {
    isEmailConfigured.mockReturnValue(true);
    prisma.invite.findFirst.mockResolvedValue({
      id: "i1",
      email: "new@x.com",
      role: "AGENT",
      org: { name: "Glow Clinic" },
    });

    const res = await resendInvite("o1", "i1", "f@x.com");

    expect(res.ok).toBe(true);
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { id: "i1", orgId: "o1", status: "pending" },
      select: {
        id: true,
        email: true,
        role: true,
        org: { select: { name: true } },
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data.detail).toContain("resent: sent");
  });

  it("does not send for another org or without email configuration", async () => {
    isEmailConfigured.mockReturnValue(true);
    prisma.invite.findFirst.mockResolvedValueOnce(null);
    expect((await resendInvite("o1", "other-org-invite", "f@x.com")).ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();

    isEmailConfigured.mockReturnValue(false);
    expect((await resendInvite("o1", "i1", "f@x.com")).ok).toBe(false);
    expect(prisma.invite.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("revokeInvite", () => {
  it("only revokes pending invites in this org", async () => {
    prisma.invite.findFirst.mockResolvedValue(null);
    expect((await revokeInvite("o1", "i1", "f@x.com")).ok).toBe(false);
    prisma.invite.findFirst.mockResolvedValue({ id: "i1", email: "new@x.com" });
    prisma.invite.delete.mockResolvedValue({});
    expect((await revokeInvite("o1", "i1", "f@x.com")).ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.invite.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe("admin.invite_revoked");
  });
});
