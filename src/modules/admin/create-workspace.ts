import { prisma } from "@/lib/db";
import { founderAudit } from "@/modules/admin/audit";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { PLANS } from "@/modules/billing/plans";
import { appOrigin, isEmailConfigured, sendEmail } from "@/modules/email";
import { ownerSetupEmail } from "@/modules/admin/owner-setup-email";
import {
  createOwnerSetupToken,
  type OwnerSetupLink,
} from "@/modules/orgs/owner-setup";
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
  setupLink?: OwnerSetupLink;
}

/** Plans a founder may put a new workspace on: everything except retired tiers. */
export function assignablePlans() {
  return PLANS.filter((p) => !p.legacy);
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

  const issued = createOwnerSetupToken();

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
      data: {
        orgId: created.id,
        email,
        role: "OWNER",
        setupTokenHash: issued.hash,
        setupTokenExpiresAt: issued.expiresAt,
      },
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
  const setupLink: OwnerSetupLink = {
    url: `${appOrigin().replace(/\/$/, "")}/invite/${issued.token}`,
    email,
    expiresAt: issued.expiresAt.toISOString(),
  };

  if (!isEmailConfigured()) {
    return {
      ok: true,
      orgId: org.id,
      setupLink,
      message: `Created "${org.name}" on ${plan.name}. Copy the 7-day setup link and send it to ${email}.`,
    };
  }

  let delivered = false;
  try {
    delivered = (await sendEmail(ownerSetupEmail(org.name, email, setupLink.url))).ok;
  } catch {
    delivered = false;
  }

  return {
    ok: true,
    orgId: org.id,
    setupLink,
    message: delivered
      ? `Created "${org.name}" on ${plan.name}. A setup email is on its way to ${email}.`
      : `Created "${org.name}" on ${plan.name}. The setup email couldn't be sent — send ${email} the sign-in link yourself.`,
  };
}

export { PENDING_OWNER_PREFIX };
