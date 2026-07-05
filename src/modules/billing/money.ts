/**
 * Multi-currency money helpers (global outreach). Pure — no server imports —
 * so marketing pages and client components can share it.
 *
 * Every market bills in its LOCAL currency: INR via Razorpay, everything else
 * via Stripe (which supports all currencies below). WhatsApp per-message
 * marketing rates differ by destination market, so each currency carries an
 * estimated default rate — Meta's actual billed price arrives per message via
 * the webhook in live mode and overrides estimates.
 */

export const CURRENCIES = [
  "INR",
  "USD",
  "AED",
  "SAR",
  "SGD",
  "IDR",
  "BRL",
  "MXN",
  "GBP",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

interface CurrencyInfo {
  symbol: string;
  locale: string; // number formatting locale
  /**
   * Estimated per-message WhatsApp MARKETING rate, in minor units (approx
   * Meta rate card for the home market; founder-tunable, estimates only).
   */
  defaultMessageRateMinor: number;
  gateway: "razorpay" | "stripe";
}

export const CURRENCY_INFO: Record<Currency, CurrencyInfo> = {
  INR: { symbol: "₹", locale: "en-IN", defaultMessageRateMinor: 99, gateway: "razorpay" },
  USD: { symbol: "$", locale: "en-US", defaultMessageRateMinor: 3, gateway: "stripe" },
  AED: { symbol: "AED ", locale: "en-AE", defaultMessageRateMinor: 13, gateway: "stripe" },
  SAR: { symbol: "SAR ", locale: "en-SA", defaultMessageRateMinor: 17, gateway: "stripe" },
  SGD: { symbol: "S$", locale: "en-SG", defaultMessageRateMinor: 10, gateway: "stripe" },
  IDR: { symbol: "Rp ", locale: "id-ID", defaultMessageRateMinor: 55_000, gateway: "stripe" },
  BRL: { symbol: "R$", locale: "pt-BR", defaultMessageRateMinor: 31, gateway: "stripe" },
  MXN: { symbol: "MX$", locale: "es-MX", defaultMessageRateMinor: 74, gateway: "stripe" },
  GBP: { symbol: "£", locale: "en-GB", defaultMessageRateMinor: 4, gateway: "stripe" },
};

/** Which payment gateway bills this currency. */
export function gatewayFor(currency: Currency): "razorpay" | "stripe" {
  return CURRENCY_INFO[currency].gateway;
}

/** "₹1,234.50" / "$12.30" / "Rp 550,00" from minor units. */
export function formatMoney(minorUnits: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  const major = minorUnits / 100;
  return `${info.symbol}${major.toLocaleString(info.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-major-unit price display: "₹2,499" / "$69" / "Rp 1.099.000". */
export function formatPlanPrice(major: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  return `${info.symbol}${major.toLocaleString(info.locale)}`;
}

/** Org-level currency with a safe fallback for any stored value. */
export function orgCurrency(org: { currency: string }): Currency {
  return isCurrency(org.currency) ? org.currency : "INR";
}

/**
 * Countries offered at onboarding / settings — each bills in its LOCAL
 * currency. Picking one sets the org's dial code, billing currency and
 * timezone in one step (each still individually adjustable later).
 */
export const COUNTRY_PRESETS = [
  { code: "IN", label: "India", dialCode: "+91", currency: "INR" as Currency, timezone: "Asia/Kolkata" },
  { code: "AE", label: "UAE", dialCode: "+971", currency: "AED" as Currency, timezone: "Asia/Dubai" },
  { code: "SA", label: "Saudi Arabia", dialCode: "+966", currency: "SAR" as Currency, timezone: "Asia/Riyadh" },
  { code: "SG", label: "Singapore", dialCode: "+65", currency: "SGD" as Currency, timezone: "Asia/Singapore" },
  { code: "ID", label: "Indonesia", dialCode: "+62", currency: "IDR" as Currency, timezone: "Asia/Jakarta" },
  { code: "BR", label: "Brazil", dialCode: "+55", currency: "BRL" as Currency, timezone: "America/Sao_Paulo" },
  { code: "MX", label: "Mexico", dialCode: "+52", currency: "MXN" as Currency, timezone: "America/Mexico_City" },
  { code: "GB", label: "United Kingdom", dialCode: "+44", currency: "GBP" as Currency, timezone: "Europe/London" },
  { code: "US", label: "United States", dialCode: "+1", currency: "USD" as Currency, timezone: "America/New_York" },
  { code: "OTHER", label: "Other", dialCode: "+", currency: "USD" as Currency, timezone: "UTC" },
] as const;

export function presetForDialCode(dialCode: string) {
  return COUNTRY_PRESETS.find((p) => p.dialCode === dialCode) ?? null;
}
