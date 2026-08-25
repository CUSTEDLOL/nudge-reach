import { LoginClient } from "./login-client";

// /auth/* routes bounce here with ?error= when a link is stale or the code
// exchange fails — say so in plain words instead of a silent login page.
const ERROR_MESSAGES: Record<string, string> = {
  confirm:
    "That link has expired or was already used. Sign in — or sign up again to get a fresh one.",
  auth: "We couldn't finish signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginClient initialError={error ? (ERROR_MESSAGES[error] ?? null) : null} />;
}
