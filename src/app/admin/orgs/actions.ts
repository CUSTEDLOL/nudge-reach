"use server";

import { revalidatePath } from "next/cache";
import { runFounderAction, type AdminActionResult } from "@/modules/admin/actions";
import { createWorkspace } from "@/modules/admin/create-workspace";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/**
 * Founder-only: create a client's workspace on the plan they paid for and
 * invite their email as OWNER. They choose their own password on signup — we
 * never generate or send one.
 */
export async function createWorkspaceAction(
  formData: FormData
): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const res = await createWorkspace({
      name: str(formData, "name"),
      countryCode: str(formData, "country"),
      plan: str(formData, "plan"),
      ownerEmail: str(formData, "ownerEmail"),
      founderEmail: founder.email,
    });
    if (res.ok) {
      revalidatePath("/admin/orgs");
      revalidatePath("/admin");
    }
    return { ok: res.ok, message: res.message };
  });
}
