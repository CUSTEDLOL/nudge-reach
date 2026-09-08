import { beforeEach, describe, expect, it, vi } from "vitest";

/** Founder team controls: ownerless-org guard, transfer semantics, audit. */
const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    membership: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    org: { update: vi.fn() },
    invite: { delete: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      membership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
      org: { findUnique: vi.fn(), update: vi.fn() },
      invite: { findFirst: vi.fn(), delete: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma }));

import { removeMember, revokeInvite, setMemberRole, transferOwnership } from "@/modules/admin/team";

const owner = { id: "m1", userId: "u1", email: "owner@x.com", displayName: "Owner", role: "OWNER" };
const agent = { id: "m2", userId: "u2", email: "agent@x.com", displayName: null, role: "AGENT" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.membership.update.mockResolvedValue({});
  prisma.membership.updateMany.mockResolvedValue({});
  prisma.membership.delete.mockResolvedValue({});
  prisma.org.update.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});
  tx.membership.count.mockResolvedValue(2);
  tx.membership.update.mockResolvedValue({});
  tx.membership.updateMany.mockResolvedValue({});
  tx.membership.delete.mockResolvedValue({});
  tx.org.update.mockResolvedValue({});
  tx.invite.delete.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work) => work(tx));
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
