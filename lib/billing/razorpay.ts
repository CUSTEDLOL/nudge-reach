import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Razorpay integration (spec §M8 billing) via the REST API — no SDK dependency.
 * Entirely env-gated: with no keys the app runs in "free / simulation" billing
 * and the UI shows an "add keys to enable payments" state. Add
 * RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (+ RAZORPAY_WEBHOOK_SECRET) to turn on
 * real checkout. India-first; swap the base URL/signature for another gateway
 * if needed.
 */

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** Public key id for the browser checkout widget (safe to expose). */
export function razorpayKeyId(): string | null {
  return env.RAZORPAY_KEY_ID ?? null;
}

function authHeader(): string {
  const token = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");
  return `Basic ${token}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create a Razorpay order for a one-time plan payment (amount in paise).
 * Throws if not configured — callers gate on isRazorpayConfigured() first.
 */
export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {}
): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID/SECRET).");
  }
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
    }),
  });
  const body = (await res.json().catch(() => null)) as
    | (RazorpayOrder & { error?: { description?: string } })
    | null;
  if (!res.ok || !body?.id) {
    throw new Error(
      body?.error?.description ?? `Razorpay order failed (HTTP ${res.status})`
    );
  }
  return body;
}

/**
 * Verify the checkout signature Razorpay returns to the browser after payment:
 * HMAC-SHA256(order_id | payment_id, key_secret) === signature.
 * `secret` is injectable for tests; defaults to the env key.
 */
export function verifyPaymentSignature(
  input: {
    orderId: string;
    paymentId: string;
    signature: string;
  },
  secret: string | undefined = env.RAZORPAY_KEY_SECRET
): boolean {
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, input.signature);
}

/** Verify a Razorpay webhook body against X-Razorpay-Signature. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined = env.RAZORPAY_WEBHOOK_SECRET
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}
