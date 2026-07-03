"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getPlan, planPrice } from "@/lib/billing/plans";
import { orgCurrency } from "@/lib/billing/money";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
} from "@/lib/billing/razorpay";
import { createStripeCheckout, isStripeConfigured } from "@/lib/billing/stripe";
import { appOrigin } from "@/lib/email";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface StartCheckoutResult extends ActionResult {
  /** INR path — hands the browser what the Razorpay widget needs. */
  checkout?: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    planId: string;
    planName: string;
  };
  /** USD path — hosted Stripe Checkout; the browser redirects here. */
  redirectUrl?: string;
}

/**
 * Start a plan upgrade in the org's billing currency: INR → Razorpay widget,
 * USD → hosted Stripe Checkout redirect. Each path is gated on its own keys;
 * the UI shows an "add keys" state when the relevant gateway is off.
 */
export async function startCheckoutAction(
  formData: FormData
): Promise<StartCheckoutResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const planId = String(formData.get("planId") ?? "");
    const plan = getPlan(planId);
    if (plan.id === "free") {
      return { ok: false, message: "Pick a paid plan to upgrade." };
    }

    const currency = orgCurrency(ctx.org);

    if (currency === "USD") {
      if (!isStripeConfigured()) {
        return {
          ok: false,
          message:
            "Payments aren't switched on yet — add your Stripe keys to enable USD checkout.",
        };
      }
      const base = appOrigin();
      const session = await createStripeCheckout({
        amountCents: planPrice(plan, "USD") * 100,
        planId: plan.id,
        planName: plan.name,
        orgId: ctx.org.id,
        orgName: ctx.org.name,
        successUrl: `${base}/settings/billing?upgraded=1`,
        cancelUrl: `${base}/settings/billing`,
      });
      return { ok: true, message: "Redirecting to Stripe…", redirectUrl: session.url };
    }

    if (!isRazorpayConfigured()) {
      return {
        ok: false,
        message:
          "Payments aren't switched on yet — add your Razorpay keys to enable checkout.",
      };
    }

    const order = await createRazorpayOrder(
      planPrice(plan, "INR") * 100,
      `plan_${plan.id}_${ctx.org.id}`.slice(0, 40),
      { orgId: ctx.org.id, planId: plan.id }
    );

    return {
      ok: true,
      message: "Checkout ready.",
      checkout: {
        keyId: razorpayKeyId()!,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
        planName: plan.name,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't start checkout.",
    };
  }
}

/**
 * Confirm a payment after the browser widget succeeds: verify the signature,
 * then activate the plan. (Razorpay also confirms server-to-server via the
 * webhook at /api/webhooks/razorpay — this gives instant UI feedback.)
 */
export async function confirmCheckoutAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const orderId = String(formData.get("razorpay_order_id") ?? "");
    const paymentId = String(formData.get("razorpay_payment_id") ?? "");
    const signature = String(formData.get("razorpay_signature") ?? "");
    const planId = String(formData.get("planId") ?? "");
    const plan = getPlan(planId);

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return { ok: false, message: "Payment couldn't be verified. Not charged twice — try again." };
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.org.update({
      where: { id: ctx.org.id },
      data: {
        plan: plan.id,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
      },
    });
    recordAudit(ctx, "billing.plan_changed", plan.name, `₹${plan.priceInr}/mo`);
    revalidatePath("/settings/billing");
    return { ok: true, message: `You're on ${plan.name} now — thank you!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't confirm the payment.",
    };
  }
}
