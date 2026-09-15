import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PENDING_OWNER_PREFIX } from "@/modules/orgs/pending-owner";

export const OWNER_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface OwnerSetupToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

/** Issue a bearer token; callers persist only the hash and return the raw value once. */
export function createOwnerSetupToken(now = new Date()): OwnerSetupToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashOwnerSetupToken(token),
    expiresAt: new Date(now.getTime() + OWNER_SETUP_TTL_MS),
  };
}

export function hashOwnerSetupToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function validateOwnerPassword(
  password: string,
  confirmation: string
): string | null {
  if (!password) return "Enter a password.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}

/** Public-safe invite view. All invalid states intentionally collapse to null. */
export async function findValidOwnerSetupInvite(token: string, now = new Date()) {
  return prisma.invite.findFirst({
    where: {
      setupTokenHash: hashOwnerSetupToken(token),
      setupTokenExpiresAt: { gt: now },
      status: "pending",
      role: "OWNER",
    },
    select: {
      id: true,
      email: true,
      setupTokenExpiresAt: true,
      org: { select: { id: true, name: true } },
    },
  });
}

type OwnerSetupFailureCode =
  | "invalid"
  | "existing_account"
  | "unavailable"
  | "failed";

export type CompleteOwnerSetupResult =
  | { ok: true; email: string; orgId: string }
  | { ok: false; code: OwnerSetupFailureCode; message: string };

const INVALID_LINK =
  "This setup link is invalid, expired, or already used. Ask Nudge for a new link.";

class SetupLinkConsumedError extends Error {}

function isExistingAccountError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "email_exists" ||
    error.code === "email_address_exists" ||
    error.code === "user_already_exists" ||
    Boolean(error.message?.toLowerCase().includes("already registered"))
  );
}

/**
 * Create the invited owner in Supabase Auth and consume exactly one matching
 * invite. Existing accounts are never updated: they use the normal sign-in
 * path, whose org resolver accepts the pending invite by email.
 */
export async function completeOwnerSetup(
  token: string,
  password: string,
  now = new Date()
): Promise<CompleteOwnerSetupResult> {
  const invite = await findValidOwnerSetupInvite(token, now);
  if (!invite) return { ok: false, code: "invalid", message: INVALID_LINK };

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Account setup is temporarily unavailable. Please ask Nudge for help.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error && isExistingAccountError(error)) {
      return {
        ok: false,
        code: "existing_account",
        message: "An account already exists for this email. Sign in to accept the workspace invite.",
      };
    }
    return {
      ok: false,
      code: "failed",
      message: "We couldn't create the account. Check the password and try again.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          setupTokenHash: hashOwnerSetupToken(token),
          setupTokenExpiresAt: { gt: now },
          status: "pending",
          role: "OWNER",
        },
        data: {
          status: "accepted",
          setupTokenHash: null,
          setupTokenExpiresAt: null,
        },
      });
      if (consumed.count !== 1) throw new SetupLinkConsumedError();

      await tx.membership.upsert({
        where: {
          orgId_userId: { orgId: invite.org.id, userId: data.user.id },
        },
        create: {
          orgId: invite.org.id,
          userId: data.user.id,
          email: invite.email,
          displayName: invite.email.split("@")[0],
          role: "OWNER",
        },
        update: {},
      });
      await tx.org.updateMany({
        where: {
          id: invite.org.id,
          ownerUserId: { startsWith: PENDING_OWNER_PREFIX },
        },
        data: { ownerUserId: data.user.id },
      });
    });
  } catch (error) {
    if (error instanceof SetupLinkConsumedError) {
      return { ok: false, code: "invalid", message: INVALID_LINK };
    }
    return {
      ok: false,
      code: "failed",
      message: "Your account was created, but setup could not finish. Sign in to continue.",
    };
  }

  return { ok: true, email: invite.email, orgId: invite.org.id };
}
