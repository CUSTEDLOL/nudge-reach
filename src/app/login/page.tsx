import type { Metadata } from "next";
import { isSignupOpen } from "@/modules/orgs/signup";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// /auth/* routes bounce here with ?error= when a link is stale or the code
// exchange fails — say so in plain words instead of a silent login page.
const ERROR_MESSAGES: Record<string, string> = {
  confirm:
    "That link has expired or was already used. Ask us for a fresh invite, or sign in if you already set a password.",
  auth: "We couldn't finish signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  // Invite emails link to /login?invited=1: the owner has no account yet and
  // must be able to choose a password even while open signup is closed. This
  // only reveals the form — the server still refuses anyone without a pending
  // invite (resolveOrgContext → "nobody invited them and signup is closed").
  const arrivedByInvite = invited === "1";
  return (
    <LoginClient
      initialError={error ? (ERROR_MESSAGES[error] ?? null) : null}
      signupOpen={isSignupOpen() || arrivedByInvite}
      initialMode={arrivedByInvite ? "signup" : "signin"}
    />
  );
}
