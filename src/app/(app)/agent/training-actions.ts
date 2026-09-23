"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
} from "@/modules/knowledge/digest";
import {
  answerOwnerQuestion,
  dismissOwnerQuestion,
} from "@/modules/knowledge/questions";
import { distillAnswer, type DistilledFact } from "@/modules/knowledge/distill";
import { storeKnowledgeFacts } from "@/modules/knowledge/store";
import {
  FILE_MEDIA_TYPES,
  MAX_FILE_BYTES,
  ingestFile,
  ingestGbp,
  ingestWebsite,
  type FileMediaType,
} from "@/modules/knowledge/ingest";
import {
  TRIAL_INGEST_BUDGET,
  TRIAL_KNOWLEDGE_LIMITS,
  withTrialKnowledgeImport,
} from "@/modules/trial/knowledge";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import { activateTrialAgentIfGrounded } from "@/modules/trial/activation";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const TRIAL_IMPORT_LIMIT_MESSAGE =
  "Your free trial can store up to 50 facts. Archive a fact before importing more.";

function isCategory(c: string): c is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(c);
}

function fail(err: unknown): ActionResult {
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Something went wrong.",
  };
}

export async function answerQuestionAction(
  questionId: string,
  answerText: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    if (await isRestrictedAcquisitionTrial(ctx.org.id)) {
      return {
        ok: false,
        message: "This AI knowledge tool is available on paid plans.",
      };
    }
    const r = await answerOwnerQuestion(ctx, questionId, answerText);
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Saved ${r.facts} fact${r.facts === 1 ? "" : "s"}${
        r.followUpsSent
          ? ` and replied to ${r.followUpsSent} waiting customer${
              r.followUpsSent === 1 ? "" : "s"
            }`
          : ""
      }.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function dismissQuestionAction(
  questionId: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    await dismissOwnerQuestion(ctx, questionId);
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    return { ok: true, message: "Question dismissed." };
  } catch (err) {
    return fail(err);
  }
}

export async function addFactAction(input: {
  category: string;
  fact: string;
  condition?: string;
}): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const fact = input.fact.trim();
    if (fact.length < 3) return { ok: false, message: "Fact is too short." };
    if (!isCategory(input.category))
      return { ok: false, message: "Pick a valid category." };
    const category = input.category;
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const condition = input.condition?.trim().slice(0, 120);
    if (!restricted) {
      await prisma.knowledgeEntry.create({
        data: {
          orgId: ctx.org.id,
          category,
          fact: fact.slice(0, 300),
          condition: condition || null,
          source: "manual",
        },
      });
      revalidatePath("/agent");
      revalidatePath("/dashboard");
      return { ok: true, message: "Fact added." };
    }
    const stored = await prisma.$transaction(async (tx) => {
      const result = await storeKnowledgeFacts(
        ctx.org.id,
        [{
          category,
          fact: fact.slice(0, 300),
          ...(condition ? { condition } : {}),
        }],
        {
          source: "manual",
          status: "active",
          activeDraftCap: TRIAL_KNOWLEDGE_LIMITS.facts,
        },
        tx,
      );
      if (result.created > 0) {
        await activateTrialAgentIfGrounded(ctx, tx);
      }
      return result;
    });
    if (stored.created === 0) {
      return stored.capacityReached
        ? {
            ok: false,
            message: "Your free trial can store up to 50 facts. Archive a fact before adding another.",
          }
        : { ok: false, message: "That fact is already in your knowledge." };
    }
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    return { ok: true, message: "Fact added." };
  } catch (err) {
    return fail(err);
  }
}

export async function updateFactAction(
  id: string,
  input: { category: string; fact: string; condition?: string }
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const fact = input.fact.trim();
    if (fact.length < 3) return { ok: false, message: "Fact is too short." };
    if (!isCategory(input.category))
      return { ok: false, message: "Pick a valid category." };
    const updated = await prisma.knowledgeEntry.updateMany({
      where: { id, orgId: ctx.org.id, status: "active" },
      data: {
        category: input.category,
        fact: fact.slice(0, 300),
        condition: input.condition?.trim().slice(0, 120) || null,
      },
    });
    if (updated.count === 0) return { ok: false, message: "Fact not found." };
    revalidatePath("/agent");
    return { ok: true, message: "Fact updated." };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveFactAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const updated = await prisma.knowledgeEntry.updateMany({
      where: { id, orgId: ctx.org.id, status: "active" },
      data: { status: "archived" },
    });
    if (updated.count === 0) return { ok: false, message: "Fact not found." };
    recordAudit(ctx, "knowledge.entry_archived", id);
    revalidatePath("/agent");
    return { ok: true, message: "Fact archived." };
  } catch (err) {
    return fail(err);
  }
}

/** Bulk archive up to 200 selected facts — same org/role rules as the single. */
const BULK_ARCHIVE_CAP = 200;

export async function archiveFactsAction(ids: string[]): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))].slice(
      0,
      BULK_ARCHIVE_CAP
    );
    if (unique.length === 0) {
      return { ok: false, message: "Select at least one fact first." };
    }
    const updated = await prisma.knowledgeEntry.updateMany({
      where: { id: { in: unique }, orgId: ctx.org.id, status: "active" },
      data: { status: "archived" },
    });
    if (updated.count === 0) return { ok: false, message: "No matching facts." };
    recordAudit(ctx, "knowledge.entry_archived", `${updated.count} facts (bulk)`);
    revalidatePath("/agent");
    return {
      ok: true,
      message: `Archived ${updated.count} fact${updated.count === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Import-first onboarding: crawl the business website into DRAFT facts the
 * owner reviews below. Drafts never reach the agent until approved.
 */
export async function importWebsiteAction(url: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const trimmed = url.trim();
    if (!trimmed) return { ok: false, message: "Enter your website address." };
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const result = await withTrialKnowledgeImport(
      ctx.org.id,
      "website",
      () => restricted
        ? ingestWebsite(ctx.org.id, trimmed, {
            ...TRIAL_INGEST_BUDGET,
            activeDraftCap: TRIAL_KNOWLEDGE_LIMITS.facts,
          })
        : ingestWebsite(ctx.org.id, trimmed),
      (value) => value.drafts > 0
    );
    recordAudit(ctx, "knowledge.website_imported", trimmed);
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    if (restricted && result.capacityReached && result.drafts === 0) {
      return { ok: false, message: TRIAL_IMPORT_LIMIT_MESSAGE };
    }
    if (result.drafts === 0) {
      return {
        ok: true,
        message: `Read ${result.pages} page${
          result.pages === 1 ? "" : "s"
        } but found nothing new to import.`,
      };
    }
    return {
      ok: true,
      message: `Found ${result.drafts} fact${
        result.drafts === 1 ? "" : "s"
      } across ${result.pages} page${
        result.pages === 1 ? "" : "s"
      } — review them below.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Import from the Google Business Profile listing: name+city search →
 * address/hours/phone as DRAFT facts; chains into the website crawl when
 * the listing has one. Simulation profile when no Places key.
 */
export async function importGbpAction(query: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const trimmed = query.trim();
    if (!trimmed) {
      return { ok: false, message: "Type your business name and city." };
    }
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const result = await withTrialKnowledgeImport(
      ctx.org.id,
      "gbp",
      () => restricted
        ? ingestGbp(ctx.org.id, trimmed, {
            ...TRIAL_INGEST_BUDGET,
            activeDraftCap: TRIAL_KNOWLEDGE_LIMITS.facts,
          })
        : ingestGbp(ctx.org.id, trimmed),
      (value) => value.drafts > 0
    );
    recordAudit(ctx, "knowledge.gbp_imported", trimmed);
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    if (restricted && result.capacityReached && result.drafts === 0) {
      return { ok: false, message: TRIAL_IMPORT_LIMIT_MESSAGE };
    }
    if (result.drafts === 0) {
      return {
        ok: true,
        message: `Found ${result.name} but nothing new to import.`,
      };
    }
    return {
      ok: true,
      message: `Imported ${result.drafts} fact${
        result.drafts === 1 ? "" : "s"
      } from ${result.name}${
        result.websiteCrawled ? " (including their website)" : ""
      } — review them below.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Import a menu / price list / brochure — PDF (document block) or photo
 * (vision) — into DRAFT facts. Same review flow as the website import.
 */
export async function importFileAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose a file to import." };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, message: "That file is too large — 4 MB max." };
    }
    if (!(FILE_MEDIA_TYPES as readonly string[]).includes(file.type)) {
      return {
        ok: false,
        message: "Upload a PDF or a JPG/PNG/WebP photo of your menu or rate card.",
      };
    }
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    if (restricted && file.type !== "application/pdf") {
      return { ok: false, message: "Free trials accept text PDFs only." };
    }
    const result = await withTrialKnowledgeImport(
      ctx.org.id,
      "file",
      async () => {
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        const input = {
          base64,
          mediaType: file.type as FileMediaType,
        };
        return restricted
          ? ingestFile(ctx.org.id, input, {
              maxDrafts: TRIAL_INGEST_BUDGET.maxDrafts,
              activeDraftCap: TRIAL_KNOWLEDGE_LIMITS.facts,
            })
          : ingestFile(ctx.org.id, input);
      },
      (value) => value.drafts > 0
    );
    recordAudit(ctx, "knowledge.file_imported", file.name);
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    if (restricted && result.capacityReached && result.drafts === 0) {
      return { ok: false, message: TRIAL_IMPORT_LIMIT_MESSAGE };
    }
    if (result.drafts === 0) {
      return { ok: true, message: "Read the file but found nothing new to import." };
    }
    return {
      ok: true,
      message: `Found ${result.drafts} fact${
        result.drafts === 1 ? "" : "s"
      } in ${file.name} — review them below.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/** Approve one imported draft → it becomes live agent knowledge. */
export async function approveDraftAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const update = (client: Pick<typeof prisma, "knowledgeEntry">) =>
      client.knowledgeEntry.updateMany({
        where: { id, orgId: ctx.org.id, status: "draft" },
        data: { status: "active" },
      });
    const updated = restricted
      ? await prisma.$transaction(async (tx) => {
          const result = await update(tx);
          if (result.count > 0) {
            await activateTrialAgentIfGrounded(ctx, tx);
          }
          return result;
        })
      : await update(prisma);
    if (updated.count === 0) return { ok: false, message: "Draft not found." };
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    return { ok: true, message: "Fact approved." };
  } catch (err) {
    return fail(err);
  }
}

/** Discard one imported draft (kept as archived for the audit trail). */
export async function discardDraftAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const updated = await prisma.knowledgeEntry.updateMany({
      where: { id, orgId: ctx.org.id, status: "draft" },
      data: { status: "archived" },
    });
    if (updated.count === 0) return { ok: false, message: "Draft not found." };
    revalidatePath("/agent");
    return { ok: true, message: "Draft discarded." };
  } catch (err) {
    return fail(err);
  }
}

/** Approve every pending draft in one tap. */
export async function approveAllDraftsAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const update = (client: Pick<typeof prisma, "knowledgeEntry">) =>
      client.knowledgeEntry.updateMany({
        where: { orgId: ctx.org.id, status: "draft" },
        data: { status: "active" },
      });
    const updated = restricted
      ? await prisma.$transaction(async (tx) => {
          const result = await update(tx);
          if (result.count > 0) {
            await activateTrialAgentIfGrounded(ctx, tx);
          }
          return result;
        })
      : await update(prisma);
    recordAudit(ctx, "knowledge.drafts_approved", String(updated.count));
    revalidatePath("/agent");
    if (updated.count > 0) revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Approved ${updated.count} fact${updated.count === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/** Reject every pending draft in one tap. Archived, not deleted, so a bad
 * import stays in the audit trail and nothing is lost irrecoverably. */
export async function discardAllDraftsAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const updated = await prisma.knowledgeEntry.updateMany({
      where: { orgId: ctx.org.id, status: "draft" },
      data: { status: "archived" },
    });
    if (updated.count === 0) {
      return { ok: false, message: "There are no drafts to discard." };
    }
    recordAudit(ctx, "knowledge.drafts_discarded", String(updated.count));
    revalidatePath("/agent");
    return {
      ok: true,
      message: `Discarded ${updated.count} fact${updated.count === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * One-click migration: distill the legacy businessInfo blob into facts.
 *
 * Writes through `storeKnowledgeFacts`, not a bare `createMany`, so its dedupe
 * applies: this used to insert whatever the distiller returned every time it
 * was pressed, and the card that offers it showed on migrated orgs forever, so
 * a second press bought a second copy of the same information. The dedupe is on
 * normalised fact text, which catches a re-press verbatim; a re-worded
 * distillation of the same sentence is past what it can see, which is why the
 * card retiring (see /agent) is the other half of this fix.
 */
export async function structureExistingInfoAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    if (await isRestrictedAcquisitionTrial(ctx.org.id)) {
      return {
        ok: false,
        message: "This AI knowledge tool is available on paid plans.",
      };
    }
    const profile = await prisma.agentProfile.findUnique({
      where: { orgId: ctx.org.id },
      select: { businessInfo: true },
    });
    const blob = profile?.businessInfo.trim();
    if (!blob)
      return { ok: false, message: "There's no existing info to structure." };

    const chunks = blob
      .split(/\n\s*\n/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 40);
    const distilled: DistilledFact[] = [];
    for (const chunk of chunks) {
      distilled.push(
        ...(await distillAnswer("General business information", chunk, ctx.org.id))
      );
    }
    // One store for the whole blob: the dedupe then sees the chunks against each
    // other as well as against what the org already has.
    const { created } = distilled.length
      ? await storeKnowledgeFacts(ctx.org.id, distilled, {
          source: "import",
          status: "active",
        })
      : { created: 0 };
    revalidatePath("/agent");
    if (created === 0) {
      return {
        ok: true,
        message: "Your existing info is already in the fact library — nothing new to add.",
      };
    }
    return {
      ok: true,
      message: `Structured ${created} fact${created === 1 ? "" : "s"} from your existing info.`,
    };
  } catch (err) {
    return fail(err);
  }
}
