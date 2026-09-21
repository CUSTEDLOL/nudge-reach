"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { distillAnswer } from "@/modules/knowledge/distill";
import { scriptItemById } from "@/modules/knowledge/questionnaire";
import { parseHoursText } from "@/modules/calendar/hours-text";
import { settingsWithOpeningHours } from "@/modules/calendar/hours-store";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import {
  TRIAL_INTERVIEW_IDS,
  withTrialKnowledgeSource,
} from "@/modules/trial/knowledge";

/**
 * The weekly-hours answer is the one answer that has to be more than a fact:
 * it is what stops the AI booking a 3 am Sunday slot. Read it deterministically;
 * when the phrasing can't be read, leave hours unset (the owner can fill the
 * editor on Setup) rather than store a guess.
 */
async function rememberOpeningHours(orgId: string, id: string, answer: string) {
  if (id !== "hours_weekly") return;
  const hours = parseHoursText(answer);
  if (!hours) return;
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { settings: true } });
  await prisma.org.update({
    where: { id: orgId },
    data: { settings: settingsWithOpeningHours(org?.settings, hours) },
  });
}

export interface QuestionnaireResult {
  ok: boolean;
  message: string;
  /** Facts created by this submission. */
  facts?: number;
}

async function vertical(orgId: string): Promise<string> {
  const profile = await prisma.agentProfile.findUnique({
    where: { orgId },
    select: { vertical: true },
  });
  if (profile?.vertical) return profile.vertical;
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { vertical: true },
  });
  return org?.vertical ?? "other";
}

async function distillOne(
  orgId: string,
  v: string,
  id: string,
  answer: string
): Promise<number> {
  const item = scriptItemById(v, id);
  const trimmed = answer.trim();
  if (!item || !trimmed) return 0;
  await rememberOpeningHours(orgId, id, trimmed);
  const facts = await distillAnswer(item.prompt, trimmed, orgId);
  // The script knows the section; prefer it when the model punted to "other".
  await prisma.knowledgeEntry.createMany({
    data: facts.map((f) => ({
      orgId,
      category: f.category === "other" ? item.category : f.category,
      fact: f.fact,
      condition: f.condition ?? null,
      source: "questionnaire",
    })),
  });
  return facts.length;
}

/** Interview mode: one answer at a time. */
export async function submitQuestionnaireAnswerAction(
  id: string,
  answer: string
): Promise<QuestionnaireResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    if (await isRestrictedAcquisitionTrial(ctx.org.id)) {
      return {
        ok: false,
        message: "Use the 5-question trial setup so your answers are saved together",
      };
    }
    const facts = await distillOne(
      ctx.org.id,
      await vertical(ctx.org.id),
      id,
      answer
    );
    revalidatePath("/agent");
    return {
      ok: true,
      facts,
      message: facts ? `Learned ${facts} fact${facts === 1 ? "" : "s"}.` : "Skipped.",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Form mode: everything at once. */
export async function submitQuestionnaireAction(
  answers: { id: string; answer: string }[]
): Promise<QuestionnaireResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const restricted = await isRestrictedAcquisitionTrial(ctx.org.id);
    const allowedIds = new Set<string>(TRIAL_INTERVIEW_IDS);
    const seenIds = new Set<string>();
    const selected = restricted
      ? answers.filter((answer) => {
          if (!allowedIds.has(answer.id) || seenIds.has(answer.id)) return false;
          seenIds.add(answer.id);
          return true;
        })
      : answers.slice(0, 40);
    const result = await withTrialKnowledgeSource(
      ctx.org.id,
      "interview",
      async () => {
        const v = await vertical(ctx.org.id);
        let facts = 0;
        for (const answer of selected) {
          facts += await distillOne(ctx.org.id, v, answer.id, answer.answer);
        }
        return { facts };
      },
      (value) => value.facts > 0
    );
    revalidatePath("/agent");
    return {
      ok: true,
      facts: result.facts,
      message: `Done — your AI learned ${result.facts} fact${
        result.facts === 1 ? "" : "s"
      }.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
