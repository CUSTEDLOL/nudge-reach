import { NextResponse } from "next/server";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { exchangeCodeForTokens } from "@/modules/calendar/google";
import { saveCalendarAccount } from "@/modules/calendar";

/**
 * Google OAuth callback. The calendar attaches to the AUTHENTICATED caller's org
 * (from the session), never to a spoofable `state` param — so a crafted callback
 * can't connect an attacker's calendar to someone else's workspace. Flagship-gated.
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

  const code = searchParams.get("code");
  if (!code) return back("calendar=denied");

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens) return back("calendar=error");

  await saveCalendarAccount({
    orgId: ctx.org.id,
    accountEmail: tokens.email,
    refreshToken: tokens.refreshToken,
    simulated: false,
  });
  return back("calendar=connected");
}
