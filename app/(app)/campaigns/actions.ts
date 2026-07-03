"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg, requireOrgContext, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canSendMarketing } from "@/lib/consent";
import { buildContactWhere, type SegmentFilter } from "@/lib/segments";
import { estimateCampaignCost, formatMoney } from "@/lib/billing";
import { orgCurrency } from "@/lib/billing/money";
import { recordAudit } from "@/lib/audit";
import {
  generateCampaignContent,
  marketVoiceForDialCode,
} from "@/lib/campaign/generate";
import { repairAndValidate } from "@/lib/campaign/guardrails";
import {
  campaignContentSchema,
  type CampaignContent,
} from "@/lib/campaign/schema";
import {
  refreshTemplateStatus,
  submitTemplateForApproval,
} from "@/lib/whatsapp/approval";
import {
  applySimulatedProgress,
  enqueueCampaign,
  processQueue,
  retryFailedMessages,
} from "@/lib/send/queue";
import {
  blankCampaignContent,
  LEAD_STAGE_VALUES,
  parseScheduledAt,
  segmentAudienceName,
} from "./wizard-helpers";

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

// ---------------------------------------------------------------------------
// Step 1 — content (three tabs; each creates the campaign row)
// ---------------------------------------------------------------------------

/** Returned by the wizard's step-1 actions so the client can advance. */
export interface WizardContentResult extends ActionResult {
  campaignId?: string;
  content?: CampaignContent;
  status?: "DRAFT" | "TEMPLATE_APPROVED";
  photoUrl?: string | null;
}

/** Shared core of the "from photo" flow (wizard + legacy action). */
async function createCampaignFromPhoto(
  orgId: string,
  formData: FormData
): Promise<
  | { ok: true; campaignId: string; content: CampaignContent; photoUrl: string | null }
  | { ok: false; message: string }
> {
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
    const path = `${orgId}/${Date.now()}.${ext}`;

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

  // Market voice: Indian workspaces keep the Hinglish-friendly voice,
  // everyone else gets clear international English.
  const orgRow = await prisma.org.findUnique({
    where: { id: orgId },
    select: { dialCode: true },
  });

  let content: CampaignContent;
  try {
    content = await generateCampaignContent({
      description,
      image,
      voice: marketVoiceForDialCode(orgRow?.dialCode ?? "+91"),
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Generation failed.",
    };
  }

  const product = await prisma.product.create({
    data: {
      orgId,
      name: content.productName,
      photoUrl,
      attributes: description ? { description } : undefined,
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      orgId,
      productId: product.id,
      name: content.productName,
      status: "DRAFT",
      content,
    },
  });

  return { ok: true, campaignId: campaign.id, content, photoUrl };
}

/** Legacy entry point (kept working): generate then jump to the editor. */
export async function generateCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const result = await createCampaignFromPhoto(org.id, formData);
  if (!result.ok) return result;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${result.campaignId}`);
}

/** Wizard tab "From photo": existing generate flow, but stays in the wizard. */
export async function wizardFromPhotoAction(
  formData: FormData
): Promise<WizardContentResult> {
  const org = await requireOrg();
  const result = await createCampaignFromPhoto(org.id, formData);
  if (!result.ok) return result;
  revalidatePath("/campaigns");
  return {
    ok: true,
    message: "Campaign written — now pick who gets it.",
    campaignId: result.campaignId,
    content: result.content,
    status: "DRAFT",
    photoUrl: result.photoUrl,
  };
}

/**
 * Wizard tab "From template": copies an approved library template's content
 * into a new campaign. The campaign reuses the template's Meta approval (a
 * campaign-scoped Template copy is created already APPROVED), so it goes
 * straight to TEMPLATE_APPROVED — no second review round-trip.
 */
export async function wizardFromTemplateAction(
  formData: FormData
): Promise<WizardContentResult> {
  const org = await requireOrg();
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) {
    return { ok: false, message: "Pick a template first." };
  }

  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId: org.id, metaStatus: "APPROVED" },
  });
  if (!template) {
    return { ok: false, message: "That template isn't approved (or was deleted)." };
  }
  const parsed = campaignContentSchema.safeParse(template.content);
  if (!parsed.success) {
    return {
      ok: false,
      message: "That template has no editable content — pick another one.",
    };
  }
  const content = parsed.data;

  const product = await prisma.product.create({
    data: { orgId: org.id, name: content.productName },
  });
  const campaign = await prisma.campaign.create({
    data: {
      orgId: org.id,
      productId: product.id,
      name: content.productName,
      status: "TEMPLATE_APPROVED",
      content,
      sourceTemplateId: template.id,
    },
  });
  // The send queue reads the campaign's own latest template row; clone the
  // approved one so the Meta approval carries over (orgId stays null so the
  // copy never shows up in the library list).
  await prisma.template.create({
    data: {
      campaignId: campaign.id,
      name: template.name,
      language: template.language,
      category: template.category,
      componentsJson: template.componentsJson as Prisma.InputJsonValue,
      metaTemplateId: template.metaTemplateId,
      metaStatus: "APPROVED",
    },
  });

  revalidatePath("/campaigns");
  return {
    ok: true,
    message: `Using "${template.name}" — already approved by Meta.`,
    campaignId: campaign.id,
    content,
    status: "TEMPLATE_APPROVED",
    photoUrl: null,
  };
}

/** Wizard tab "Blank": empty §7-shape content with compliant defaults. */
export async function wizardBlankAction(
  formData: FormData
): Promise<WizardContentResult> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();

  let content: CampaignContent;
  try {
    content = blankCampaignContent(name);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't create the draft.",
    };
  }

  const product = await prisma.product.create({
    data: { orgId: org.id, name: content.productName },
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

  revalidatePath("/campaigns");
  return {
    ok: true,
    message: "Blank draft created — the opt-out footer is already in.",
    campaignId: campaign.id,
    content,
    status: "DRAFT",
    photoUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — audience
// ---------------------------------------------------------------------------

export interface SegmentCountResult extends ActionResult {
  count?: number;
}

function segmentFilterFromForm(formData: FormData): SegmentFilter {
  const stage = String(formData.get("stage") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  const source = String(formData.get("source") ?? "");
  return {
    stage: LEAD_STAGE_VALUES.includes(stage as (typeof LEAD_STAGE_VALUES)[number])
      ? (stage as LeadStage)
      : undefined,
    tagId: tagId || undefined,
    source: source || undefined,
    optedIn: true, // marketing sends: only ever count consentable contacts
  };
}

/** Live opted-in count preview for the segment builder. */
export async function segmentCountAction(
  formData: FormData
): Promise<SegmentCountResult> {
  const org = await requireOrg();
  const where = buildContactWhere(org.id, segmentFilterFromForm(formData));
  const count = await prisma.contact.count({ where });
  return { ok: true, message: "", count };
}

export interface WizardAudienceResult extends ActionResult {
  audienceId?: string;
  audienceName?: string;
  optedInCount?: number;
  estimatedCostLabel?: string;
}

/**
 * Step 2 → 3: attach an audience to the campaign. Either an existing
 * Audience, or a dynamic segment that materializes into a new Audience named
 * "Segment: …" right here (audiences stay static lists — spec §M3/M4).
 */
export async function wizardAudienceAction(
  formData: FormData
): Promise<WizardAudienceResult> {
  const org = await requireOrg();
  const campaignId = String(formData.get("campaignId") ?? "");
  const mode = String(formData.get("mode") ?? "existing");

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId: org.id },
    select: { id: true, status: true },
  });
  if (!campaign) return { ok: false, message: "Campaign not found." };

  let audienceId: string;
  let audienceName: string;
  let optedInCount: number;

  if (mode === "segment") {
    const filter = segmentFilterFromForm(formData);
    const where = buildContactWhere(org.id, filter);
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
    });
    if (contacts.length === 0) {
      return {
        ok: false,
        message: "No opted-in customers match those filters — widen them a bit.",
      };
    }
    const tag = filter.tagId
      ? await prisma.tag.findFirst({
          where: { id: filter.tagId, orgId: org.id },
          select: { name: true },
        })
      : null;
    const audience = await prisma.audience.create({
      data: {
        orgId: org.id,
        name: segmentAudienceName({
          stage: filter.stage,
          tagName: tag?.name,
          source: filter.source,
        }),
        contacts: {
          createMany: {
            data: contacts.map((c) => ({ contactId: c.id })),
            skipDuplicates: true,
          },
        },
      },
    });
    audienceId = audience.id;
    audienceName = audience.name;
    optedInCount = contacts.length;
  } else {
    audienceId = String(formData.get("audienceId") ?? "");
    if (!audienceId) return { ok: false, message: "Pick an audience first." };
    const audience = await prisma.audience.findFirst({
      where: { id: audienceId, orgId: org.id },
      include: { contacts: { include: { contact: true } } },
    });
    if (!audience) return { ok: false, message: "Audience not found." };
    audienceName = audience.name;
    optedInCount = audience.contacts.filter((m) =>
      canSendMarketing(m.contact)
    ).length;
    if (optedInCount === 0) {
      return {
        ok: false,
        message: "No one in that audience has opted in — pick another.",
      };
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { audienceId },
  });
  revalidatePath(`/campaigns/${campaign.id}`);

  const currency = orgCurrency(org);
  const estimate = estimateCampaignCost(optedInCount, currency);
  return {
    ok: true,
    message: "Audience locked in.",
    audienceId,
    audienceName,
    optedInCount,
    estimatedCostLabel: formatMoney(estimate.totalMinorUnits, currency),
  };
}

// ---------------------------------------------------------------------------
// Step 3 — review: send now / schedule
// ---------------------------------------------------------------------------

function consentConfirmed(formData: FormData): boolean {
  return formData.get("consentConfirmed") === "on";
}

/**
 * "Send now" from the wizard review step. DRAFT campaigns go into the
 * existing approval path (submit → poll → run from the campaign page);
 * TEMPLATE_APPROVED ones (from-template, or already approved) start sending
 * immediately. Admin-gated: agents can't send marketing (spec §3.1).
 */
export async function launchCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!consentConfirmed(formData)) {
    return {
      ok: false,
      message: "Please confirm these contacts opted in to WhatsApp marketing.",
    };
  }

  try {
    requireRole(ctx, "ADMIN");
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, orgId: ctx.org.id },
      select: { id: true, status: true, audienceId: true },
    });
    if (!campaign) return { ok: false, message: "Campaign not found." };
    if (!campaign.audienceId) {
      return { ok: false, message: "Pick an audience first." };
    }

    if (campaign.status === "DRAFT") {
      await submitTemplateForApproval(campaign.id, ctx.org.id);
      revalidatePath(`/campaigns/${campaign.id}`);
      revalidatePath("/campaigns");
      return {
        ok: true,
        message:
          "Submitted to Meta for approval — it starts sending once approved.",
      };
    }

    if (campaign.status === "TEMPLATE_APPROVED") {
      const { queued, skippedNoConsent } = await enqueueCampaign(
        campaign.id,
        campaign.audienceId,
        ctx.org.id
      );
      await processQueue(campaign.id);
      revalidatePath(`/campaigns/${campaign.id}`);
      revalidatePath("/campaigns");
      return {
        ok: true,
        message: `Sending to ${queued} customer${queued === 1 ? "" : "s"}${
          skippedNoConsent ? ` (${skippedNoConsent} skipped — no opt-in)` : ""
        }.`,
      };
    }

    return {
      ok: false,
      message: "This campaign can't be sent from here — check its status.",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't start sending.",
    };
  }
}

/**
 * Schedule an approved campaign for later. Only TEMPLATE_APPROVED campaigns
 * can be scheduled (the Meta approval must exist BEFORE the cron releases the
 * send — releaseDueCampaigns relies on it). Future-only. Admin-gated.
 */
export async function scheduleCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  const scheduledAtIso = String(formData.get("scheduledAtIso") ?? "");
  if (!consentConfirmed(formData)) {
    return {
      ok: false,
      message: "Please confirm these contacts opted in to WhatsApp marketing.",
    };
  }

  const parsed = parseScheduledAt(scheduledAtIso);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  try {
    requireRole(ctx, "ADMIN");
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, orgId: ctx.org.id },
      select: { id: true, status: true, audienceId: true },
    });
    if (!campaign) return { ok: false, message: "Campaign not found." };
    if (campaign.status !== "TEMPLATE_APPROVED") {
      return {
        ok: false,
        message: "Meta approval is required before scheduling — submit it first.",
      };
    }
    const audienceId =
      String(formData.get("audienceId") ?? "") || campaign.audienceId;
    if (!audienceId) return { ok: false, message: "Pick an audience first." };

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "SCHEDULED", scheduledAt: parsed.date, audienceId },
    });
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath("/campaigns");
    return {
      ok: true,
      message: `Scheduled for ${new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed.date)}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't schedule.",
    };
  }
}

/** SCHEDULED → TEMPLATE_APPROVED (keeps the approval; clears the timer). */
export async function cancelScheduleAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  try {
    requireRole(ctx, "ADMIN");
    const updated = await prisma.campaign.updateMany({
      where: { id: campaignId, orgId: ctx.org.id, status: "SCHEDULED" },
      data: { status: "TEMPLATE_APPROVED", scheduledAt: null },
    });
    if (updated.count === 0) {
      return { ok: false, message: "This campaign is no longer scheduled." };
    }
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath("/campaigns");
    return { ok: true, message: "Schedule cancelled — it's ready to send." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't cancel.",
    };
  }
}

/** Don't wait for the timer: send a SCHEDULED campaign right now. */
export async function sendScheduledNowAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  try {
    requireRole(ctx, "ADMIN");
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, orgId: ctx.org.id, status: "SCHEDULED" },
      select: { id: true, audienceId: true },
    });
    if (!campaign?.audienceId) {
      return { ok: false, message: "This campaign is no longer scheduled." };
    }
    // Claim atomically (mirrors releaseDueCampaigns) so cron can't double-send.
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "TEMPLATE_APPROVED" },
    });
    if (claimed.count === 0) {
      return { ok: false, message: "This campaign is no longer scheduled." };
    }
    const { queued, skippedNoConsent } = await enqueueCampaign(
      campaign.id,
      campaign.audienceId,
      ctx.org.id
    );
    await processQueue(campaign.id);
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath("/campaigns");
    return {
      ok: true,
      message: `Sending to ${queued} customer${queued === 1 ? "" : "s"}${
        skippedNoConsent ? ` (${skippedNoConsent} skipped — no opt-in)` : ""
      }.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't start sending.",
    };
  }
}

// ---------------------------------------------------------------------------
// Existing editor / approval / run actions (behavior preserved)
// ---------------------------------------------------------------------------

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

  // Any edit invalidates a pending/granted approval (and any schedule that
  // depended on it) — back to DRAFT.
  const updated = await prisma.campaign.updateMany({
    where: { id, orgId: org.id },
    data: { content, name: content.productName, status: "DRAFT", scheduledAt: null },
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
  const ctx = await requireOrgContext();
  const id = String(formData.get("campaignId") ?? "");
  try {
    requireRole(ctx, "ADMIN");
    await submitTemplateForApproval(id, ctx.org.id);
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

export async function runCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("campaignId") ?? "");
  const audienceId = String(formData.get("audienceId") ?? "");
  if (!audienceId) {
    return { ok: false, message: "Pick an audience first." };
  }
  if (!consentConfirmed(formData)) {
    return {
      ok: false,
      message: "Please confirm these contacts opted in to WhatsApp marketing.",
    };
  }

  try {
    requireRole(ctx, "ADMIN");
    const { queued, skippedNoConsent } = await enqueueCampaign(
      id,
      audienceId,
      ctx.org.id
    );
    recordAudit(ctx, "campaign.sent", id, `${queued} recipients`);
    // Kick off the first batch right away; the dashboard keeps it moving.
    await processQueue(id);
    revalidatePath(`/campaigns/${id}`);
    revalidatePath("/campaigns");
    return {
      ok: true,
      message: `Sending to ${queued} customer${queued === 1 ? "" : "s"}${
        skippedNoConsent
          ? ` (${skippedNoConsent} skipped — no opt-in)`
          : ""
      }.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't start sending.",
    };
  }
}

/** Retry a sent campaign's failed messages (fresh rows, consent re-checked). */
export async function retryFailedAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("campaignId") ?? "");
  try {
    requireRole(ctx, "ADMIN");
    const { retried, skippedNoConsent } = await retryFailedMessages(
      id,
      ctx.org.id
    );
    if (retried === 0) {
      return {
        ok: false,
        message: skippedNoConsent
          ? "Nothing to retry — the failed contacts have opted out since."
          : "Nothing to retry.",
      };
    }
    await processQueue(id);
    revalidatePath(`/campaigns/${id}`);
    return {
      ok: true,
      message: `Retrying ${retried} failed message${retried === 1 ? "" : "s"}${
        skippedNoConsent ? ` (${skippedNoConsent} skipped — opted out)` : ""
      }.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't retry.",
    };
  }
}

/** Dashboard tick — advances queue + simulated statuses, then re-renders. */
export async function tickCampaignAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findFirst({
    where: { id, orgId: org.id },
    select: { id: true },
  });
  if (!campaign) return;
  await processQueue(id);
  await applySimulatedProgress(id);
  revalidatePath(`/campaigns/${id}`);
}

export async function deleteCampaignAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("campaignId") ?? "");
  try {
    requireRole(ctx, "ADMIN");
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Not allowed.",
    };
  }
  await prisma.campaign.deleteMany({ where: { id, orgId: ctx.org.id } });
  revalidatePath("/campaigns");
  return { ok: true, message: "Campaign deleted." };
}
