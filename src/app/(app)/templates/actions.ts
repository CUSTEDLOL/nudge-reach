"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { slugifyTemplateName } from "@/modules/whatsapp/template";
import {
  buildLibraryComponents,
  libraryTemplateContentSchema,
  normalizeLibraryContent,
  submitLibraryTemplate,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  type TemplateCategory,
} from "@/modules/whatsapp/library";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const DELETABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

function parseCategory(value: string): TemplateCategory {
  return (TEMPLATE_CATEGORIES as readonly string[]).includes(value)
    ? (value as TemplateCategory)
    : "MARKETING";
}

function parseLanguage(value: string): string {
  return TEMPLATE_LANGUAGES.some((l) => l.code === value) ? value : "en";
}

function parseButtons(formData: FormData) {
  const buttons: Array<{ type: string; text: string; url?: string }> = [];
  for (let i = 0; i < 3; i++) {
    const type = String(formData.get(`button${i}Type`) ?? "");
    const text = String(formData.get(`button${i}Text`) ?? "");
    const url = String(formData.get(`button${i}Url`) ?? "");
    if (!text.trim()) continue;
    buttons.push({ type, text, url });
  }
  return buttons;
}

/**
 * Create or update a library template (always lands as DRAFT — any edit
 * invalidates a pending/granted approval, like the campaign editor). With
 * intent=submit it also submits the saved draft for review.
 */
export async function saveTemplateAction(
  formData: FormData
): Promise<ActionResult> {
  let createdId: string | null = null;
  let message = "Saved as draft.";

  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN"); // agents are read-only in the template library

    const id = String(formData.get("id") ?? "");
    const intent = String(formData.get("intent") ?? "save");
    const displayName = String(formData.get("displayName") ?? "");
    const category = parseCategory(String(formData.get("category") ?? ""));
    const language = parseLanguage(String(formData.get("language") ?? ""));

    const existing = id
      ? await prisma.template.findFirst({
          where: { id, orgId: ctx.org.id, campaignId: null },
        })
      : null;
    if (id && !existing) return { ok: false, message: "Template not found." };

    let content = normalizeLibraryContent(
      {
        displayName,
        headerType: String(formData.get("headerType") ?? "text"),
        headerText: String(formData.get("headerText") ?? ""),
        headerImageUrl: String(formData.get("headerImageUrl") ?? ""),
        body: String(formData.get("body") ?? ""),
        footer: String(formData.get("footer") ?? ""),
        sampleName: String(formData.get("sampleName") ?? ""),
        buttons: parseButtons(formData),
      },
      category
    );

    // Carry over AI-authored context fields the form doesn't edit.
    const prev = existing
      ? libraryTemplateContentSchema.safeParse(existing.content)
      : null;
    if (prev?.success) {
      content = {
        ...content,
        campaignAngle: prev.data.campaignAngle,
        imageTreatment: prev.data.imageTreatment,
        notes: prev.data.notes,
      };
    }

    // Meta template IDs must be unique per WABA — enforce inside the org.
    const slug = slugifyTemplateName(content.productName, language);
    const clash = await prisma.template.findFirst({
      where: {
        orgId: ctx.org.id,
        campaignId: null,
        name: slug,
        ...(existing ? { NOT: { id: existing.id } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      return {
        ok: false,
        message: `Another template already uses the ID “${slug}”. Change the name or language.`,
      };
    }

    const payload = buildLibraryComponents(content, {
      name: slug,
      language,
      category,
    });
    const data = {
      name: slug,
      language,
      category,
      content: content as unknown as Prisma.InputJsonValue,
      componentsJson: payload.components as Prisma.InputJsonValue,
      metaStatus: "DRAFT" as const,
      rejectionReason: null,
    };

    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({
          data: { ...data, orgId: ctx.org.id, campaignId: null },
        });
    if (!existing) createdId = row.id;

    if (intent === "submit") {
      try {
        await submitLibraryTemplate(row.id, ctx.org.id);
        message = "Saved and submitted to Meta for review.";
      } catch (err) {
        // The draft is saved either way — surface why submission didn't go out.
        revalidatePath("/templates");
        revalidatePath(`/templates/${row.id}`);
        return {
          ok: false,
          message: `Saved as draft, but submission failed: ${
            err instanceof Error ? err.message : "Submission failed."
          }`,
        };
      }
    }

    revalidatePath("/templates");
    revalidatePath(`/templates/${row.id}`);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't save the template.",
    };
  }

  if (createdId) redirect(`/templates/${createdId}`);
  return { ok: true, message };
}

/** Submit a saved template for Meta review (simulation settles it in ~10s). */
export async function submitTemplateAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("id") ?? "");
    await submitLibraryTemplate(id, ctx.org.id);
    revalidatePath("/templates");
    revalidatePath(`/templates/${id}`);
    return {
      ok: true,
      message: "Submitted to Meta for review — usually settles in seconds here (simulated).",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Submission failed.",
    };
  }
}

/** Copy a template as a fresh DRAFT named “… (copy)”. */
export async function duplicateTemplateAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("id") ?? "");

    const source = await prisma.template.findFirst({
      where: { id, orgId: ctx.org.id, campaignId: null },
    });
    if (!source) return { ok: false, message: "Template not found." };

    const parsed = libraryTemplateContentSchema.safeParse(source.content);
    if (!parsed.success) {
      return {
        ok: false,
        message: "This template has no editable content to duplicate.",
      };
    }

    // Find a free “(copy)” name — Meta template IDs are unique per WABA.
    const baseName = parsed.data.productName.slice(0, 100);
    let displayName = "";
    let slug = "";
    for (let n = 1; n <= 20; n++) {
      displayName = n === 1 ? `${baseName} (copy)` : `${baseName} (copy ${n})`;
      slug = slugifyTemplateName(displayName, source.language);
      const clash = await prisma.template.findFirst({
        where: { orgId: ctx.org.id, campaignId: null, name: slug },
        select: { id: true },
      });
      if (!clash) break;
      if (n === 20) return { ok: false, message: "Too many copies of this template." };
    }

    const content = { ...parsed.data, productName: displayName };
    const payload = buildLibraryComponents(content, {
      name: slug,
      language: source.language,
      category: parseCategory(source.category),
    });
    await prisma.template.create({
      data: {
        orgId: ctx.org.id,
        campaignId: null,
        name: slug,
        language: source.language,
        category: source.category,
        content: content as unknown as Prisma.InputJsonValue,
        componentsJson: payload.components as Prisma.InputJsonValue,
        metaStatus: "DRAFT",
        rejectionReason: null,
      },
    });

    revalidatePath("/templates");
    return { ok: true, message: `Duplicated as draft “${displayName}”.` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't duplicate the template.",
    };
  }
}

/** Delete a DRAFT or REJECTED template (approved/pending ones are kept). */
export async function deleteTemplateAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("id") ?? "");

    const template = await prisma.template.findFirst({
      where: { id, orgId: ctx.org.id, campaignId: null },
      select: { id: true, metaStatus: true },
    });
    if (!template) return { ok: false, message: "Template not found." };
    if (!(DELETABLE_STATUSES as readonly string[]).includes(template.metaStatus)) {
      return {
        ok: false,
        message: "Only draft or rejected templates can be deleted.",
      };
    }

    await prisma.template.delete({ where: { id: template.id } });
    revalidatePath("/templates");
    return { ok: true, message: "Template deleted." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't delete the template.",
    };
  }
}
