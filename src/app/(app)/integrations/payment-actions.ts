"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import {
  PaymentConnectionError,
  disconnectPaymentConnection,
  maskKeyId,
  savePaymentConnection,
} from "@/modules/payments/connection";

export interface PaymentActionResult {
  ok: boolean;
  message: string;
}

/** Connect (or replace) the workspace's own Razorpay keys. Owners and admins only. */
export async function savePaymentConnectionAction(formData: FormData): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
  } catch {
    return { ok: false, message: "Only workspace owners and admins can connect a payment account." };
  }
  let keyId: string;
  try {
    const saved = await savePaymentConnection({
      orgId: ctx.org.id,
      keyId: String(formData.get("keyId") ?? ""),
      keySecret: String(formData.get("keySecret") ?? ""),
    });
    keyId = saved.keyId;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof PaymentConnectionError ? err.message : "Could not save the Razorpay keys. Nothing was changed. Try again.",
    };
  }
  recordAudit(ctx, "payments.connected", "Razorpay", maskKeyId(keyId));
  revalidatePath("/integrations");
  return {
    ok: true,
    message: "Razorpay connected. Last step: add the webhook below in Razorpay, so paid links are marked paid the moment a customer pays.",
  };
}

export async function disconnectPaymentConnectionAction(): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
  } catch {
    return { ok: false, message: "Only workspace owners and admins can change this." };
  }
  const removed = await disconnectPaymentConnection(ctx.org.id);
  if (removed) recordAudit(ctx, "payments.disconnected", "Razorpay");
  revalidatePath("/integrations");
  return { ok: true, message: removed ? "Razorpay disconnected. The AI stops sending payment links." : "Nothing was connected." };
}
