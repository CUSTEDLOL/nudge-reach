import { env } from "@/lib/env";

/**
 * Google OAuth glue (live mode only). Entirely env-gated — with no keys the app
 * runs calendar in simulation. Real functions throw if not configured, so no
 * live path can run half-set-up (same discipline as razorpay.ts / stripe.ts).
 */

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function requireConfig() {
  if (!isGoogleCalendarConfigured()) {
    throw new Error(
      "Google Calendar is not configured (missing GOOGLE_CLIENT_ID/SECRET)."
    );
  }
}

/** The consent-screen URL. `state` carries the org id back to the callback. */
export function googleAuthUrl(state: string): string {
  requireConfig();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
    response_type: "code",
    access_type: "offline", // we need a refresh token
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange the OAuth code for a refresh token + the connected account email. */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ refreshToken: string; accessToken: string; email: string } | null> {
  requireConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.access_token || !data.refresh_token) return null;

  let email = "google-calendar";
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (me.ok) email = ((await me.json()) as { email?: string }).email ?? email;
  } catch {
    // email is cosmetic; ignore lookup failures
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    email,
  };
}

/** Mint a short-lived access token from a stored refresh token. */
export async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  requireConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token refresh returned no token");
  return data.access_token;
}
