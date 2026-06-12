import { env } from "@/lib/env";

/**
 * Platform module: billing (stub — PRD §4: no real payments in MVP).
 * The interface is what product 2 will reuse; only cost estimation is
 * implemented for now.
 */

export interface CostEstimate {
  recipients: number;
  ratePerMessageMinorUnits: number; // paise
  totalMinorUnits: number; // paise
  currency: "INR";
  isEstimate: true;
}

export function getMarketingRateInr(): number {
  return env.WHATSAPP_MARKETING_RATE_INR ?? 0.99;
}

/** recipients × per-message marketing rate (PRD §8). Labelled an estimate. */
export function estimateCampaignCost(recipients: number): CostEstimate {
  const rateMinor = Math.round(getMarketingRateInr() * 100);
  return {
    recipients,
    ratePerMessageMinorUnits: rateMinor,
    totalMinorUnits: recipients * rateMinor,
    currency: "INR",
    isEstimate: true,
  };
}

export function formatInr(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

/** Stub for live-mode reconciliation from webhook pricing data (Phase 4+). */
export interface BillingLedger {
  recordActualCost(messageId: string, costMinorUnits: number): Promise<void>;
}
