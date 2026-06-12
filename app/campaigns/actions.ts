"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateCampaignContent } from "@/lib/campaign/generate";
import { repairAndValidate } from "@/lib/campaign/guardrails";
import type { CampaignContent } from "@/lib/campaign/schema";
import {
  refreshTemplateStatus,
  submitTemplateForApproval,
} from "@/lib/whatsapp/approval";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;

export async function generateCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const description = String(formData.get("description") ?? "").trim();
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!hasPhoto && !description) {
    return {
      ok: false,
      message: "Add a product photo or tell us about the product — either works.",
    };
  }

  let photoUrl: string | null = null;
  let image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | undefined;

  if (hasPhoto) {
    if (!IMAGE_TYPES.has(photo.type)) {
      return { ok: false, message: "Please upload a JPG, PNG or WebP photo." };
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        message: "That photo is too large — please use one under 4 MB.",
      };
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = photo.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${org.id}/${Date.now()}.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("product-photos")
      .upload(path, buffer, { contentType: photo.type });
    if (uploadError) {
      return {
        ok: false,
        message: `Couldn't save the photo: ${uploadError.message}`,
      };
    }
    photoUrl = supabase.storage.from("product-photos").getPublicUrl(path)
      .data.publicUrl;
    image = {
      data: buffer.toString("base64"),
      mediaType: photo.type as NonNullable<typeof image>["mediaType"],
    };
  }

  let content: CampaignContent;
  try {
    content = await generateCampaignContent({ description, image });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Generation failed.",
    };
  }

  const product = await prisma.product.create({
    data: {
      orgId: org.id,
      name: content.productName,
      photoUrl,
      attributes: description ? { description } : undefined,
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      orgId: org.id,
      productId: product.id,
      name: content.productName,
      status: "DRAFT",
      content,
    },
  });

  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const id = String(formData.get("campaignId") ?? "");

  const buttons: unknown[] = [];
  for (let i = 0; i < 3; i++) {
    const type = String(formData.get(`button${i}Type`) ?? "");
    const text = String(formData.get(`button${i}Text`) ?? "").trim();
    const url = String(formData.get(`button${i}Url`) ?? "").trim();
    if (!text) continue;
    if (type === "URL") buttons.push({ type, text, url: url || "https://example.com" });
    else buttons.push({ type: "QUICK_REPLY", text });
  }

  let content: CampaignContent;
  try {
    // The same compliance repairs apply to human edits: opt-out footer and
    // {{1}} cannot be edited away (rule: compliance is invisible).
    content = repairAndValidate({
      productName: String(formData.get("productName") ?? ""),
      campaignAngle: String(formData.get("campaignAngle") ?? ""),
      header: String(formData.get("header") ?? ""),
      body: String(formData.get("body") ?? ""),
      footer: String(formData.get("footer") ?? ""),
      buttons,
      sampleName: String(formData.get("sampleName") ?? "") || "Priya",
      imageTreatment: String(formData.get("imageTreatment") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Invalid campaign.",
    };
  }

  // Any edit invalidates a pending/granted approval — back to DRAFT.
  const updated = await prisma.campaign.updateMany({
    where: { id, orgId: org.id },
    data: { content, name: content.productName, status: "DRAFT" },
  });
  if (updated.count === 0) {
    return { ok: false, message: "Campaign not found." };
  }
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return {
    ok: true,
    message: "Saved. Re-submit for approval when you're happy with it.",
  };
}

export async function submitForApprovalAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const id = String(formData.get("campaignId") ?? "");
  try {
    await submitTemplateForApproval(id, org.id);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Submission failed.",
    };
  }
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true, message: "Submitted to Meta for approval." };
}

export async function refreshStatusAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("campaignId") ?? "");
  await refreshTemplateStatus(id, org.id);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("campaignId") ?? "");
  await prisma.campaign.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}
