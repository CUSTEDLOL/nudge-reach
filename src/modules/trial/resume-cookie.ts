import { TRIAL_RESUME_COOKIE } from "./signup";

export function readTrialResumeToken(request: Request): string | undefined {
  const prefix = `${TRIAL_RESUME_COOKIE}=`;
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}
