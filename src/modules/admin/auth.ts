import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * Founder admin panel gate (docs/plans/2026-09-05-admin-panel.md).
 *
 * /admin is platform-operator territory: the ONLY surface allowed to look
 * across orgs (src/modules/admin is the one cross-org module — everything
 * else in the repo stays tenant-scoped, invariant 5). Access is an env
 * allowlist checked server-side on EVERY page; with FOUNDER_EMAILS unset the
 * panel is off for everyone — it fails closed. Outsiders get a plain 404 so
 * the panel's existence is not advertised.
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

/** 404s unless the signed-in user is on the FOUNDER_EMAILS allowlist. */
export async function requireFounder(): Promise<FounderContext> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!isFounderEmail(email, env.FOUNDER_EMAILS)) {
    notFound();
  }
  return { email: email!.trim().toLowerCase() };
}
