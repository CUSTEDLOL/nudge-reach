import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Stripe integration for all non-INR orgs (global markets) via the REST API —
 * no SDK dependency, mirroring lib/billing/razorpay.ts for INR. Entirely
 * env-gated: without STRIPE_SECRET_KEY the billing page shows an "add keys"
 * state for non-INR orgs. One-time monthly payments through Stripe Checkout
 * (mode: payment), consistent with the Razorpay flow; the webhook at
 * /api/webhooks/stripe is the source of truth.
 */

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

/**
 * Create a hosted Checkout session for a plan payment (amount in minor units).
 * Returns the redirect URL. Throws when unconfigured — callers gate on
 * isStripeConfigured() first.
 */
export async function createStripeCheckout(input: {
  /** ISO currency code (any Stripe-supported currency, e.g. "aed", "brl"). */
  currency: string;
  amountMinor: number;
  planId: string;
  planName: string;
  orgId: string;
  orgName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  }

  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountMinor),
    "line_items[0][price_data][product_data][name]": `Nudge ${input.planName} plan — 1 month (${input.orgName})`,
    "metadata[orgId]": input.orgId,
    "metadata[planId]": input.planId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const session = (await res.json().catch(() => null)) as
    | { id?: string; url?: string; error?: { message?: string } }
    | null;
  if (!res.ok || !session?.id || !session.url) {
    throw new Error(
      session?.error?.message ?? `Stripe checkout failed (HTTP ${res.status})`
    );
  }
  return { id: session.id, url: session.url };
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe webhook: the Stripe-Signature header carries
 * `t=<unix>,v1=<hmac>` where v1 = HMAC-SHA256(`${t}.${rawBody}`, secret).
 * Timestamp tolerance blocks replays. `secret`/`now` injectable for tests.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined = env.STRIPE_WEBHOOK_SECRET,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = new Map<string, string[]>();
  for (const piece of signatureHeader.split(",")) {
    const [k, v] = piece.split("=", 2);
    if (!k || !v) continue;
    const list = parts.get(k.trim()) ?? [];
    list.push(v.trim());
    parts.set(k.trim(), list);
  }
  const t = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!t || signatures.length === 0) return false;

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return signatures.some((sig) => {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  });
}
