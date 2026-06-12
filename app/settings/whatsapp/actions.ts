"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { saveWhatsappAccount } from "@/lib/whatsapp/accounts";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function connectWhatsappAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const wabaId = String(formData.get("wabaId") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!wabaId || !phoneNumberId || !displayName || !accessToken) {
    return { ok: false, message: "Please fill in all four fields." };
  }

  try {
    await saveWhatsappAccount({
      orgId: org.id,
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
  revalidatePath("/settings/whatsapp");
  return { ok: true, message: "WhatsApp connected. Token stored encrypted." };
}
