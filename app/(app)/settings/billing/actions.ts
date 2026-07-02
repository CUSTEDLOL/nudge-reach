"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
} from "@/lib/billing/razorpay";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface StartCheckoutResult extends ActionResult {
  /** Present on success — hands the browser what Razorpay Checkout needs. */
  checkout?: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    planId: string;
    planName: string;
  };
}

/**
 * Start a plan upgrade: creates a Razorpay order server-side and returns what
 * the browser checkout widget needs. Gated on Razorpay keys — with none, the
 * UI never calls this (shows an "add keys" state instead).
 */
export async function startCheckoutAction(
  formData: FormData
): Promise<StartCheckoutResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    if (!isRazorpayConfigured()) {
      return {
        ok: false,
        message:
          "Payments aren't switched on yet — add your Razorpay keys to enable checkout.",
      };
    }

    const planId = String(formData.get("planId") ?? "");
    const plan = getPlan(planId);
    if (plan.id === "free") {
      return { ok: false, message: "Pick a paid plan to upgrade." };
    }

    const order = await createRazorpayOrder(
      plan.priceInr * 100,
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
    revalidatePath("/settings/billing");
    return { ok: true, message: `You're on ${plan.name} now — thank you!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't confirm the payment.",
    };
  }
}
