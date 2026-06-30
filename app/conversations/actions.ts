"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { handleInboundMessage } from "@/lib/agent/inbound";

export interface SimResult {
  ok: boolean;
  message: string;
}

/**
 * Simulation-only tester: pretend a customer messaged us, so the founder can
 * try the assistant in the browser without a live WhatsApp number. Routes
 * through the exact same handler the live webhook uses.
 */
export async function simulateInboundAction(
  formData: FormData
): Promise<SimResult> {
  const org = await requireOrg();
  const phone = String(formData.get("phone") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!phone || !text) {
    return { ok: false, message: "Enter a phone number and a message." };
  }

  const result = await handleInboundMessage(org.id, phone, text);
  revalidatePath("/conversations");
  if (result.conversationId) {
    revalidatePath(`/conversations/${result.conversationId}`);
  }

  if (result.optedOut) {
    return { ok: true, message: "Customer opted out (STOP) — no reply sent." };
  }
  if (result.skipped) {
    return {
      ok: true,
      message:
        result.skipped === "disabled"
          ? "Saved, but the assistant is OFF — turn it on in Settings → assistant."
          : "Saved, but no assistant is set up yet — configure it in Settings → assistant.",
    };
  }
  return { ok: true, message: "Assistant replied 👇" };
}
