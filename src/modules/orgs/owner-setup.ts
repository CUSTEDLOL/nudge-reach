import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

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

