"use server";

import { revalidatePath } from "next/cache";
import { runFounderAction, type AdminActionResult } from "@/modules/admin/actions";
import { requireReason } from "@/modules/admin/confirmation";
import {
  founderRefreshTemplate,
  founderRetryCampaign,
  founderRetryCrmJob,
} from "@/modules/admin/ops";
import type { FounderResult } from "@/modules/admin/audit";

const value = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

function done(orgId: string, result: FounderResult): AdminActionResult {
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/admin/ops");
  revalidatePath(`/admin/orgs/${orgId}`, "layout");
  return { ok: true, message: result.message };
}

async function withRecoveryReason(
  formData: FormData,
  work: (reason: string) => Promise<AdminActionResult>
): Promise<AdminActionResult> {
  const required = requireReason(value(formData, "reason"));
  if (!required.ok) return { ok: false, message: required.error };
  return work(required.value);
}

export async function retryCampaignAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) =>
    withRecoveryReason(formData, async (reason) => {
      const orgId = value(formData, "orgId");
      const campaignId = value(formData, "campaignId");
      if (!orgId || !campaignId) return { ok: false, message: "Bad campaign reference." };
      return done(
        orgId,
        await founderRetryCampaign(
          orgId,
          campaignId,
          founder.email,
          reason,
          value(formData, "confirmation")
        )
      );
    })
  );
}

export async function retryCrmJobAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) =>
    withRecoveryReason(formData, async (reason) => {
      const orgId = value(formData, "orgId");
      const jobId = value(formData, "jobId");
      if (!orgId || !jobId) return { ok: false, message: "Bad CRM job reference." };
      return done(
        orgId,
        await founderRetryCrmJob(
          orgId,
          jobId,
          founder.email,
          reason,
          value(formData, "confirmation")
        )
      );
    })
  );
}

export async function refreshTemplateAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) =>
    withRecoveryReason(formData, async (reason) => {
      const orgId = value(formData, "orgId");
      const templateId = value(formData, "templateId");
      if (!orgId || !templateId) return { ok: false, message: "Bad template reference." };
      return done(
        orgId,
        await founderRefreshTemplate(
          orgId,
          templateId,
          founder.email,
          reason,
          value(formData, "confirmation")
        )
      );
    })
  );
}
