import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { verifyWebhookSignature } from "@/modules/billing/razorpay";
import { markPaymentPaid } from "@/modules/payments";

/**
 * A workspace's own Razorpay account reports here. The opaque key picks the
 * workspace; the HMAC with THAT workspace's webhook secret proves the sender;
 * and a paid link can only settle that same workspace's payment request.
 * Nudge's own billing webhook stays at /api/webhooks/razorpay.
 */
type Context = { params: Promise<{ connectionKey: string }> };

export async function POST(request: Request, context: Context) {
  const { connectionKey } = await context.params;
  const connection = await prisma.paymentConnection.findUnique({ where: { webhookKey: connectionKey } });
  if (!connection) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = await request.text();
  let secret: string;
  try {
    secret = decryptSecret(connection.webhookSecretEncrypted);
  } catch {
    return NextResponse.json({ error: "connection unreadable" }, { status: 500 });
  }
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    payload?: { payment_link?: { entity?: { notes?: { paymentRequestId?: string; kind?: string } } } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Any signed event proves the webhook is wired, including Razorpay's test ping.
  await prisma.paymentConnection.update({ where: { id: connection.id }, data: { lastEventAt: new Date() } });

  if (payload.event === "payment_link.paid") {
    const notes = payload.payload?.payment_link?.entity?.notes;
    if (notes?.kind === "customer_payment" && notes.paymentRequestId) {
      await markPaymentPaid(notes.paymentRequestId, connection.orgId);
    }
  }
  return NextResponse.json({ ok: true });
}
