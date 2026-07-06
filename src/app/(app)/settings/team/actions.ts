"use server";

import { revalidatePath } from "next/cache";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkTeamLimit } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { appOrigin, isEmailConfigured, sendEmail } from "@/modules/email";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "AGENT"];

function isOrgRole(value: string): value is OrgRole {
  return (ROLES as string[]).includes(value);
}

/** Minimal HTML-entity escape for values interpolated into invite emails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    recordAudit(
      ctx,
      "member.role_changed",
      target.displayName || target.email,
      `${target.role} → ${role}`
    );

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

    // Plan limit: team seats (members + pending invites both hold a seat).
    const limit = await checkTeamLimit(ctx.org.id);
    if (!limit.allowed) return { ok: false, message: limit.message };

    await prisma.invite.upsert({
      where: { orgId_email: { orgId: ctx.org.id, email } },
      create: { orgId: ctx.org.id, email, role },
      update: { role, status: "pending" },
    });

    // Real invite email when Resend is configured; auto-join on signup works
    // either way, so a failed/skipped email never fails the invite itself.
    let emailNote = " They'll join automatically when they sign up with this email.";
    if (isEmailConfigured()) {
      const signupUrl = `${appOrigin()}/login`;
      const inviterName =
        ctx.membership.displayName || ctx.email || "A teammate";
      const result = await sendEmail({
        to: email,
        subject: `${inviterName} invited you to ${ctx.org.name} on Nudge`,
        text: [
          `${inviterName} invited you to join ${ctx.org.name} on Nudge`,
          `— the AI Front Desk they use to run their WhatsApp.`,
          ``,
          `Accept by signing up with this email address: ${signupUrl}`,
        ].join("\n"),
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#0b3d2e;margin:0 0 12px">You're invited to ${escapeHtml(ctx.org.name)}</h2>
            <p style="color:#374151;line-height:1.6;margin:0 0 20px">
              ${escapeHtml(inviterName)} invited you to join
              <strong>${escapeHtml(ctx.org.name)}</strong> on Nudge — the WhatsApp
              CRM they use for customer chats and campaigns. You'll join as
              <strong>${role.toLowerCase()}</strong>.
            </p>
            <a href="${signupUrl}" style="display:inline-block;background:#02a258;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
              Accept invite
            </a>
            <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
              Sign up with this email address (${escapeHtml(email)}) and you'll
              land in the workspace automatically.
            </p>
          </div>`,
      });
      emailNote = result.ok
        ? " An invite email is on its way."
        : " (The invite email couldn't be sent, but they'll still join automatically when they sign up with this email.)";
    }

    recordAudit(ctx, "member.invited", email, `as ${role.toLowerCase()}`);
    revalidatePath("/settings/team");
    return { ok: true, message: `Invited ${email}.${emailNote}` };
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
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, orgId: ctx.org.id },
      select: { email: true },
    });
    const result = await prisma.invite.deleteMany({
      where: { id: inviteId, orgId: ctx.org.id, status: "pending" },
    });
    if (result.count === 0) {
      return { ok: false, message: "That invite was already gone." };
    }
    recordAudit(ctx, "member.invite_revoked", invite?.email);

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
