"use server";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import { ClientConnectionError, saveClientConnection } from "@/modules/whatsapp/client-connection";

export async function saveMetaAppAction(formData: FormData) {
  const ctx = await requireOrgContext();
  try { requireRole(ctx, "ADMIN"); }
  catch { return { ok: false, message: "Only workspace owners and admins can change this connection." }; }
  try {
    await saveClientConnection({ orgId: ctx.org.id, appId: String(formData.get("appId") ?? ""), appSecret: String(formData.get("appSecret") ?? "") });
  } catch (err) {
    return { ok: false, message: err instanceof ClientConnectionError ? err.message : "Could not save the Meta app. Check that it is not already used by another workspace and try again." };
  }
  recordAudit(ctx, "whatsapp.connected", "Workspace Meta app credentials updated");
  revalidatePath("/settings/whatsapp");
  return { ok: true, message: "App credentials saved securely. Copy the webhook details below into this Meta app, then verify and save in Meta." };
}
