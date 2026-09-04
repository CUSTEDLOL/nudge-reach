"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkWebWidget } from "@/modules/billing/limits";
import { saveWidgetConfig } from "@/modules/widget";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveWidgetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkWebWidget(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const res = await saveWidgetConfig(
      ctx.org.id,
      {
        enabled: formData.get("enabled") === "on",
        phone: String(formData.get("phone") ?? ""),
        prefill: String(formData.get("prefill") ?? ""),
        position: String(formData.get("position") ?? "right"),
        color: String(formData.get("color") ?? "#25D366"),
      },
      ctx.org.dialCode
    );
    if (res.ok) revalidatePath("/settings/widget");
    return { ok: res.ok, message: res.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save." };
  }
}
