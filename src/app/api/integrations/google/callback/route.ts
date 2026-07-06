import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { exchangeCodeForTokens } from "@/modules/calendar/google";
import { saveCalendarAccount } from "@/modules/calendar";

/**
 * Google OAuth callback. Two guards: (1) the `state` must match the per-session
 * nonce set at connect time — CSRF / code-injection protection; (2) the calendar
 * attaches to the AUTHENTICATED caller's org (from the session), never to a
 * client-supplied target. ADMIN + flagship gated.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(`${origin}/integrations?${q}`);

  const ctx = await requireOrgContext(); // redirects to /login if unauthenticated
  try {
    requireRole(ctx, "ADMIN");
  } catch {
    return back("calendar=forbidden");
  }
  const gate = await checkAiFrontDesk(ctx.org.id);
  if (!gate.allowed) return back("calendar=upgrade");

  // CSRF: reject unless `state` matches the nonce set on the connect click.
  const expected = (await cookies()).get("gcal_oauth_state")?.value;
  const got = searchParams.get("state");
  if (!expected || !got || expected !== got) return back("calendar=error");

  const code = searchParams.get("code");
  if (!code) return back("calendar=denied");

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return back("calendar=error");
  }
  if (!tokens) return back("calendar=error");

  await saveCalendarAccount({
    orgId: ctx.org.id,
    accountEmail: tokens.email,
    refreshToken: tokens.refreshToken,
    simulated: false,
  });
  const res = back("calendar=connected");
  res.cookies.set("gcal_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
