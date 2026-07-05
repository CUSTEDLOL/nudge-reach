import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight auth for the inbox poll endpoints — verified Supabase claims +
 * the caller's org, with NO redirects and NO row creation (poll routes must
 * stay cheap; they run every ~3s). Membership lookup covers teammates; the
 * ownerUserId fallback covers owners whose membership hasn't been backfilled
 * yet (lib/org.ts does that lazily on page loads).
 */
export async function resolveApiOrg(): Promise<{
  orgId: string;
  userId: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: claims.sub },
    select: { orgId: true },
  });
  if (membership) return { orgId: membership.orgId, userId: claims.sub };

  const org = await prisma.org.findUnique({
    where: { ownerUserId: claims.sub },
    select: { id: true },
  });
  return org ? { orgId: org.id, userId: claims.sub } : null;
}
