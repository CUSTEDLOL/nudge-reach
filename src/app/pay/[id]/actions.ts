"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { markPaymentPaid } from "@/modules/payments";

/**
 * Simulation-only settlement: the "I've sent the payment" button on the pay
 * page. Guarded server-side on provider === "simulation" so it can never
 * settle a real (Razorpay / on-chain) payment — those flip via webhooks.
 */
export async function settleSimulatedPayment(id: string): Promise<void> {
  const row = await prisma.paymentRequest.findUnique({
    where: { id },
    select: { provider: true, status: true },
  });
  if (!row || row.provider !== "simulation" || row.status !== "created") return;
  await markPaymentPaid(id);
  revalidatePath(`/pay/${id}`);
}
