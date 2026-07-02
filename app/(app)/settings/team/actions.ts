"use server";

import { revalidatePath } from "next/cache";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "AGENT"];

function isOrgRole(value: string): value is OrgRole {
  return (ROLES as string[]).includes(value);
}

export async function updateMemberRoleAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const membershipId = String(formData.get("membershipId") ?? "");
    const role = String(formData.get("role") ?? "");
    if (!membershipId || !isOrgRole(role)) {
      return { ok: false, message: "Pick a valid role." };
    }

    const target = await prisma.membership.findFirst({
      where: { id: membershipId, orgId: ctx.org.id },
    });
    if (!target) {
      return { ok: false, message: "That member wasn't found." };
    }
    if (target.role === role) {
      return { ok: true, message: "No change — role already set." };
    }

    // Only the owner may hand out or take away the OWNER role.
    if ((target.role === "OWNER" || role === "OWNER") && ctx.role !== "OWNER") {
      return {
        ok: false,
        message: "Only the workspace owner can change owner roles.",
      };
    }

    // Never leave the org ownerless (server-enforced).
    if (target.role === "OWNER" && role !== "OWNER") {
      const owners = await prisma.membership.count({
        where: { orgId: ctx.org.id, role: "OWNER" },
      });
      if (owners <= 1) {
        return {
          ok: false,
          message:
            "You can't demote the last owner. Promote someone else to owner first.",
        };
      }
    }

    await prisma.membership.update({
      where: { id: target.id },
      data: { role },
    });

    revalidatePath("/settings/team");
    return {
      ok: true,
      message: `${target.displayName || target.email || "Member"} is now ${role.toLowerCase()}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update the role.",
    };
  }
}

export async function inviteMemberAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "AGENT");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }
    if (role !== "ADMIN" && role !== "AGENT") {
      return { ok: false, message: "Invites can be admin or agent." };
    }

    const existingMember = await prisma.membership.findFirst({
      where: { orgId: ctx.org.id, email },
    });
    if (existingMember) {
      return { ok: false, message: `${email} is already on the team.` };
    }

    const existingInvite = await prisma.invite.findUnique({
      where: { orgId_email: { orgId: ctx.org.id, email } },
    });
    if (existingInvite?.status === "pending") {
      return { ok: false, message: `${email} already has a pending invite.` };
    }

    await prisma.invite.upsert({
      where: { orgId_email: { orgId: ctx.org.id, email } },
      create: { orgId: ctx.org.id, email, role },
      update: { role, status: "pending" },
    });

    revalidatePath("/settings/team");
    return {
      ok: true,
      message: `Invited ${email} — they'll join automatically when they sign up with this email.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't create the invite.",
    };
  }
}

export async function revokeInviteAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const inviteId = String(formData.get("inviteId") ?? "");
    const result = await prisma.invite.deleteMany({
      where: { id: inviteId, orgId: ctx.org.id, status: "pending" },
    });
    if (result.count === 0) {
      return { ok: false, message: "That invite was already gone." };
    }

    revalidatePath("/settings/team");
    return { ok: true, message: "Invite revoked." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't revoke the invite.",
    };
  }
}
