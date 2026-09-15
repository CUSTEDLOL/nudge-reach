import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureIncludedGrantFor } from "@/modules/billing/credits";
import { GATEWAY_ACTOR, grantPurchasedCredits } from "@/modules/billing/credit-purchase";
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
        id?: string;
        metadata?: { orgId?: string; planId?: string; kind?: string; packId?: string };
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
    const meta = session?.metadata;
    // Credit-pack top-up (credit ledger): a purchase grant keyed on the
    // session id, so a redelivery is a no-op. Never touches the plan.
    if (meta?.kind === "credits") {
      if (meta.orgId && meta.packId && session?.id && session.payment_status === "paid") {
        await grantPurchasedCredits({
          orgId: meta.orgId,
          packId: meta.packId,
          sourceKey: session.id,
          actor: GATEWAY_ACTOR.stripe,
        });
      }
      return NextResponse.json({ ok: true });
    }
    const orgId = meta?.orgId;
    const planId = meta?.planId;
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
