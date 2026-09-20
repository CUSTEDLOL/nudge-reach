import { prisma } from "@/lib/db";

export const TRIAL_INTERVIEW_IDS = [
  "business_summary",
  "services_list",
  "hours_weekly",
  "location_address",
  "faq_1",
] as const;

export const TRIAL_INGEST_BUDGET = {
  maxSubpages: 1,
  maxChunksPerPage: 2,
  maxDrafts: 25,
} as const;

export async function withTrialKnowledgeSource<T>(
  orgId: string,
  source: "website" | "gbp" | "file" | "interview",
  work: () => Promise<T>,
  succeeded: (result: T) => boolean
): Promise<T> {
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    include: { org: { select: { subscriptionStatus: true } } },
  });
  if (
    !trial
    || trial.convertedAt
    || trial.org?.subscriptionStatus === "active"
  ) {
    return work();
  }
  if (trial.knowledgeSourceUsedAt) {
    throw new Error(
      "Your trial already used its setup source. You can still edit the facts it learned."
    );
  }

  const reserved = await prisma.acquisitionTrial.updateMany({
    where: { id: trial.id, knowledgeSource: null, knowledgeSourceUsedAt: null },
    data: { knowledgeSource: source },
  });
  if (reserved.count !== 1) {
    throw new Error("Another setup source is already running.");
  }

  try {
    const result = await work();
    if (succeeded(result)) {
      await prisma.acquisitionTrial.update({
        where: { id: trial.id },
        data: { knowledgeSource: source, knowledgeSourceUsedAt: new Date() },
      });
    } else {
      await prisma.acquisitionTrial.updateMany({
        where: {
          id: trial.id,
          knowledgeSource: source,
          knowledgeSourceUsedAt: null,
        },
        data: { knowledgeSource: null },
      });
    }
    return result;
  } catch (error) {
    await prisma.acquisitionTrial.updateMany({
      where: {
        id: trial.id,
        knowledgeSource: source,
        knowledgeSourceUsedAt: null,
      },
      data: { knowledgeSource: null },
    });
    throw error;
  }
}
