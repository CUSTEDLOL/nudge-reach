import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * A workspace's own Razorpay account. Customer deposits the AI collects go
 * straight to the business: Nudge never holds a merchant's money (doing so
 * would make it a payment aggregator). Nudge's own RAZORPAY_* keys are for
 * billing Nudge's subscription only.
 */

export class PaymentConnectionError extends Error {}

export interface PaymentCredentials {
  keyId: string;
  keySecret: string;
}

const KEY_ID = /^rzp_(live|test)_[A-Za-z0-9]{8,32}$/;

export function isLiveKey(keyId: string): boolean {
  return keyId.startsWith("rzp_live_");
}

/** "rzp_live_Ab12…9xYz" — enough to recognise, never enough to use. */
export function maskKeyId(keyId: string): string {
  const prefix = keyId.startsWith("rzp_live_") ? "rzp_live_" : keyId.startsWith("rzp_test_") ? "rzp_test_" : "";
  const rest = keyId.slice(prefix.length);
  return rest.length <= 8 ? keyId : `${prefix}${rest.slice(0, 4)}…${rest.slice(-4)}`;
}

/** Ask Razorpay whether this key pair is real. Read-only, free. */
export async function verifyRazorpayKeys(
  creds: PaymentCredentials,
  fetchFn: typeof fetch = fetch
): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetchFn("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, message: "Razorpay could not be reached. Nothing was saved. Try again." };
  }
  if (res.status === 401) {
    return { ok: false, message: "Razorpay rejected this Key ID and Key Secret. Copy them again from Razorpay → Account & Settings → API Keys." };
  }
  if (!res.ok) return { ok: false, message: `Razorpay answered HTTP ${res.status}. Nothing was saved. Try again.` };
  return { ok: true };
}

/** Caller must authenticate and require workspace ADMIN first. */
export async function savePaymentConnection(
  input: { orgId: string; keyId: string; keySecret: string },
  fetchFn: typeof fetch = fetch
) {
  const keyId = input.keyId.trim();
  const keySecret = input.keySecret.trim();
  if (!KEY_ID.test(keyId)) {
    throw new PaymentConnectionError("Enter the Key ID exactly as Razorpay shows it: it starts with rzp_live_ (or rzp_test_ for testing).");
  }
  if (keySecret.length < 16 || keySecret.length > 64 || /\s/.test(keySecret)) {
    throw new PaymentConnectionError("Enter the Key Secret exactly as Razorpay shows it when you generate the key.");
  }
  const verified = await verifyRazorpayKeys({ keyId, keySecret }, fetchFn);
  if (!verified.ok) throw new PaymentConnectionError(verified.message);

  const existing = await prisma.paymentConnection.findUnique({ where: { orgId: input.orgId } });
  // Changing keys keeps the webhook address and secret, so the owner does not
  // have to redo the webhook in Razorpay just to rotate an API key.
  return prisma.paymentConnection.upsert({
    where: { orgId: input.orgId },
    create: {
      orgId: input.orgId,
      provider: "razorpay",
      keyId,
      keySecretEncrypted: encryptSecret(keySecret),
      webhookSecretEncrypted: encryptSecret(randomBytes(24).toString("hex")),
      webhookKey: randomBytes(24).toString("hex"),
      verifiedAt: new Date(),
    },
    update: {
      keyId,
      keySecretEncrypted: encryptSecret(keySecret),
      verifiedAt: new Date(),
      ...(existing ? {} : { webhookSecretEncrypted: encryptSecret(randomBytes(24).toString("hex")) }),
    },
  });
}

export async function getPaymentCredentials(orgId: string): Promise<PaymentCredentials | null> {
  const c = await prisma.paymentConnection.findUnique({ where: { orgId } });
  if (!c) return null;
  try {
    return { keyId: c.keyId, keySecret: decryptSecret(c.keySecretEncrypted) };
  } catch {
    return null;
  }
}

export async function disconnectPaymentConnection(orgId: string): Promise<boolean> {
  const r = await prisma.paymentConnection.deleteMany({ where: { orgId } });
  return r.count > 0;
}
