import { prisma } from "@/lib/db";

/**
 * E4b per-number inbox access. A member with a non-empty
 * `Membership.whatsappAccountIds` sees only conversations on those numbers
 * (plus number-less conversations: sim, voice, pre-multi-number rows).
 * Owners/admins and members with an empty list are unrestricted (null).
 * Enforced server-side inside the inbox queries — not just hidden UI.
 */
export async function allowedNumberIds(
  orgId: string,
  userId: string
): Promise<string[] | null> {
  const membership = await prisma.membership.findFirst({
    where: { orgId, userId },
    select: { role: true, whatsappAccountIds: true },
  });
  // No membership row = the org owner (lazily backfilled) — unrestricted.
  if (!membership) return null;
  if (membership.role !== "AGENT") return null;
  return membership.whatsappAccountIds.length > 0
    ? membership.whatsappAccountIds
    : null;
}

/** Prisma clause for a restricted member; {} when unrestricted. */
export function numberAccessClause(allowed: string[] | null): {
  OR?: { whatsappAccountId: { in: string[] } | null }[];
} {
  if (!allowed) return {};
  return {
    OR: [{ whatsappAccountId: { in: allowed } }, { whatsappAccountId: null }],
  };
}
