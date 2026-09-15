import type { Currency } from "@/modules/billing/money";

/**
 * AI credit top-up packs (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 6). Pure and client-importable — no server imports — so the billing
 * page and the checkout button can share it. Packs are sold in INR (Razorpay)
 * and SGD (Stripe) only; every other currency shows "Contact us", matching
 * the stale-currency warning in plans.ts. Purchased credits expire after a
 * year and are spent soonest-expiring first (credits.ts).
 */

export const PURCHASED_CREDIT_TTL_DAYS = 365;

export const CREDIT_PACKS = [
  { id: "pack_1k", credits: 1_000, prices: { INR: 999, SGD: 19 } },
  { id: "pack_5k", credits: 5_000, prices: { INR: 4_499, SGD: 89 } },
  { id: "pack_10k", credits: 10_000, prices: { INR: 7_999, SGD: 169 } },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type CreditPackId = CreditPack["id"];
type SoldCurrency = keyof CreditPack["prices"];

export function creditPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/** Major-unit price in `currency`, or null when the pack is not sold there. */
export function packPrice(pack: CreditPack, currency: Currency): number | null {
  return currency in pack.prices ? pack.prices[currency as SoldCurrency] : null;
}

/** "1,000 AI credits" — the widget description, the confirm toast, the audit target. */
export function packLabel(pack: CreditPack): string {
  return `${pack.credits.toLocaleString("en-IN")} AI credits`;
}
