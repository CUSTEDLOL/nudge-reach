const TRIAL_WORKSPACE_PATHS = new Set([
  "/dashboard",
  "/trial/setup",
  "/agent",
  "/inbox/try",
  "/explore",
  "/settings/billing",
]);

function cleanPath(pathname: string) {
  const clean = pathname.split(/[?#]/, 1)[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export function isTrialWorkspacePath(pathname: string) {
  return TRIAL_WORKSPACE_PATHS.has(cleanPath(pathname));
}

export function trialExploreRedirect(pathname: string) {
  const segment = cleanPath(pathname).split("/").filter(Boolean)[0] ?? "feature";
  return `/explore?feature=${encodeURIComponent(segment)}`;
}
