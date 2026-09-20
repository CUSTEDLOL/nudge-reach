const TRIAL_WORKSPACE_PATHS = new Set([
  "/dashboard",
  "/trial/setup",
  "/agent",
  "/inbox/try",
  "/explore",
  "/settings/billing",
]);
const TRIAL_INBOX_THREAD_PATH = /^\/inbox\/[A-Za-z0-9_-]{1,191}$/;

function cleanPath(pathname: string) {
  const clean = pathname.split(/[?#]/, 1)[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export function isTrialWorkspacePath(pathname: string) {
  const path = cleanPath(pathname);
  return TRIAL_WORKSPACE_PATHS.has(path) || TRIAL_INBOX_THREAD_PATH.test(path);
}

export function trialExploreRedirect(pathname: string) {
  const segment = cleanPath(pathname).split("/").filter(Boolean)[0] ?? "feature";
  return `/explore?feature=${encodeURIComponent(segment)}`;
}
