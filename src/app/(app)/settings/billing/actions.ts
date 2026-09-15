"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/modules/orgs/audit";
import { ensureIncludedGrant } from "@/modules/billing/credits";
import { creditPack, packLabel, packPrice } from "@/modules/billing/credit-packs";
import { grantPurchasedCredits } from "@/modules/billing/credit-purchase";
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
    /** Shown in the widget: "Starter plan" / "1,000 AI credits". */
    description: string;
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
    if (plan.contactOnly) {
      return { ok: false, message: "Contact us to move to the Enterprise plan." };
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
        description: `${plan.name} plan`,
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
    const activated = await prisma.org.update({
      where: { id: ctx.org.id },
      data: {
        plan: plan.id,
        trialEndsAt: null,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
      },
    });
    // The new period's included AI credits (credit ledger); idempotent with
    // the webhook, which issues the same grant for the same period end.
    await ensureIncludedGrant(activated);
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

/**
 * Start a credit-pack top-up (credit ledger) in the org's billing currency:
 * INR → Razorpay widget, SGD → hosted Stripe Checkout; packs are not sold in
 * other currencies. Same gating as the plan checkout. A top-up never touches
 * the plan, the subscription status or the period end.
 */
export async function startCreditCheckoutAction(
  packId: string
): Promise<StartCheckoutResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const pack = creditPack(packId);
    if (!pack) return { ok: false, message: "That credit pack doesn't exist." };
    const currency = orgCurrency(ctx.org);
    const price = packPrice(pack, currency);
    if (price === null) {
      return {
        ok: false,
        message: `Credit packs aren't sold in ${currency} yet — contact us to top up.`,
      };
    }

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
        amountMinor: price * 100,
        orgId: ctx.org.id,
        orgName: ctx.org.name,
        lineName: `Nudge AI credits — ${pack.credits.toLocaleString("en-IN")} (${ctx.org.name})`,
        metadata: { orgId: ctx.org.id, kind: "credits", packId: pack.id },
        successUrl: `${base}/settings/billing?credits=1`,
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
      price * 100,
      `credits_${pack.id}_${ctx.org.id}`.slice(0, 40),
      { orgId: ctx.org.id, kind: "credits", packId: pack.id }
    );
    return {
      ok: true,
      message: "Checkout ready.",
      checkout: {
        keyId: razorpayKeyId()!,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        description: packLabel(pack),
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
 * Confirm a credit-pack payment after the Razorpay widget succeeds (instant
 * UI; the webhook is the other path and the grant is idempotent on the
 * payment id). Same payment-integrity rule as confirmCheckoutAction: the
 * signature proves a payment for (orderId, paymentId), not what it bought —
 * the pack comes from the order's server-set notes and must be a credits
 * order for THIS org at that pack's INR price.
 */
export async function confirmCreditCheckoutAction(
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

    const order = await fetchRazorpayOrder(orderId);
    if (!order || order.status !== "paid") {
      return {
        ok: false,
        message:
          "We couldn't confirm the payment yet. If you were charged, your credits will arrive shortly.",
      };
    }
    const notes = order.notes ?? {};
    if (notes.orgId !== ctx.org.id) {
      return { ok: false, message: "That payment isn't linked to your workspace." };
    }
    const pack = notes.kind === "credits" ? creditPack(notes.packId ?? "") : null;
    if (!pack || order.amount !== pack.prices.INR * 100) {
      return {
        ok: false,
        message: "That payment doesn't match a credit pack — please contact support.",
      };
    }

    await grantPurchasedCredits({
      orgId: ctx.org.id,
      packId: pack.id,
      sourceKey: paymentId,
      actor: { userId: ctx.userId, name: ctx.membership.displayName || ctx.email || "Unknown" },
    });
    revalidatePath("/settings/billing");
    return { ok: true, message: `${packLabel(pack)} added — thank you!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't confirm the payment.",
    };
  }
}
