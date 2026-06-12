/**
 * Normalize a phone number to E.164. Indian-retail default: a bare
 * 10-digit number is assumed to be +91. Returns null when unusable.
 */
export function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  return null;
}
