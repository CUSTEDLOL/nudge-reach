/**
 * Multi-currency money helpers (global outreach). Pure — no server imports —
 * so marketing pages and client components can share it.
 *
 * The product bills in the org's currency: INR via Razorpay, USD via Stripe.
 * WhatsApp per-message marketing rates differ by destination market, so each
 * currency carries a sensible default rate (Meta's actual billed price
 * arrives per message via the webhook in live mode and overrides estimates).
 */

export const CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

interface CurrencyInfo {
  symbol: string;
  locale: string; // number formatting locale
  /** Default per-message WhatsApp marketing rate, in minor units. */
  defaultMessageRateMinor: number;
  gateway: "razorpay" | "stripe";
}

export const CURRENCY_INFO: Record<Currency, CurrencyInfo> = {
  INR: {
    symbol: "₹",
    locale: "en-IN",
    defaultMessageRateMinor: 99, // ₹0.99 — verify against Meta's rate card
    gateway: "razorpay",
  },
  USD: {
    symbol: "$",
    locale: "en-US",
    defaultMessageRateMinor: 3, // $0.03 — varies by destination country
    gateway: "stripe",
  },
};

/** "₹1,234.50" / "$12.30" from minor units. */
export function formatMoney(minorUnits: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  const major = minorUnits / 100;
  return `${info.symbol}${major.toLocaleString(info.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-major-unit price display: "₹2,499" / "$69". */
export function formatPlanPrice(major: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  return `${info.symbol}${major.toLocaleString(info.locale)}`;
}

/** Org-level currency with a safe fallback for any stored value. */
export function orgCurrency(org: { currency: string }): Currency {
  return isCurrency(org.currency) ? org.currency : "INR";
}

/**
 * Countries offered at onboarding / settings. Picking one sets the org's
 * dial code, billing currency and timezone in one step (each still
 * individually adjustable later).
 */
export const COUNTRY_PRESETS = [
  { code: "IN", label: "India", dialCode: "+91", currency: "INR" as Currency, timezone: "Asia/Kolkata" },
  { code: "AE", label: "UAE", dialCode: "+971", currency: "USD" as Currency, timezone: "Asia/Dubai" },
  { code: "SA", label: "Saudi Arabia", dialCode: "+966", currency: "USD" as Currency, timezone: "Asia/Riyadh" },
  { code: "SG", label: "Singapore", dialCode: "+65", currency: "USD" as Currency, timezone: "Asia/Singapore" },
  { code: "ID", label: "Indonesia", dialCode: "+62", currency: "USD" as Currency, timezone: "Asia/Jakarta" },
  { code: "BR", label: "Brazil", dialCode: "+55", currency: "USD" as Currency, timezone: "America/Sao_Paulo" },
  { code: "MX", label: "Mexico", dialCode: "+52", currency: "USD" as Currency, timezone: "America/Mexico_City" },
  { code: "GB", label: "United Kingdom", dialCode: "+44", currency: "USD" as Currency, timezone: "Europe/London" },
  { code: "US", label: "United States", dialCode: "+1", currency: "USD" as Currency, timezone: "America/New_York" },
  { code: "OTHER", label: "Other", dialCode: "+", currency: "USD" as Currency, timezone: "UTC" },
] as const;

export function presetForDialCode(dialCode: string) {
  return COUNTRY_PRESETS.find((p) => p.dialCode === dialCode) ?? null;
}
