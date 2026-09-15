export const ADMIN_AUTH_COOKIE_NAME = "nudge-founder-auth";

/** Cookie settings shared by the admin server client and proxy refresh path. */
export function adminCookieOptions() {
  return {
    name: ADMIN_AUTH_COOKIE_NAME,
    path: "/admin",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
