import { prisma } from "@/lib/db";
import { founderAudit } from "@/modules/admin/audit";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { PLANS } from "@/modules/billing/plans";
import { appOrigin, isEmailConfigured, sendEmail } from "@/modules/email";
import { PENDING_OWNER_PREFIX, pendingOwnerId } from "@/modules/orgs/pending-owner";

/**
 * Founder-created workspaces. The sales motion is demo-first: a client pays on
 * a call, we create their workspace here on the plan they bought, and invite
 * their email as OWNER. They set their own password on signup and land
 * straight in the paid workspace — we never see or send a password.
 *
 * The org is created before its owner exists, so `Org.ownerUserId` holds a
 * pending sentinel until they accept. `modules/orgs/org.ts` claims it on the
 * first sign-in (see `pending-owner.ts`).
 */

export interface CreateWorkspaceResult {
  ok: boolean;
  message: string;
  orgId?: string;
}

/** Plans a founder may put a new workspace on: everything except retired tiers. */
export function assignablePlans() {
  return PLANS.filter((p) => !p.legacy);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ownerInviteEmail(orgName: string, email: string) {
  const setupUrl = `${appOrigin()}/login`;
  return {
    to: email,
    subject: `Set up your Nudge workspace, ${orgName}`,
    text: [
      `Your Nudge workspace for ${orgName} is ready.`,
      "",
      `Create your password and sign in here: ${setupUrl}`,
      `Use this email address (${email}) — you'll land straight in your workspace.`,
      "",
      "Nudge is your AI Front Desk: it answers customers on WhatsApp, captures leads and, on your plan, books appointments and chases the ones who go quiet.",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0b3d2e;margin:0 0 12px">Your workspace is ready</h2>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px">
          We've set up <strong>${escapeHtml(orgName)}</strong> on Nudge. Choose a
          password to finish setting up your account and you'll land straight in
          your workspace.
        </p>
        <a href="${escapeHtml(setupUrl)}" style="display:inline-block;background:#02a258;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
          Set up your account
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
          Use this email address (${escapeHtml(email)}). We never send passwords —
          you choose your own.
        </p>
      </div>`,
  };
}

/**
 * Create a workspace on a paid plan and invite its owner. Refuses when the
 * email already belongs to a workspace: the invite would silently never apply,
 * because an existing membership is resolved before any pending invite.
 */
export async function createWorkspace(input: {
  name: string;
  countryCode: string;
  plan: string;
  ownerEmail: string;
  founderEmail: string;
}): Promise<CreateWorkspaceResult> {
  const name = input.name.trim();
  const email = input.ownerEmail.trim().toLowerCase();

  if (name.length < 2) {
    return { ok: false, message: "Enter the business name (at least 2 characters)." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid owner email address." };
  }
  const preset = COUNTRY_PRESETS.find((c) => c.code === input.countryCode);
  if (!preset) {
    return { ok: false, message: "Pick the country this business bills in." };
  }
  const plan = assignablePlans().find((p) => p.id === input.plan);
  if (!plan) {
    return { ok: false, message: "Pick a plan for this workspace." };
  }

  const existingMember = await prisma.membership.findFirst({
    where: { email },
    select: { org: { select: { id: true, name: true } } },
  });
  if (existingMember) {
    return {
      ok: false,
      message: `${email} already belongs to "${existingMember.org.name}". Invite them from that workspace's Team tab instead — a new invite would never apply.`,
    };
  }

  const pendingInvite = await prisma.invite.findFirst({
    where: { email, status: "pending" },
    select: { org: { select: { name: true } } },
  });
  if (pendingInvite) {
    return {
      ok: false,
      message: `${email} already has a pending invite to "${pendingInvite.org.name}". Revoke it first.`,
    };
  }

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.org.create({
      data: {
        name,
        ownerUserId: pendingOwnerId(),
        plan: plan.id,
        currency: preset.currency,
        dialCode: preset.dialCode,
        timezone: preset.timezone,
        // Test mode until they connect a real number — same rule as signup.
        simulated: true,
      },
      select: { id: true, name: true },
    });
    await tx.invite.create({
      data: { orgId: created.id, email, role: "OWNER" },
    });
    await founderAudit(
      created.id,
      input.founderEmail,
      "admin.workspace_created",
      created.name,
      `${plan.name} · owner ${email}`,
      tx
    );
    return created;
  });

  if (!isEmailConfigured()) {
    return {
      ok: true,
      orgId: org.id,
      message: `Created "${org.name}" on ${plan.name}. Email isn't configured, so send ${email} the sign-in link yourself — they'll land in this workspace.`,
    };
  }

  let delivered = false;
  try {
    delivered = (await sendEmail(ownerInviteEmail(org.name, email))).ok;
  } catch {
    delivered = false;
  }

  return {
    ok: true,
    orgId: org.id,
    message: delivered
      ? `Created "${org.name}" on ${plan.name}. A setup email is on its way to ${email}.`
      : `Created "${org.name}" on ${plan.name}. The setup email couldn't be sent — send ${email} the sign-in link yourself.`,
  };
}

export { PENDING_OWNER_PREFIX };
