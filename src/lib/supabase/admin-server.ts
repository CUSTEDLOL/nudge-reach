import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminCookieOptions } from "@/lib/supabase/admin-cookie";

/** Supabase Auth client whose session is isolated to the founder portal. */
export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: adminCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies. The proxy refreshes the
            // admin session before protected pages run.
          }
        },
      },
    }
  );
}
