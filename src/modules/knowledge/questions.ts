import { prisma } from "@/lib/db";
import { recordAudit } from "@/modules/orgs/audit";
import { requireRole, type OrgContext } from "@/modules/orgs/auth";
import { questionKey } from "./normalize";
import { distillAnswer } from "./distill";
import { sendKnowledgeFollowUps } from "./followups";

/**
 * Owner-question lifecycle (learn-on-the-job). Deduped per org on the
 * normalized question key: ten customers asking "do you have chicken?"
 * become ONE pending question, and each waiter is recorded so every open
 * conversation gets a follow-up when the answer arrives.
 */

export interface Waiter {
  conversationId: string;
  contactId: string;
  askedAt: string;
  followedUpAt?: string;
}

/** Pure, defensive: the `waiting` Json column → typed waiters. */
export function parseWaiting(json: unknown): Waiter[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (w): w is Waiter =>
      typeof w === "object" &&
      w !== null &&
      typeof (w as Waiter).conversationId === "string" &&
      typeof (w as Waiter).contactId === "string" &&
      typeof (w as Waiter).askedAt === "string"
  );
}

/** Pure: add a waiter unless that conversation is already waiting. */
export function appendWaiter(waiting: Waiter[], w: Waiter): Waiter[] {
  if (waiting.some((x) => x.conversationId === w.conversationId))
    return waiting;
  return [...waiting, w];
}

export async function askOwner(
  ctx: { orgId: string; conversationId: string; contactId: string },
  question: string
): Promise<{ status: "queued" | "already_queued" }> {
  const cleaned = question.trim();
  const key = questionKey(cleaned) || cleaned.toLowerCase();
  const waiter: Waiter = {
    conversationId: ctx.conversationId,
    contactId: ctx.contactId,
    askedAt: new Date().toISOString(),
  };

  const existing = await prisma.ownerQuestion.findFirst({
    where: { orgId: ctx.orgId, questionKey: key, status: "pending" },
  });
  if (existing) {
    await prisma.ownerQuestion.update({
      where: { id: existing.id },
      data: {
        askCount: { increment: 1 },
        waiting: appendWaiter(parseWaiting(existing.waiting), waiter) as never,
      },
    });
    return { status: "already_queued" };
  }

  await prisma.ownerQuestion.create({
    data: {
      orgId: ctx.orgId,
      question: cleaned,
      questionKey: key,
      waiting: [waiter] as never,
    },
  });
  return { status: "queued" };
}

export async function answerOwnerQuestion(
  orgCtx: OrgContext,
  questionId: string,
  answerText: string
): Promise<{ facts: number; followUpsSent: number }> {
  requireRole(orgCtx, "ADMIN");
  const trimmed = answerText.trim();
  if (!trimmed) throw new Error("Answer cannot be empty.");

  const q = await prisma.ownerQuestion.findFirst({
    where: { id: questionId, orgId: orgCtx.org.id, status: "pending" },
  });
  if (!q) throw new Error("Question not found or already handled.");

  const facts = await distillAnswer(q.question, trimmed, orgCtx.org.id);
  const entries = await prisma.knowledgeEntry.createManyAndReturn({
    data: facts.map((f) => ({
      orgId: orgCtx.org.id,
      category: f.category,
      fact: f.fact,
      condition: f.condition ?? null,
      source: "owner_answer",
    })),
    select: { id: true },
  });

  const { sent, waiting } = await sendKnowledgeFollowUps(
    orgCtx.org.id,
    parseWaiting(q.waiting),
    facts
  );

  await prisma.ownerQuestion.update({
    where: { id: q.id },
    data: {
      status: "answered",
      answerText: trimmed,
      entryIds: entries.map((e) => e.id),
      answeredAt: new Date(),
      waiting: waiting as never,
    },
  });
  recordAudit(orgCtx, "knowledge.answered", q.question);

  return { facts: facts.length, followUpsSent: sent };
}

export async function dismissOwnerQuestion(
  orgCtx: OrgContext,
  questionId: string
): Promise<void> {
  requireRole(orgCtx, "ADMIN");
  const updated = await prisma.ownerQuestion.updateMany({
    where: { id: questionId, orgId: orgCtx.org.id, status: "pending" },
    data: { status: "dismissed" },
  });
  if (updated.count === 0)
    throw new Error("Question not found or already handled.");
  recordAudit(orgCtx, "knowledge.dismissed", questionId);
}
