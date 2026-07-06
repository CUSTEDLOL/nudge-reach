"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/modules/orgs/audit";
import { getPlan, planPrice } from "@/modules/billing/plans";
import { formatPlanPrice, orgCurrency } from "@/modules/billing/money";
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
} from "@/modules/billing/razorpay";
import { createStripeCheckout, isStripeConfigured } from "@/modules/billing/stripe";
import { appOrigin } from "@/modules/email";

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
  /** Non-INR path — hosted Stripe Checkout; the browser redirects here. */
  redirectUrl?: string;
}

/**
 * Start a plan upgrade in the org's billing currency: INR → Razorpay widget,
 * anything else → hosted Stripe Checkout redirect in that local currency. Each path is gated on its own keys;
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

    if (currency !== "INR") {
      if (!isStripeConfigured()) {
        return {
          ok: false,
          message:
            "Payments aren't switched on yet — add your Stripe keys to enable checkout.",
        };
      }
      const base = appOrigin();
      const session = await createStripeCheckout({
        currency,
        amountMinor: planPrice(plan, currency) * 100,
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

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return { ok: false, message: "Payment couldn't be verified. Not charged twice — try again." };
    }

    // The signature only proves a payment for (orderId, paymentId) happened —
    // NOT which plan it was for. Never trust the client-supplied planId: derive
    // the plan from the order's server-set notes and verify it belongs to this
    // org and the captured amount matches the plan price. Otherwise a genuine
    // ₹999 payment could be redeemed for the ₹5,999 tier (payment-integrity).
    const order = await fetchRazorpayOrder(orderId);
    if (!order || order.status !== "paid") {
      return {
        ok: false,
        message:
          "We couldn't confirm the payment yet. If you were charged, your plan will activate shortly.",
      };
    }
    if (order.notes?.orgId !== ctx.org.id) {
      return { ok: false, message: "That payment isn't linked to your workspace." };
    }
    const plan = getPlan(order.notes?.planId ?? "");
    if (plan.id === "free" || order.amount !== planPrice(plan, "INR") * 100) {
      return {
        ok: false,
        message: "That payment doesn't match a plan — please contact support.",
      };
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
    recordAudit(
      ctx,
      "billing.plan_changed",
      plan.name,
      `${formatPlanPrice(planPrice(plan, orgCurrency(ctx.org)), orgCurrency(ctx.org))}/mo`
    );
    revalidatePath("/settings/billing");
    return { ok: true, message: `You're on ${plan.name} now — thank you!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't confirm the payment.",
    };
  }
}
