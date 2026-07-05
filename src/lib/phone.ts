/**
 * Normalize a phone number to E.164, country-aware. A number that already
 * carries a country code (+…) is respected everywhere; bare local numbers
 * get the workspace's default dial code (org.dialCode, "+91" unless changed).
 * Returns null when unusable.
 *
 * The two-arg default preserves the original India-first behavior, so every
 * pre-globalization call site keeps working unchanged.
 */
export function normalizePhoneE164(
  raw: string,
  dialCode: string = "+91"
): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // Full international form always wins.
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;

  const cc = dialCode.replace(/[^\d]/g, ""); // "+971" → "971"
  if (!cc) return null;

  // "00"-prefixed international dialing (common outside the US).
  if (/^00\d{8,15}$/.test(cleaned)) {
    const rest = cleaned.slice(2);
    return /^\d{8,15}$/.test(rest) ? `+${rest}` : null;
  }

  // Number typed with its country code but no "+" (e.g. "919876543210").
  // The length guard (≥ 11 digits) keeps short bare locals that merely start
  // with the same digits (e.g. Indian mobiles beginning 91…) in the local
  // branch below.
  if (
    cleaned.startsWith(cc) &&
    cleaned.length >= 11 &&
    /^\d{8,15}$/.test(cleaned)
  ) {
    return `+${cleaned}`;
  }

  // Bare local number, optionally with a trunk "0" prefix (e.g. IN, AE, GB).
  const local = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
  if (/^\d{6,12}$/.test(local)) {
    const full = `${cc}${local}`;
    return full.length >= 8 && full.length <= 15 ? `+${full}` : null;
  }

  return null;
}
