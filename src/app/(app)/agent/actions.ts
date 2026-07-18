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
import { distillAnswer } from "@/modules/knowledge/distill";

export interface ActionResult {
  ok: boolean;
  message: string;
}

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
    await prisma.knowledgeEntry.create({
      data: {
        orgId: ctx.org.id,
        category: input.category,
        fact: fact.slice(0, 300),
        condition: input.condition?.trim().slice(0, 120) || null,
        source: "manual",
      },
    });
    revalidatePath("/agent");
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

/** One-click migration: distill the legacy businessInfo blob into facts. */
export async function structureExistingInfoAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
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
    let count = 0;
    for (const chunk of chunks) {
      const facts = await distillAnswer("General business information", chunk);
      await prisma.knowledgeEntry.createMany({
        data: facts.map((f) => ({
          orgId: ctx.org.id,
          category: f.category,
          fact: f.fact,
          condition: f.condition ?? null,
          source: "import",
        })),
      });
      count += facts.length;
    }
    revalidatePath("/agent");
    return {
      ok: true,
      message: `Structured ${count} fact${count === 1 ? "" : "s"} from your existing info.`,
    };
  } catch (err) {
    return fail(err);
  }
}
