import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  campaignContentSchema,
  type CampaignContent,
} from "@/lib/campaign/schema";
import { repairOptOutFooter } from "@/lib/campaign/guardrails";
import { buildTemplatePayload } from "@/lib/whatsapp/template";

/**
 * Org-scoped template library (spec §M5): Template rows with campaignId null.
 * Owned by M5; consumed by the inbox template sender (M2) and the campaign
 * wizard (M4).
 *
 * Approval flow mirrors lib/whatsapp/approval.ts (the campaign analog):
 * simulation flips PENDING → APPROVED after a short mock review window,
 * checked on poll. Demo/testability convention: a template whose slug
 * contains "reject" is REJECTED instead, so the rejection path is always
 * demoable without a real Meta review.
 */

export const SIMULATED_REVIEW_SECONDS = 10;

const SIMULATED_REJECTION_REASON =
  'Rejected by Meta review (simulated): the template name contains "reject", ' +
  "which the demo treats as a rejection trigger. Rename the template and " +
  "resubmit to see the approval path.";

const LIVE_SUBMISSION_STUB_MESSAGE =
  "Live template submission ships with WABA onboarding. Switch to " +
  "SEND_MODE=simulation to demo the review flow end to end.";

// ---------------------------------------------------------------------------
// Library content shape
// ---------------------------------------------------------------------------

/**
 * The editable source of a library template: the PRD §7 campaign shape plus
 * a header mode. Unlike campaign content, header and footer may be empty —
 * Meta allows header-less templates, and UTILITY/AUTHENTICATION templates
 * don't carry the marketing opt-out footer.
 */
export const libraryTemplateContentSchema = campaignContentSchema.extend({
  header: z.string().max(60).default(""),
  footer: z.string().max(60).default(""),
  headerType: z.enum(["none", "text", "image"]).default("text"),
  /** Public image URL used as the header (simulation stand-in for a media handle). */
  headerImageUrl: z.string().max(2048).default(""),
});

export type LibraryTemplateContent = z.infer<typeof libraryTemplateContentSchema>;

export const TEMPLATE_CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
] as const;

export interface LibraryTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  /** §7-shape editable content; null for legacy campaign-built templates. */
  content: CampaignContent | null;
  /** Header image URL when the template uses an image header (else null). */
  headerImageUrl: string | null;
}

/** Approved library templates, ready to send. */
export async function getApprovedTemplates(
  orgId: string
): Promise<LibraryTemplate[]> {
  const rows = await prisma.template.findMany({
    where: { orgId, campaignId: null, metaStatus: "APPROVED" },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((t) => {
    const parsed = libraryTemplateContentSchema.safeParse(t.content);
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      language: t.language,
      content: parsed.success ? parsed.data : null,
      headerImageUrl:
        parsed.success && parsed.data.headerType === "image"
          ? parsed.data.headerImageUrl || null
          : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Content normalization (pure — unit-tested)
// ---------------------------------------------------------------------------

export interface LibraryContentInput {
  displayName: string;
  headerType: string;
  headerText: string;
  headerImageUrl: string;
  body: string;
  footer: string;
  sampleName: string;
  buttons: Array<{ type: string; text: string; url?: string }>;
}

/**
 * Turn raw form input into valid library content. Compliance is enforced in
 * code, not UI: MARKETING templates always get the opt-out footer via
 * `repairOptOutFooter`; UTILITY/AUTHENTICATION keep the footer as written
 * (opt-out applies to marketing only). Throws readable Errors for the action
 * to surface as `{ ok: false, message }`.
 */
export function normalizeLibraryContent(
  input: LibraryContentInput,
  category: TemplateCategory
): LibraryTemplateContent {
  const displayName = input.displayName.trim().slice(0, 120);
  if (!displayName) throw new Error("Give the template a name.");

  const headerType =
    input.headerType === "none" || input.headerType === "image"
      ? input.headerType
      : "text";

  const headerText = input.headerText.trim().slice(0, 60);
  if (headerType === "text" && !headerText) {
    throw new Error("Add header text, or set the header to “None”.");
  }

  const headerImageUrl = input.headerImageUrl.trim().slice(0, 2048);
  if (headerType === "image" && !/^https?:\/\//i.test(headerImageUrl)) {
    throw new Error("Add a public image URL (https://…) for the header.");
  }

  const body = input.body.trim().slice(0, 1024);
  if (!body) throw new Error("Write the message body.");

  const rawFooter = input.footer.trim().slice(0, 60);
  const footer =
    category === "MARKETING" ? repairOptOutFooter(rawFooter) : rawFooter;

  const buttons = input.buttons
    .map((b) => ({ ...b, text: b.text.trim().slice(0, 25) }))
    .filter((b) => b.text.length > 0)
    .slice(0, 3)
    .map((b) =>
      b.type === "URL"
        ? {
            type: "URL" as const,
            text: b.text,
            url: b.url?.trim() || "https://example.com",
          }
        : { type: "QUICK_REPLY" as const, text: b.text }
    );

  return libraryTemplateContentSchema.parse({
    productName: displayName,
    campaignAngle: "",
    header: headerType === "text" ? headerText : "",
    body,
    footer,
    buttons,
    sampleName: input.sampleName.trim().slice(0, 40) || "Priya",
    imageTreatment: "",
    notes: "",
    headerType,
    headerImageUrl: headerType === "image" ? headerImageUrl : "",
  });
}

// ---------------------------------------------------------------------------
// Meta components payload (pure — unit-tested)
// ---------------------------------------------------------------------------

export interface LibraryComponentsResult {
  name: string;
  language: string;
  category: TemplateCategory;
  components: Array<Record<string, unknown>>;
}

/**
 * Build the Meta `message_templates` components for a library template via
 * the unit-tested `buildTemplatePayload`, then adapt for library-only modes
 * the campaign builder never produces:
 * - headerType "none"  → drop the HEADER component;
 * - empty footer       → drop the FOOTER component (utility templates);
 * - headerType "image" → the stored image URL stands in for the resumable-
 *   upload media handle (simulation; the live upload ships with WABA
 *   onboarding).
 * The row's `category` column carries MARKETING/UTILITY/AUTHENTICATION —
 * only `components` is persisted (same as the campaign approval flow).
 */
export function buildLibraryComponents(
  content: LibraryTemplateContent,
  options: { name: string; language: string; category: TemplateCategory }
): LibraryComponentsResult {
  // For image headers, buildTemplatePayload folds the text header into the
  // body as a bold first line — use the display name, like the campaign flow.
  const base: CampaignContent = {
    ...content,
    header:
      content.headerType === "text"
        ? content.header
        : content.productName || options.name,
    footer: content.footer,
  };

  const payload = buildTemplatePayload(base, {
    name: options.name,
    language: options.language,
    headerImageHandle:
      content.headerType === "image" && content.headerImageUrl
        ? content.headerImageUrl
        : undefined,
  });

  let components = payload.components;
  if (content.headerType === "none") {
    components = components.filter((c) => c.type !== "HEADER");
  }
  if (!content.footer) {
    components = components.filter((c) => c.type !== "FOOTER");
  }

  return {
    name: payload.name,
    language: payload.language,
    category: options.category,
    components,
  };
}

// ---------------------------------------------------------------------------
// Mock review flow (library analog of lib/whatsapp/approval.ts)
// ---------------------------------------------------------------------------

/**
 * Submit a library template for Meta review. Simulation marks it PENDING and
 * the poll (`refreshLibraryTemplateStatus`) settles it after the mock review
 * window. Live mode is a friendly stub until WABA onboarding lands.
 */
export async function submitLibraryTemplate(templateId: string, orgId: string) {
  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId, campaignId: null },
  });
  if (!template) throw new Error("Template not found.");
  if (template.metaStatus === "PENDING") return template; // already in review
  if (template.metaStatus === "APPROVED") {
    throw new Error("This template is already approved.");
  }
  if (env.SEND_MODE === "live") {
    throw new Error(LIVE_SUBMISSION_STUB_MESSAGE);
  }
  return prisma.template.update({
    where: { id: template.id },
    data: {
      metaStatus: "PENDING",
      submittedAt: new Date(),
      rejectionReason: null,
    },
  });
}

/**
 * Polling fallback (and the only mechanism in simulation): settle a PENDING
 * library template once the mock review window has elapsed. Approves by
 * default; rejects when the slug contains "reject" (documented demo
 * convention). Live mode is a no-op stub — statuses will arrive via the
 * template webhook once WABA onboarding ships.
 */
export async function refreshLibraryTemplateStatus(
  templateId: string,
  orgId: string
) {
  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId, campaignId: null },
  });
  if (!template) return null;
  if (template.metaStatus !== "PENDING") return template;
  if (env.SEND_MODE === "live") return template;

  const ageSeconds = (Date.now() - template.submittedAt.getTime()) / 1000;
  if (ageSeconds < SIMULATED_REVIEW_SECONDS) return template;

  if (template.name.includes("reject")) {
    return prisma.template.update({
      where: { id: template.id },
      data: { metaStatus: "REJECTED", rejectionReason: SIMULATED_REJECTION_REASON },
    });
  }
  return prisma.template.update({
    where: { id: template.id },
    data: {
      metaStatus: "APPROVED",
      rejectionReason: null,
      metaTemplateId: template.metaTemplateId ?? `sim-tpl-${template.name}`,
    },
  });
}
