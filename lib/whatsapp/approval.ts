import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { campaignContentSchema } from "@/lib/campaign/schema";
import {
  buildTemplatePayload,
  slugifyTemplateName,
} from "@/lib/whatsapp/template";
import { getWhatsappCredentials } from "@/lib/whatsapp/accounts";

/**
 * Template approval flow. Simulation mocks Meta (PENDING → APPROVED after a
 * short delay, checked on poll); live submits to the Cloud API and polls
 * GET /<WABA_ID>/message_templates as the webhook fallback.
 */

const SIMULATED_REVIEW_SECONDS = 10;

export async function submitTemplateForApproval(campaignId: string, orgId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
    include: { product: { select: { photoUrl: true } } },
  });
  if (!campaign) throw new Error("Campaign not found.");

  const content = campaignContentSchema.parse(campaign.content);
  const name = slugifyTemplateName(
    content.productName,
    campaign.id.slice(-6).toLowerCase()
  );

  let headerImageHandle: string | undefined;
  let metaTemplateId: string | undefined;

  if (env.SEND_MODE === "live") {
    const creds = await getWhatsappCredentials(orgId);
    if (!creds) {
      throw new Error(
        "Connect your WhatsApp Business Account first (Settings → WhatsApp)."
      );
    }
    if (campaign.product.photoUrl) {
      headerImageHandle = await uploadHeaderImage(
        campaign.product.photoUrl,
        creds.accessToken
      );
    }
    const payload = buildTemplatePayload(content, { name, headerImageHandle });
    const res = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${creds.wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      throw new Error(body?.error?.message ?? `Meta rejected the submission (HTTP ${res.status}).`);
    }
    metaTemplateId = body?.id;
  } else {
    // Simulation: a mock media handle so the payload matches the live shape.
    headerImageHandle = campaign.product.photoUrl
      ? `sim-media-handle-${campaign.id.slice(-6)}`
      : undefined;
  }

  const payload = buildTemplatePayload(content, { name, headerImageHandle });

  const template = await prisma.template.create({
    data: {
      campaignId: campaign.id,
      name,
      language: payload.language,
      category: payload.category,
      componentsJson: payload.components as Prisma.InputJsonValue,
      metaTemplateId,
      metaStatus: "PENDING",
    },
  });
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "TEMPLATE_PENDING" },
  });
  return template;
}

/**
 * Polling fallback (and the only mechanism in simulation). Returns the
 * up-to-date template row.
 */
export async function refreshTemplateStatus(campaignId: string, orgId: string) {
  const template = await prisma.template.findFirst({
    where: { campaignId, campaign: { orgId } },
    orderBy: { submittedAt: "desc" },
  });
  if (!template) return null;
  if (template.metaStatus !== "PENDING") return template;

  if (env.SEND_MODE === "live") {
    const creds = await getWhatsappCredentials(orgId);
    if (!creds) return template;
    const res = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${creds.wabaId}/message_templates?name=${template.name}`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );
    const body = (await res.json().catch(() => null)) as {
      data?: Array<{ status?: string; rejected_reason?: string }>;
    } | null;
    const meta = body?.data?.[0];
    if (!meta?.status) return template;

    if (meta.status === "APPROVED") {
      return approveTemplate(template.id, campaignId);
    }
    if (meta.status === "REJECTED") {
      return rejectTemplate(
        template.id,
        campaignId,
        meta.rejected_reason ?? "Rejected by Meta"
      );
    }
    return template;
  }

  // Simulation: approve after a short mock review window.
  const age = (Date.now() - template.submittedAt.getTime()) / 1000;
  if (age >= SIMULATED_REVIEW_SECONDS) {
    return approveTemplate(template.id, campaignId);
  }
  return template;
}

async function approveTemplate(templateId: string, campaignId: string) {
  const [template] = await prisma.$transaction([
    prisma.template.update({
      where: { id: templateId },
      data: { metaStatus: "APPROVED", rejectionReason: null },
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "TEMPLATE_APPROVED" },
    }),
  ]);
  return template;
}

async function rejectTemplate(
  templateId: string,
  campaignId: string,
  reason: string
) {
  const [template] = await prisma.$transaction([
    prisma.template.update({
      where: { id: templateId },
      data: { metaStatus: "REJECTED", rejectionReason: reason },
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "DRAFT" }, // back to editable for resubmission
    }),
  ]);
  return template;
}

/**
 * Resumable upload (live): product photo → media handle for the template's
 * image header example.
 */
async function uploadHeaderImage(
  photoUrl: string,
  accessToken: string
): Promise<string> {
  const imageRes = await fetch(photoUrl);
  if (!imageRes.ok) throw new Error("Couldn't fetch the product photo.");
  const bytes = Buffer.from(await imageRes.arrayBuffer());
  const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";

  const appId = env.WABA_ID; // resumable upload runs against the app id when present
  const sessionRes = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${appId}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(contentType)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const session = (await sessionRes.json().catch(() => null)) as {
    id?: string;
    error?: { message?: string };
  } | null;
  if (!sessionRes.ok || !session?.id) {
    throw new Error(
      session?.error?.message ?? "Couldn't start the media upload session."
    );
  }

  const uploadRes = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${session.id}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
      },
      body: bytes,
    }
  );
  const uploaded = (await uploadRes.json().catch(() => null)) as {
    h?: string;
    error?: { message?: string };
  } | null;
  if (!uploadRes.ok || !uploaded?.h) {
    throw new Error(uploaded?.error?.message ?? "Media upload failed.");
  }
  return uploaded.h;
}
