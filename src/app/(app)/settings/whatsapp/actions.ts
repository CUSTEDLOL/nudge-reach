"use server";

import { revalidatePath } from "next/cache";
import { prepareWorkspaceForLive } from "@/modules/orgs/go-live";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import {
  saveWhatsappAccount,
  setDefaultWhatsappAccount,
  disconnectWhatsappAccount,
} from "@/modules/whatsapp/accounts";

/** E4: make one of the org's numbers the default sender. */
export async function setDefaultNumberAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const ok = await setDefaultWhatsappAccount(
      ctx.org.id,
      String(formData.get("accountId") ?? "")
    );
    if (!ok) return { ok: false, message: "That number wasn't found." };
    revalidatePath("/settings/whatsapp");
    return { ok: true, message: "Default number updated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't update." };
  }
}

/** E4: disconnect one number (existing chats fall back to the default). */
export async function disconnectNumberAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const ok = await disconnectWhatsappAccount(
      ctx.org.id,
      String(formData.get("accountId") ?? "")
    );
    if (!ok) return { ok: false, message: "That number wasn't found." };
    recordAudit(ctx, "whatsapp.connected", "number disconnected");
    revalidatePath("/settings/whatsapp");
    return { ok: true, message: "Number disconnected." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't disconnect." };
  }
}

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
    const saved = await saveWhatsappAccount({
      orgId: ctx.org.id,
      wabaId,
      phoneNumberId,
      displayName,
      accessToken,
    });
    if (!saved.ok) return { ok: false, message: saved.message };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save the connection.",
    };
  }
  recordAudit(ctx, "whatsapp.connected", displayName, `phone ${phoneNumberId}`);
  // The workspace can now send for real: drop the test calendar and put the
  // follow-up templates in front of Meta (test mode only mock-approved them).
  const live = await prepareWorkspaceForLive(ctx.org.id);
  revalidatePath("/", "layout");
  const extras = [
    live.templatesSubmitted
      ? `${live.templatesSubmitted} message template${live.templatesSubmitted === 1 ? "" : "s"} sent to Meta for approval`
      : "",
    live.testCalendarRemoved ? "test calendar removed — connect your Google Calendar in Apps" : "",
  ].filter(Boolean);
  return {
    ok: true,
    message: `WhatsApp connected. Token stored encrypted.${extras.length ? ` Also: ${extras.join("; ")}.` : ""}`,
  };
}
