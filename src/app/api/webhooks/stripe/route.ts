import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureIncludedGrantFor } from "@/modules/billing/credits";
import { verifyStripeWebhook } from "@/modules/billing/stripe";
import { getPlan } from "@/modules/billing/plans";

/**
 * Stripe webhook: source of truth for all non-INR subscriptions (mirrors the
 * Razorpay webhook for INR). Public route (under /api/webhooks, excluded
 * from the auth proxy); trust comes from the signature.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    data?: {
      object?: {
        metadata?: { orgId?: string; planId?: string };
        payment_status?: string;
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orgId = session?.metadata?.orgId;
    const planId = session?.metadata?.planId;
    if (orgId && planId && session?.payment_status === "paid") {
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
      // The new period's included AI credits (credit ledger); a redelivery
      // for the same period is a no-op.
      await ensureIncludedGrantFor(orgId);
    }
  }

  return NextResponse.json({ ok: true });
}
