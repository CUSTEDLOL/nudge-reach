import crypto from "node:crypto";
import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Platform module: programmatic API keys (spec §M8).
 *
 * Keys look like `nk_live_<24 random chars>`. Only the sha256 hash is stored;
 * the full key is returned exactly once at creation. `prefix` keeps the first
 * few characters for display in tables ("nk_live_ab12…").
 *
 * `verifyApiKey()` is exported for the future public API (product 2 reuses
 * this module unchanged).
 */

export const API_KEY_PREFIX = "nk_live_";

const RANDOM_LENGTH = 24;
const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** `nk_live_` + 24 URL-safe random characters (crypto-strength). */
export function generateApiKey(): string {
  const bytes = crypto.randomBytes(RANDOM_LENGTH);
  let random = "";
  for (const byte of bytes) random += ALPHABET[byte % ALPHABET.length];
  return API_KEY_PREFIX + random;
}

/** Deterministic sha256 hex digest — the only thing persisted. */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Display prefix stored alongside the hash, e.g. "nk_live_ab12". */
export function displayPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + 4);
}

/**
 * Create a key for an org. Returns the full key (show it ONCE, never again)
 * plus the persisted row.
 */
export async function createApiKey(
  orgId: string,
  name: string
): Promise<{ key: string; apiKey: ApiKey }> {
  const key = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      orgId,
      name,
      prefix: displayPrefix(key),
      keyHash: hashApiKey(key),
    },
  });
  return { key, apiKey };
}

/**
 * Resolve a bearer key to its ApiKey row (org-scoped access for the future
 * public API). Returns null for unknown or revoked keys; touches lastUsedAt
 * on success.
 */
export async function verifyApiKey(key: string): Promise<ApiKey | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
  });
  if (!row || row.revokedAt) return null;
  return prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
}

/** Revoke (never delete — audit trail). Org-scoped; true if a key was revoked. */
export async function revokeApiKey(orgId: string, id: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
