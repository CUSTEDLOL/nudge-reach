"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/modules/orgs/auth";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveAgentProfileAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const businessInfo = String(formData.get("businessInfo") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim() || "Warm, friendly, and concise";
  const doNots = String(formData.get("doNots") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  const vertical = String(formData.get("vertical") ?? "restaurant");

  if (!businessName) {
    return { ok: false, message: "Please enter your business name." };
  }

  await prisma.agentProfile.upsert({
    where: { orgId: org.id },
    create: { orgId: org.id, vertical, businessName, businessInfo, tone, doNots, enabled },
    update: { vertical, businessName, businessInfo, tone, doNots, enabled },
  });

  revalidatePath("/settings/agent");
  return {
    ok: true,
    message: enabled
      ? "Saved. Your WhatsApp assistant is ON and will reply to customers."
      : "Saved. Your assistant is OFF — turn it on when you're ready.",
  };
}
