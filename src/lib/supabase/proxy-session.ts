import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/" (exact match, handled below): the public marketing homepage. Kept out of
//   this prefix list so a stray "/" wouldn't make every route public.
// /api/webhooks: Meta calls it (signature-verified, not cookie-auth'd).
// /api/cron: queue tick (no session; safe — it only advances queued work).
// /api/waitlist: public signup endpoint for the homepage lead form (demo/waitlist).
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/waitlist",
  "/api/access",
  // customer-facing hosted payment page + its x402 machine endpoint
  "/pay",
  "/api/pay",
  // one-click guest sandbox (signs the visitor in itself)
  "/demo",
  // public marketing pages split off the landing page
  "/pricing",
  "/faq",
  "/privacy",
  "/terms",
  // SEO artifacts served by the app router
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
  "/icon.svg",
];

/**
 * Refreshes the Supabase auth token on every matched request and redirects
 * signed-out visitors to /login. Pages still verify auth themselves with
 * getClaims() — the proxy is convenience, not the security boundary.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getClaims() —
  // it can cause hard-to-debug session bugs (per Supabase SSR docs).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
