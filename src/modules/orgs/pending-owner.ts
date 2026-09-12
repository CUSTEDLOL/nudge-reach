import { randomUUID } from "node:crypto";

/**
 * A workspace can be created by a founder before its owner has an account, so
 * `Org.ownerUserId` (required and unique) holds a sentinel until the invited
 * owner signs in for the first time and claims it.
 *
 * The prefix guarantees the value can never collide with a real Supabase user
 * id, which is a bare UUID.
 */
export const PENDING_OWNER_PREFIX = "pending-owner:";

export function pendingOwnerId(): string {
  return `${PENDING_OWNER_PREFIX}${randomUUID()}`;
}

export function isPendingOwner(ownerUserId: string): boolean {
  return ownerUserId.startsWith(PENDING_OWNER_PREFIX);
}
