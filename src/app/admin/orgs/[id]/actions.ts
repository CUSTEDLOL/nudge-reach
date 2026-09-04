"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/modules/admin/auth";
import { setOrgPlan } from "@/modules/admin/set-plan";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

/** Founder-only: change an org's plan (audited in modules/admin/set-plan). */
export async function setPlanAction(
  formData: FormData
): Promise<AdminActionResult> {
  const founder = await requireFounder();
  const orgId = String(formData.get("orgId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  const res = await setOrgPlan(orgId, plan, founder.email);
  if (!res.ok) return { ok: false, message: res.error };
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/orgs");
  return { ok: true, message: `Plan changed: ${res.from} → ${res.to}.` };
}
