import { cache } from "react";
import { redirect } from "next/navigation";
import type { Membership, Org, OrgRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgContext } from "@/lib/org";

/** Everything a role-aware page/action needs about the caller (spec §3.1). */
export interface OrgContext {
  org: Org;
  membership: Membership;
  role: OrgRole;
  userId: string;
  email: string;
}

/**
 * Server-side auth helper: verified claims + the caller's org, membership and
 * role, or redirect to /login. React-`cache()`d — at most one resolution per
 * request no matter how many components call it.
 */
export const requireOrgContext = cache(async (): Promise<OrgContext> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }
  const email = claims.email as string | undefined;
  const { org, membership } = await resolveOrgContext(claims.sub, email);
  return {
    org,
    membership,
    role: membership.role,
    userId: claims.sub,
    email: email ?? membership.email,
  };
});

/**
 * Server-side auth helper: verified claims + the caller's org, or redirect.
 * Unchanged signature — role-aware code should use `requireOrgContext()`.
 */
export async function requireOrg(): Promise<Org> {
  return (await requireOrgContext()).org;
}

/** OWNER outranks ADMIN outranks AGENT. */
const ROLE_ORDER: Record<OrgRole, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };

const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: "the workspace owner",
  ADMIN: "an admin",
  AGENT: "an agent",
};

/** Pure role comparison: does `role` meet or exceed `minRole`? */
export function hasRole(role: OrgRole, minRole: OrgRole): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[minRole];
}

/**
 * Gate a mutation on a minimum role. Throws an Error whose message is safe
 * to surface to the user (catch it in the action and return { ok:false }).
 */
export function requireRole(ctx: OrgContext, minRole: OrgRole): void {
  if (!hasRole(ctx.role, minRole)) {
    throw new Error(
      `Only ${ROLE_LABEL[minRole]} or above can do this. Ask your workspace owner for access.`
    );
  }
}
