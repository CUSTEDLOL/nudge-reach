const MAX_GA_CLIENT_ID_LENGTH = 200;
const GA_CLIENT_ID_PATTERN = /^[0-9]+\.[0-9]+$/;

/** Accept only the numeric two-part client ID captured from Google's _ga cookie. */
export function isGaClientId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_GA_CLIENT_ID_LENGTH &&
    GA_CLIENT_ID_PATTERN.test(value)
  );
}
