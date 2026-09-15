import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client for server-only account provisioning.
 * Constructed only when the owner submits a valid setup link, so simulation
 * mode and builds remain keyless.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Owner setup is not configured.");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
