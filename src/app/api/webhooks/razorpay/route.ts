import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureIncludedGrantFor } from "@/modules/billing/credits";
import { GATEWAY_ACTOR, grantPurchasedCredits } from "@/modules/billing/credit-purchase";
import { verifyWebhookSignature } from "@/modules/billing/razorpay";
import { getPlan } from "@/modules/billing/plans";
import { markPaymentPaid } from "@/modules/payments";

/**
 * Razorpay server-to-server webhook: the source of truth for subscription
 * state (the client confirm action is just for instant UI). Verifies the
 * signature, then activates/downgrades the org's plan. Public route (excluded
 * from the auth proxy like the WhatsApp webhook); trust comes from the HMAC.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          notes?: { orgId?: string; planId?: string; kind?: string; packId?: string };
        };
      };
      payment_link?: {
        entity?: { notes?: { paymentRequestId?: string; kind?: string } };
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Customer-facing payment link (agent-sent deposit/advance) settled.
  if (payload.event === "payment_link.paid") {
    const linkNotes = payload.payload?.payment_link?.entity?.notes;
    if (linkNotes?.kind === "customer_payment" && linkNotes.paymentRequestId) {
      await markPaymentPaid(linkNotes.paymentRequestId);
    }
    return NextResponse.json({ ok: true });
  }

  const payment = payload.payload?.payment?.entity;
  const notes = payment?.notes;
  const orgId = notes?.orgId;

  // Credit-pack top-up (credit ledger): a purchase grant keyed on the payment
  // id, so a redelivery is a no-op. Never touches the plan.
  if (payload.event === "payment.captured" && notes?.kind === "credits") {
    if (orgId && notes.packId && payment?.id) {
      await grantPurchasedCredits({
        orgId,
        packId: notes.packId,
        sourceKey: payment.id,
        actor: GATEWAY_ACTOR.razorpay,
      });
    }
    return NextResponse.json({ ok: true });
  }

  const planId = notes?.planId;

  if (payload.event === "payment.captured" && orgId && planId) {
    const plan = getPlan(planId);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.org.updateMany({
      where: { id: orgId },
      data: {
        plan: plan.id,
        trialEndsAt: null,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
      },
    });
    // The new period's included AI credits (credit ledger); a redelivery or
    // the client confirm action issuing the same period is a no-op.
    await ensureIncludedGrantFor(orgId);
  }

  if (payload.event === "subscription.cancelled" && orgId) {
    await prisma.org.updateMany({
      where: { id: orgId },
      data: { subscriptionStatus: "cancelled" },
    });
  }

  return NextResponse.json({ ok: true });
}
