"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { saveWhatsappAccount } from "@/lib/whatsapp/accounts";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function connectWhatsappAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const wabaId = String(formData.get("wabaId") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!wabaId || !phoneNumberId || !displayName || !accessToken) {
    return { ok: false, message: "Please fill in all four fields." };
  }

  try {
    requireRole(ctx, "ADMIN");
    await saveWhatsappAccount({
      orgId: ctx.org.id,
      wabaId,
      phoneNumberId,
      displayName,
      accessToken,
    });
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save the connection.",
    };
  }
  recordAudit(ctx, "whatsapp.connected", displayName, `phone ${phoneNumberId}`);
  revalidatePath("/settings/whatsapp");
  return { ok: true, message: "WhatsApp connected. Token stored encrypted." };
}
