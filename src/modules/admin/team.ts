import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";

/**
 * Founder controls over an org's team. Same server-enforced rules as the
 * client's own Settings → Team (never leave an org ownerless), plus transfer
 * of ownership, which the client can't do for themselves. Every change is
 * audited in the org's log as founder:<email>.
 */

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "AGENT"];
export function isOrgRole(r: string): r is OrgRole {
  return (ROLES as string[]).includes(r);
}

export async function teamOverview(orgId: string) {
  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        role: true,
        whatsappAccountIds: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { orgId, status: "pending" },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invites };
}

async function loadMember(orgId: string, membershipId: string) {
  return prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { id: true, userId: true, email: true, displayName: true, role: true },
  });
}

async function ownerCount(orgId: string) {
  return prisma.membership.count({ where: { orgId, role: "OWNER" } });
}

const who = (m: { displayName: string | null; email: string }) => m.displayName || m.email;

export async function setMemberRole(
  orgId: string,
  membershipId: string,
  role: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  if (!isOrgRole(role)) return { ok: false, error: `Unknown role "${role}".` };
  const target = await loadMember(orgId, membershipId);
  if (!target) return { ok: false, error: "Member not found in this org." };
  if (target.role === role) return { ok: false, error: `Already ${role.toLowerCase()}.` };
  if (target.role === "OWNER" && (await ownerCount(orgId)) <= 1) {
    return { ok: false, error: "That is the last owner. Transfer ownership instead." };
  }
  const changed = await prisma.$transaction(async (tx) => {
    if (
      target.role === "OWNER" &&
      (await tx.membership.count({ where: { orgId, role: "OWNER" } })) <= 1
    ) {
      return false;
    }
    await tx.membership.update({ where: { id: target.id }, data: { role } });
    await founderAudit(
      orgId,
      founderEmail,
      "admin.member_role_changed",
      who(target),
      withReason(`${target.role} → ${role}`, reason),
      tx
    );
    return true;
  });
  if (!changed) {
    return { ok: false, error: "That is the last owner. Transfer ownership instead." };
  }
  return { ok: true, message: `${who(target)} is now ${role.toLowerCase()}.` };
}

export async function removeMember(
  orgId: string,
  membershipId: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const target = await loadMember(orgId, membershipId);
  if (!target) return { ok: false, error: "Member not found in this org." };
  if (target.role === "OWNER" && (await ownerCount(orgId)) <= 1) {
    return { ok: false, error: "That is the last owner. Transfer ownership first." };
  }
  const removed = await prisma.$transaction(async (tx) => {
    if (
      target.role === "OWNER" &&
      (await tx.membership.count({ where: { orgId, role: "OWNER" } })) <= 1
    ) {
      return false;
    }
    await tx.membership.delete({ where: { id: target.id } });
    await founderAudit(
      orgId,
      founderEmail,
      "admin.member_removed",
      who(target),
      withReason(`${target.email} (${target.role}) removed`, reason),
      tx
    );
    return true;
  });
  if (!removed) {
    return { ok: false, error: "That is the last owner. Transfer ownership first." };
  }
  return { ok: true, message: `${who(target)} removed.` };
}

/**
 * Make `membershipId` the owner: role OWNER + Org.ownerUserId; every other
 * OWNER steps down to ADMIN so there is exactly one accountable owner after.
 */
export async function transferOwnership(
  orgId: string,
  membershipId: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const target = await loadMember(orgId, membershipId);
  if (!target) return { ok: false, error: "Member not found in this org." };
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { ownerUserId: true, name: true } });
  if (!org) return { ok: false, error: "Org not found." };
  if (org.ownerUserId === target.userId && target.role === "OWNER") {
    return { ok: false, error: `${who(target)} already owns this workspace.` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: { orgId, role: "OWNER", NOT: { id: target.id } },
      data: { role: "ADMIN" },
    });
    await tx.membership.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.org.update({ where: { id: orgId }, data: { ownerUserId: target.userId } });
    await founderAudit(
      orgId,
      founderEmail,
      "admin.ownership_transferred",
      who(target),
      withReason(`ownership → ${target.email}; previous owners now admins`, reason),
      tx
    );
  });
  return { ok: true, message: `${who(target)} now owns ${org.name}.` };
}

export async function revokeInvite(
  orgId: string,
  inviteId: string,
  founderEmail: string
): Promise<FounderResult> {
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, orgId, status: "pending" },
    select: { id: true, email: true },
  });
  if (!invite) return { ok: false, error: "No pending invite with that id." };
  // Delete, as the client's own revoke does: (orgId, email) is unique, so a
  // lingering "revoked" row would block re-inviting the same address.
  await prisma.$transaction(async (tx) => {
    await tx.invite.delete({ where: { id: invite.id } });
    await founderAudit(
      orgId,
      founderEmail,
      "admin.invite_revoked",
      invite.email,
      null,
      tx
    );
  });
  return { ok: true, message: `Invite for ${invite.email} revoked.` };
}
