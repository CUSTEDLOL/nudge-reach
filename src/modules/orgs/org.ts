import { Membership, Org, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Org resolution (spec §3.1). Membership is the source of truth for "which
 * org does this user work in":
 *
 *   1. an existing Membership wins;
 *   2. owners of pre-Membership orgs get an OWNER membership backfilled;
 *   3. a pending Invite matching the email is auto-accepted on first visit
 *      (no invite emails in the MVP — signup with the invited address joins);
 *   4. otherwise a fresh org + OWNER membership is created.
 *
 * Race-safe against the double-request on first load via P2002 retries.
 */

export interface ResolvedOrg {
  org: Org;
  membership: Membership;
}

/**
 * Prisma `org` relation filter: the caller OWNS the org OR holds a membership
 * in it. Single source of truth for org-scoping the lightweight polling routes
 * (campaign stats, template status) that skip a full `requireOrgContext()`.
 *
 * Owner-OR-member — the owner-only form silently 404'd the poll for non-owner
 * teammates (M1). Keep both routes on this helper so the tenant-scope can't
 * drift apart again.
 */
export function callerOrgFilter(userId: string): Prisma.OrgWhereInput {
  return {
    OR: [{ ownerUserId: userId }, { memberships: { some: { userId } } }],
  };
}

export async function resolveOrgContext(
  userId: string,
  email?: string
): Promise<ResolvedOrg> {
  // 1) Existing membership → its org.
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { org: true },
  });
  if (membership) {
    // Keep the stored email in sync with the auth claims (seeded/backfilled
    // rows may carry a placeholder). One-time write, then it converges.
    if (email && membership.email !== email) {
      const updated = await prisma.membership.update({
        where: { id: membership.id },
        data: { email },
      });
      return { org: membership.org, membership: updated };
    }
    const { org, ...rest } = membership;
    return { org, membership: rest };
  }

  // 2) Pre-existing org without a membership row (created before teams
  //    existed) → lazily backfill the OWNER membership.
  const ownedOrg = await prisma.org.findUnique({ where: { ownerUserId: userId } });
  if (ownedOrg) {
    const backfilled = await upsertMembership(ownedOrg.id, userId, {
      email: email ?? "",
      displayName: email ? email.split("@")[0] : null,
      role: "OWNER",
    });
    return { org: ownedOrg, membership: backfilled };
  }

  // 3) Pending invite matching this email → auto-accept.
  if (email) {
    const invite = await prisma.invite.findFirst({
      where: { email, status: "pending" },
      include: { org: true },
      orderBy: { createdAt: "asc" },
    });
    if (invite) {
      const joined = await upsertMembership(invite.orgId, userId, {
        email,
        displayName: email.split("@")[0],
        role: invite.role,
      });
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      });
      return { org: invite.org, membership: joined };
    }
  }

  // 4) First visit with no org anywhere → create org + OWNER membership.
  const name = email ? `${email.split("@")[0]}'s shop` : "My shop";
  try {
    const org = await prisma.org.create({
      data: {
        ownerUserId: userId,
        name,
        memberships: {
          create: {
            userId,
            email: email ?? "",
            displayName: email ? email.split("@")[0] : null,
            role: "OWNER",
          },
        },
      },
      include: { memberships: true },
    });
    const { memberships, ...orgRow } = org;
    return { org: orgRow, membership: memberships[0] };
  } catch (err) {
    // Unique violation: another concurrent request created it first.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return resolveOrgContext(userId, email);
    }
    throw err;
  }
}

/** Create-or-return a membership, safe against the concurrent first request. */
async function upsertMembership(
  orgId: string,
  userId: string,
  data: { email: string; displayName: string | null; role: Membership["role"] }
): Promise<Membership> {
  return prisma.membership.upsert({
    where: { orgId_userId: { orgId, userId } },
    create: { orgId, userId, ...data },
    update: {},
  });
}

/**
 * One org per user (PRD §3). Finds the signed-in user's org or creates it
 * on first visit. Kept for existing call sites; new role-aware code should
 * use `requireOrgContext()` from lib/auth instead.
 */
export async function ensureOrg(userId: string, email?: string): Promise<Org> {
  return (await resolveOrgContext(userId, email)).org;
}
