import { prisma } from "@/lib/db";
import { crmPaymentPaid } from "@/modules/crm/events";
import { recordContactEvent } from "@/modules/contacts/events";
import { cancelWaitingRuns } from "@/modules/automation/engine";
import { env } from "@/lib/env";
import { sendModeFor, type SendMode } from "@/modules/orgs/mode";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { createRazorpayPaymentLink } from "@/modules/billing/razorpay";
import { getPaymentCredentials, type PaymentCredentials } from "@/modules/payments/connection";

/**
 * Customer-facing payment links (deposits, advances, bills) sent in chat by
 * the agent or staff. A LIVE workspace uses its OWN connected Razorpay
 * account, so the money lands with the business; with none connected it gets
 * no link at all. A test workspace gets a simulation link so the whole
 * collect-a-deposit story demos with zero keys (invariant #4).
 * Flagship-gated like booking: payments are an agent "real action".
 */

const MIN_AMOUNT_MINOR = 100; // ₹1.00
const MAX_AMOUNT_MINOR = 50_00_000; // ₹50,000 — sanity cap for a chat deposit

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
  }
): Promise<CreateLinkOutcome> {
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

  const mode: SendMode = sendModeFor(org);
  let credentials: PaymentCredentials | null = null;
  if (mode === "live") {
    // A LIVE workspace pays into its own account or not at all. Never the
    // hosted practice page (a fake checkout that marks itself paid) and never
    // Nudge's own billing account (the business's money would land with us).
    // The booking tool turns a refusal into "the team will share payment
    // details shortly".
    if (org.currency !== "INR") {
      return {
        status: "not_allowed",
        reason: `Online payments in ${org.currency} aren't available yet; Razorpay collects INR only.`,
      };
    }
    credentials = await getPaymentCredentials(orgId);
    if (!credentials) {
      return {
        status: "not_allowed",
        reason: "Online payments aren't switched on for this business yet (no Razorpay account connected).",
      };
    }
  }
  const currency = mode === "live" ? "INR" : org.currency === "USD" ? "USD" : "INR";
  const useRazorpay = credentials !== null;
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
        credentials: credentials ?? undefined,
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
/**
 * `orgId`, when given, scopes the update: a workspace's own webhook can only
 * settle that workspace's requests. A merchant controls their Razorpay
 * account's link notes, so without the scope one tenant could mark another's
 * deposit paid by quoting its id.
 */
export async function markPaymentPaid(paymentRequestId: string, orgId?: string): Promise<boolean> {
  const updated = await prisma.paymentRequest.updateMany({
    where: { id: paymentRequestId, status: "created", ...(orgId ? { orgId } : {}) },
    data: { status: "paid", paidAt: new Date() },
  });
  if (updated.count === 0) return false;

  const row = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { contact: { select: { phoneE164: true } } },
  });
  if (row) {
    recordContactEvent(row.orgId, "payment_paid", {
      contactId: row.contactId,
      props: {
        paymentRequestId: row.id,
        amountMinor: row.amountMinor,
        currency: row.currency,
      },
    });
    await cancelWaitingRuns(row.orgId, row.contactId, "payment");
    void crmPaymentPaid(
      row.orgId,
      { id: row.id, amountMinorUnits: row.amountMinor, currency: row.currency, purpose: row.purpose },
      { phoneE164: row.contact.phoneE164 }
    );
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
