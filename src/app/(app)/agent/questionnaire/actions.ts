"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { distillAnswer } from "@/modules/knowledge/distill";
import { scriptItemById } from "@/modules/knowledge/questionnaire";
import { storeKnowledgeFacts } from "@/modules/knowledge/store";
import { parseHoursText } from "@/modules/calendar/hours-text";
import { settingsWithOpeningHours } from "@/modules/calendar/hours-store";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import {
  TRIAL_INTERVIEW_IDS,
  TRIAL_KNOWLEDGE_LIMITS,
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
  answer: string,
  activeDraftCap?: number,
): Promise<{ facts: number; capacityReached: boolean }> {
  const item = scriptItemById(v, id);
  const trimmed = answer.trim();
  if (!item || !trimmed) return { facts: 0, capacityReached: false };
  await rememberOpeningHours(orgId, id, trimmed);
  const distilled = await distillAnswer(item.prompt, trimmed, orgId);
  // The script knows the section; prefer it when the model punted to "other".
  const facts = distilled.map((fact) => ({
    ...fact,
    category: fact.category === "other" ? item.category : fact.category,
  }));
  if (activeDraftCap !== undefined) {
    const stored = await storeKnowledgeFacts(orgId, facts, {
      source: "questionnaire",
      status: "active",
      activeDraftCap,
    });
    return { facts: stored.created, capacityReached: stored.capacityReached };
  }
  await prisma.knowledgeEntry.createMany({
    data: facts.map((f) => ({
      orgId,
      category: f.category,
      fact: f.fact,
      condition: f.condition ?? null,
      source: "questionnaire",
    })),
  });
  return { facts: facts.length, capacityReached: false };
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
    const result = await distillOne(
      ctx.org.id,
      await vertical(ctx.org.id),
      id,
      answer
    );
    revalidatePath("/agent");
    return {
      ok: true,
      facts: result.facts,
      message: result.facts
        ? `Learned ${result.facts} fact${result.facts === 1 ? "" : "s"}.`
        : "Skipped.",
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
    const v = await vertical(ctx.org.id);
    let facts = 0;
    let capacityReached = false;
    for (const answer of selected) {
      const stored = await distillOne(
        ctx.org.id,
        v,
        answer.id,
        answer.answer,
        restricted ? TRIAL_KNOWLEDGE_LIMITS.facts : undefined,
      );
      facts += stored.facts;
      if (stored.capacityReached) {
        capacityReached = true;
        break;
      }
    }
    const result = { facts, capacityReached };
    revalidatePath("/agent");
    revalidatePath("/dashboard");
    if (restricted && result.capacityReached && result.facts === 0) {
      return {
        ok: false,
        facts: 0,
        message: "Your free trial can store up to 50 facts. Archive a fact before adding another.",
      };
    }
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
