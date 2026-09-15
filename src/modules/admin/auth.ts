import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { env } from "@/lib/env";

/**
 * Founder admin panel gate (docs/plans/2026-09-05-admin-panel.md).
 *
 * /admin is platform-operator territory: the ONLY surface allowed to look
 * across orgs (src/modules/admin is the one cross-org module — everything
 * else in the repo stays tenant-scoped, invariant 5). Access is an env
 * allowlist checked server-side on EVERY page; with FOUNDER_EMAILS unset the
 * panel is off for everyone — it fails closed. Authentication uses a dedicated
 * /admin-scoped Supabase session so the normal app session stays untouched.
 */

/** Pure allowlist check — unit-tested; fails closed on empty/unset lists. */
export function isFounderEmail(
  email: string | undefined,
  allowlist: string | undefined
): boolean {
  if (!email || !allowlist) return false;
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return allowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}

export interface FounderContext {
  /** The founder's login email — used to attribute audit rows. */
  email: string;
}

/** Reads the isolated session without redirecting so /admin can show login. */
export async function getFounderContext(): Promise<FounderContext | null> {
  const supabase = await createAdminClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!isFounderEmail(email, env.FOUNDER_EMAILS)) return null;
  return { email: email!.trim().toLowerCase() };
}

/** Redirects unauthorized admin requests to the stable founder login entry. */
export async function requireFounder(): Promise<FounderContext> {
  const founder = await getFounderContext();
  if (!founder) redirect("/admin");
  return founder;
}
