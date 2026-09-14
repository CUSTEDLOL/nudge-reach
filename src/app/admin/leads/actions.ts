"use server";

import { revalidatePath } from "next/cache";
import {
  runFounderAction,
  type AdminActionResult,
} from "@/modules/admin/actions";
import {
  updateLead,
  type LeadKind,
  type LeadStatus,
} from "@/modules/admin/leads";
import {
  sendGa4LeadEvent,
  type Ga4LeadEventName,
} from "@/modules/marketing/ga4";

const LEAD_EVENT_BY_STATUS: Partial<Record<LeadStatus, Ga4LeadEventName>> = {
  qualified: "qualify_lead",
  dismissed: "disqualify_lead",
  converted: "close_convert_lead",
};

/** Founder-only: move a lead through the pipeline and/or save a note. */
export async function updateLeadAction(
  formData: FormData
): Promise<AdminActionResult> {
  return runFounderAction(async () => {
    const kind = String(formData.get("kind") ?? "") as LeadKind;
    const id = String(formData.get("id") ?? "");
    if (
      (kind !== "access" && kind !== "waitlist" && kind !== "booking") ||
      !id
    ) {
      return { ok: false, message: "Bad lead reference." };
    }
    const status = formData.has("status")
      ? String(formData.get("status"))
      : undefined;
    const notes = formData.has("notes")
      ? String(formData.get("notes"))
      : undefined;
    const res = await updateLead(kind, id, { status, notes });
    if (!res.ok) return { ok: false, message: res.error };
    revalidatePath("/admin/leads");
    revalidatePath("/admin", "layout");

    const eventName = res.transition
      ? LEAD_EVENT_BY_STATUS[res.transition.current]
      : undefined;
    if (eventName && res.transition?.gaClientId) {
      try {
        await sendGa4LeadEvent({
          name: eventName,
          clientId: res.transition.gaClientId,
          leadId: id,
        });
      } catch {
        // Lead updates remain authoritative if optional analytics is unavailable.
      }
    }

    return { ok: true, message: status ? `Marked ${status}.` : "Note saved." };
  });
}
