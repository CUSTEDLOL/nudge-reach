export const NUDGE_ACCOUNT_ORIGIN_KEY = "nudge_account_origin";
export const INSTANT_TRIAL_ACCOUNT_ORIGIN = "instant_trial_v1";

export const INSTANT_TRIAL_APP_METADATA = Object.freeze({
  [NUDGE_ACCOUNT_ORIGIN_KEY]: INSTANT_TRIAL_ACCOUNT_ORIGIN,
});

/** True only for the immutable app_metadata stamp set by trial provisioning. */
export function hasInstantTrialProvenance(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return (raw as Record<string, unknown>)[NUDGE_ACCOUNT_ORIGIN_KEY]
    === INSTANT_TRIAL_ACCOUNT_ORIGIN;
}
