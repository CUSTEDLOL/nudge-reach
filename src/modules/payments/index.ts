import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendModeFor, type SendMode } from "@/modules/orgs/mode";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import {
  createRazorpayPaymentLink,
  isRazorpayConfigured,
} from "@/modules/billing/razorpay";

/**
 * Customer-facing payment links (deposits, advances, bills) sent in chat by
 * the agent or staff. Real Razorpay Payment Links when SEND_MODE=live and keys
 * exist; otherwise a simulation link so the entire collect-a-deposit story
 * demos with zero keys (invariant #4). Mirrors the calendar module's driver
 * pattern. Flagship-gated like booking: payments are an agent "real action".
 */

const MIN_AMOUNT_MINOR = 100; // ₹1.00 (or USDC 1.00 on the usdc rail)
const MAX_AMOUNT_MINOR = 50_00_000; // ₹50,000 — sanity cap for a chat deposit

/**
 * Payment rails. "fiat" is the existing card/UPI path (Razorpay in live).
 * "usdc" collects the deposit on-chain in USDC via our hosted x402-style pay
 * page — built for cross-border customers whose cards decline. The live
 * settlement driver (AIsa) lands when sponsor API access is provisioned;
 * simulation serves the full flow today (invariant #4).
 */
export type PaymentRail = "fiat" | "usdc";

/** Simulated treasury address shown on the pay page in simulation mode. */
export const SIM_USDC_ADDRESS = "0x51mN0dGe000000000000000000000000000F4CED";
export const USDC_NETWORK = "base";

/**
 * Deterministic stand-in transaction hash for simulation receipts — clearly
 * labeled "simulated" wherever it is shown. Real hashes arrive with the live
 * settlement driver.
 */
export function simulatedTxHash(paymentRequestId: string): string {
  return `0x${createHash("sha256").update(paymentRequestId).digest("hex")}`;
}

function appBaseUrl(): string {
  return (
    (env as { NEXT_PUBLIC_APP_URL?: string }).NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export type CreateLinkOutcome =
  | { status: "created"; id: string; shortUrl: string; amountLabel: string }
  | { status: "not_allowed"; reason: string }
  | { status: "invalid"; reason: string };

function shouldUseRazorpay(mode: SendMode): boolean {
  return mode === "live" && isRazorpayConfigured();
}

export function formatAmountMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const formatted = major.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    maximumFractionDigits: 2,
  });
  return currency === "INR" ? `₹${formatted}` : `${currency} ${formatted}`;
}

/**
 * Create a payment link for a contact and record it. Never throws — returns a
 * discriminated outcome the agent tool (or a UI action) turns into a message.
 */
export async function createPaymentLink(
  orgId: string,
  input: {
    contactId: string;
    conversationId?: string;
    amountMinor: number;
    purpose: string;
    bookingRequestId?: string;
    rail?: PaymentRail;
  }
): Promise<CreateLinkOutcome> {
  const rail: PaymentRail = input.rail ?? "fiat";
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor < MIN_AMOUNT_MINOR ||
    input.amountMinor > MAX_AMOUNT_MINOR
  ) {
    return {
      status: "invalid",
      reason: `Amount must be between ${formatAmountMinor(
        MIN_AMOUNT_MINOR,
        "INR"
      )} and ${formatAmountMinor(MAX_AMOUNT_MINOR, "INR")}.`,
    };
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { plan: true, currency: true, simulated: true },
  });
  if (!org) return { status: "not_allowed", reason: "Org not found." };
  // Runtime flagship gate — same rule as calendar booking.
  if (!planHasAiFrontDesk(org.plan)) {
    return {
      status: "not_allowed",
      reason: "Payment collection is part of the AI Front Desk plan.",
    };
  }

  const currency =
    rail === "usdc" ? "USDC" : org.currency === "USD" ? "USD" : "INR";
  const useRazorpay = rail === "fiat" && shouldUseRazorpay(sendModeFor(org));
  const request = await prisma.paymentRequest.create({
    data: {
      orgId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      bookingRequestId: input.bookingRequestId,
      amountMinor: input.amountMinor,
      currency,
      purpose: input.purpose,
      provider: useRazorpay ? "razorpay" : "simulation",
      shortUrl: "", // filled below once the provider link exists
    },
  });

  let shortUrl: string;
  let providerLinkId: string | null = null;
  if (useRazorpay) {
    try {
      const link = await createRazorpayPaymentLink({
        amountMinor: input.amountMinor,
        currency,
        description: input.purpose,
        referenceId: request.id,
        notes: { orgId, paymentRequestId: request.id, kind: "customer_payment" },
      });
      shortUrl = link.short_url;
      providerLinkId = link.id;
    } catch (err) {
      // Provider down → don't strand a half-made row; surface a clean failure.
      await prisma.paymentRequest.delete({ where: { id: request.id } });
      return {
        status: "not_allowed",
        reason:
          err instanceof Error ? err.message : "Payment provider unavailable.",
      };
    }
  } else if (rail === "usdc") {
    // On-chain rail: our hosted x402-style pay page serves the payment
    // instructions (and, in simulation, settles the demo payment itself).
    shortUrl = `${appBaseUrl()}/pay/${request.id}`;
  } else {
    // Simulation: the hosted pay page settles it on click (and cron marks it
    // paid ~90s later regardless) so "deposit received" demos end-to-end.
    shortUrl = `${appBaseUrl()}/pay/${request.id}`;
  }

  await prisma.paymentRequest.update({
    where: { id: request.id },
    data: { shortUrl, providerLinkId },
  });

  return {
    status: "created",
    id: request.id,
    shortUrl,
    amountLabel: formatAmountMinor(input.amountMinor, currency),
  };
}

/** Webhook entry: mark a link paid (idempotent). Returns true if a row flipped. */
export async function markPaymentPaid(paymentRequestId: string): Promise<boolean> {
  const updated = await prisma.paymentRequest.updateMany({
    where: { id: paymentRequestId, status: "created" },
    data: { status: "paid", paidAt: new Date() },
  });
  if (updated.count === 0) return false;

  const row = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
  });
  if (row) {
    await prisma.note.create({
      data: {
        orgId: row.orgId,
        contactId: row.contactId,
        conversationId: row.conversationId,
        authorUserId: "system",
        authorName: "Payments",
        body: `Payment received: ${formatAmountMinor(
          row.amountMinor,
          row.currency
        )} — ${row.purpose}`,
      },
    });
  }
  return true;
}

/**
 * Simulation-mode progression (cron tick): links older than 90s get "paid",
 * mirroring applySimulatedProgress for campaign sends.
 */
export async function applySimulatedPaymentProgress(): Promise<number> {
  const cutoff = new Date(Date.now() - 90_000);
  const due = await prisma.paymentRequest.findMany({
    where: {
      provider: "simulation",
      status: "created",
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 50,
  });
  let flipped = 0;
  for (const row of due) {
    if (await markPaymentPaid(row.id)) flipped += 1;
  }
  return flipped;
}
