import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";
import { confirmationMatches, requireReason } from "@/modules/admin/confirmation";
import { checkTeamLimit } from "@/modules/billing/limits";
import { appOrigin, isEmailConfigured, sendEmail } from "@/modules/email";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inviteEmail(orgName: string, email: string, role: "ADMIN" | "AGENT") {
  const signupUrl = `${appOrigin()}/login`;
  return {
    to: email,
    subject: `You're invited to ${orgName} on Nudge`,
    text: [
      `Nudge support invited you to join ${orgName} as ${role.toLowerCase()}.`,
      "Nudge is the AI Front Desk that books customers, follows up with quiet leads, and helps run the business front desk.",
      "",
      `Accept by signing up with this email address: ${signupUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0b3d2e;margin:0 0 12px">You're invited to ${escapeHtml(orgName)}</h2>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px">
          Nudge support invited you to join <strong>${escapeHtml(orgName)}</strong>
          as <strong>${escapeHtml(role.toLowerCase())}</strong>. Nudge is the AI Front Desk
          that books customers, follows up with quiet leads, and helps run the
          business front desk.
        </p>
        <a href="${escapeHtml(signupUrl)}" style="display:inline-block;background:#02a258;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
          Accept invite
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
          Sign up with this email address (${escapeHtml(email)}) and you'll land
          in the workspace automatically.
        </p>
      </div>`,
  };
}

async function recordInviteDelivery(
  orgId: string,
  founderEmail: string,
  email: string,
  detail: string
): Promise<void> {
  try {
    await founderAudit(
      orgId,
      founderEmail,
      "admin.invite_delivery",
      email,
      detail
    );
  } catch {
    // The invite is already committed. A telemetry failure must not make the
    // UI claim that the valid invite was rolled back.
  }
}

export async function inviteMember(
  orgId: string,
  rawEmail: string,
  role: string,
  founderEmail: string
): Promise<FounderResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (role !== "ADMIN" && role !== "AGENT") {
    return { ok: false, error: "Invites can be admin or agent." };
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) return { ok: false, error: "Org not found." };

  const existingMember = await prisma.membership.findFirst({
    where: { orgId, email },
  });
  if (existingMember) {
    return { ok: false, error: `${email} is already on the team.` };
  }

  const existingInvite = await prisma.invite.findUnique({
    where: { orgId_email: { orgId, email } },
  });
  if (existingInvite?.status === "pending") {
    return { ok: false, error: `${email} already has a pending invite.` };
  }

  const limit = await checkTeamLimit(orgId);
  if (!limit.allowed) return { ok: false, error: limit.message };

  await prisma.$transaction(async (tx) => {
    await tx.invite.upsert({
      where: { orgId_email: { orgId, email } },
      create: { orgId, email, role },
      update: { role, status: "pending" },
    });
    await founderAudit(
      orgId,
      founderEmail,
      "admin.invite_created",
      email,
      `as ${role.toLowerCase()}`,
      tx
    );
  });

  if (!isEmailConfigured()) {
    await recordInviteDelivery(
      orgId,
      founderEmail,
      email,
      "initial: skipped (email not configured)"
    );
    return {
      ok: true,
      message: `Invited ${email}. They'll join automatically when they sign up with this email.`,
    };
  }

  let delivery: Awaited<ReturnType<typeof sendEmail>>;
  try {
    delivery = await sendEmail(inviteEmail(org.name, email, role));
  } catch {
    delivery = { ok: false };
  }
  await recordInviteDelivery(
    orgId,
    founderEmail,
    email,
    `initial: ${delivery.ok ? "sent" : "failed"}`
  );

  return {
    ok: true,
    message: delivery.ok
      ? `Invited ${email}. An invite email is on its way.`
      : `Invited ${email}. The invite email couldn't be sent, but they'll still join automatically when they sign up with this email.`,
  };
}

export async function resendInvite(
  orgId: string,
  inviteId: string,
  founderEmail: string
): Promise<FounderResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Email delivery is not configured. The pending invite will still auto-accept on signup.",
    };
  }
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, orgId, status: "pending" },
    select: {
      id: true,
      email: true,
      role: true,
      org: { select: { name: true } },
    },
  });
  if (!invite) return { ok: false, error: "No pending invite with that id." };
  if (invite.role !== "ADMIN" && invite.role !== "AGENT") {
    return { ok: false, error: "Only admin or agent invites can be resent." };
  }

  let delivery: Awaited<ReturnType<typeof sendEmail>>;
  try {
    delivery = await sendEmail(
      inviteEmail(invite.org.name, invite.email, invite.role)
    );
  } catch {
    delivery = { ok: false };
  }
  await recordInviteDelivery(
    orgId,
    founderEmail,
    invite.email,
    `resent: ${delivery.ok ? "sent" : "failed"}`
  );
  return delivery.ok
    ? { ok: true, message: `Invite email resent to ${invite.email}.` }
    : {
        ok: false,
        error: "The invite remains pending, but its email couldn't be sent.",
      };
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
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const target = await loadMember(orgId, membershipId);
  if (!target) return { ok: false, error: "Member not found in this org." };
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { ownerUserId: true, name: true } });
  if (!org) return { ok: false, error: "Org not found." };
  if (org.ownerUserId === target.userId && target.role === "OWNER") {
    return { ok: false, error: `${who(target)} already owns this workspace.` };
  }
  if (!confirmationMatches(target.email, confirmation ?? "")) {
    return { ok: false, error: `Type "${target.email}" exactly to confirm.` };
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
      withReason(
        `ownership → ${target.email}; previous owners now admins`,
        requiredReason.value
      ),
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
