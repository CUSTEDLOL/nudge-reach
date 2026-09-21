import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { questionnaireScript } from "@/modules/knowledge/questionnaire";
import { TRIAL_INTERVIEW_IDS } from "@/modules/trial/knowledge";
import { requireAcquisitionTrial } from "@/modules/trial/workspace";
import { TrialSetup } from "./trial-setup";

export const metadata: Metadata = { title: "Set up your free trial" };

export default async function TrialSetupPage() {
  const ctx = await requireOrgContext();
  const workspace = await requireAcquisitionTrial(ctx.org.id);
  if (workspace.setupComplete) redirect("/dashboard");

  const drafts = await prisma.knowledgeEntry.findMany({
    where: { orgId: ctx.org.id, status: "draft" },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: {
      id: true,
      category: true,
      fact: true,
      condition: true,
    },
  });
  const allowed = new Set<string>(TRIAL_INTERVIEW_IDS);
  const questions = questionnaireScript(ctx.org.vertical ?? "other")
    .filter((question) => allowed.has(question.id))
    .map(({ id, prompt, placeholder }) => ({ id, prompt, placeholder }));

  return <TrialSetup workspace={workspace} drafts={drafts} questions={questions} />;
}
