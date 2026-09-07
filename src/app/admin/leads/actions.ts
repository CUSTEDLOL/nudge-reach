"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/modules/admin/auth";
import { updateLead, type LeadKind } from "@/modules/admin/leads";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

/** Founder-only: move a lead through the pipeline and/or save a note. */
export async function updateLeadAction(formData: FormData): Promise<AdminActionResult> {
  await requireFounder();
  const kind = String(formData.get("kind") ?? "") as LeadKind;
  const id = String(formData.get("id") ?? "");
  if ((kind !== "access" && kind !== "waitlist") || !id) return { ok: false, message: "Bad lead reference." };
  const status = formData.has("status") ? String(formData.get("status")) : undefined;
  const notes = formData.has("notes") ? String(formData.get("notes")) : undefined;
  const res = await updateLead(kind, id, { status, notes });
  if (!res.ok) return { ok: false, message: res.error };
  revalidatePath("/admin/leads");
  revalidatePath("/admin", "layout");
  return { ok: true, message: status ? `Marked ${status}.` : "Note saved." };
}
