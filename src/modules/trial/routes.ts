const TRIAL_WORKSPACE_PATHS = new Set([
  "/dashboard",
  "/trial/setup",
  "/agent",
  "/inbox/try",
  "/settings/billing",
]);

function cleanPath(pathname: string) {
  const clean = pathname.split(/[?#]/, 1)[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export function isTrialWorkspacePath(pathname: string) {
  const path = cleanPath(pathname);
  return TRIAL_WORKSPACE_PATHS.has(path);
}

export function trialWorkspaceRedirect(pathname: string) {
  const segment = cleanPath(pathname).split("/").filter(Boolean)[0] ?? "feature";
  return `/dashboard?upgrade=${encodeURIComponent(segment)}`;
}
