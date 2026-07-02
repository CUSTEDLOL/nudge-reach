import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { getPlan } from "@/lib/billing/plans";

/**
 * Razorpay server-to-server webhook: the source of truth for subscription
 * state (the client confirm action is just for instant UI). Verifies the
 * signature, then activates/downgrades the org's plan. Public route (excluded
 * from the auth proxy like the WhatsApp webhook); trust comes from the HMAC.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { notes?: { orgId?: string; planId?: string } } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const notes = payload.payload?.payment?.entity?.notes;
  const orgId = notes?.orgId;
  const planId = notes?.planId;

  if (payload.event === "payment.captured" && orgId && planId) {
    const plan = getPlan(planId);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.org.updateMany({
      where: { id: orgId },
      data: {
        plan: plan.id,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
      },
    });
  }

  if (payload.event === "subscription.cancelled" && orgId) {
    await prisma.org.updateMany({
      where: { id: orgId },
      data: { subscriptionStatus: "cancelled" },
    });
  }

  return NextResponse.json({ ok: true });
}
