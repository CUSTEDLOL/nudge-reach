import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrg } from "@/lib/org";

/** Server-side auth helper: verified claims + the caller's org, or redirect. */
export async function requireOrg() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }
  return ensureOrg(claims.sub, claims.email as string | undefined);
}
