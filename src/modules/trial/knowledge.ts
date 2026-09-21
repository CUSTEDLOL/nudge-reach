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

export const TRIAL_KNOWLEDGE_LIMITS = {
  webImports: 1,
  fileImports: 3,
  facts: 50,
} as const;

export type TrialKnowledgeImportSource = "website" | "gbp" | "file";

async function reserveImport(
  trialId: string,
  source: TrialKnowledgeImportSource,
) {
  if (source === "file") {
    return prisma.acquisitionTrial.updateMany({
      where: {
        id: trialId,
        convertedAt: null,
        knowledgeFileImportsUsed: { lt: TRIAL_KNOWLEDGE_LIMITS.fileImports },
      },
      data: { knowledgeFileImportsUsed: { increment: 1 } },
    });
  }
  return prisma.acquisitionTrial.updateMany({
    where: {
      id: trialId,
      convertedAt: null,
      knowledgeWebImportsUsed: { lt: TRIAL_KNOWLEDGE_LIMITS.webImports },
    },
    data: { knowledgeWebImportsUsed: { increment: 1 } },
  });
}

async function refundImport(
  trialId: string,
  source: TrialKnowledgeImportSource,
) {
  if (source === "file") {
    await prisma.acquisitionTrial.updateMany({
      where: { id: trialId, knowledgeFileImportsUsed: { gt: 0 } },
      data: { knowledgeFileImportsUsed: { decrement: 1 } },
    });
    return;
  }
  await prisma.acquisitionTrial.updateMany({
    where: { id: trialId, knowledgeWebImportsUsed: { gt: 0 } },
    data: { knowledgeWebImportsUsed: { decrement: 1 } },
  });
}

function quotaMessage(source: TrialKnowledgeImportSource) {
  return source === "file"
    ? "Your free trial includes three file imports."
    : "Your free trial includes one website or Google Business Profile import.";
}

export async function withTrialKnowledgeImport<T>(
  orgId: string,
  source: TrialKnowledgeImportSource,
  work: () => Promise<T>,
  succeeded: (result: T) => boolean,
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

  const reserved = await reserveImport(trial.id, source);
  if (reserved.count !== 1) {
    throw new Error(quotaMessage(source));
  }

  let result: T;
  let successful: boolean;
  try {
    result = await work();
    successful = succeeded(result);
  } catch (error) {
    try {
      await refundImport(trial.id, source);
    } catch (refundError) {
      console.error(
        "[trial] knowledge quota refund failed",
        { orgId, source },
        refundError,
      );
    }
    throw error;
  }

  if (!successful) {
    await refundImport(trial.id, source);
    return result;
  }

  try {
    await prisma.acquisitionTrial.updateMany({
      where: { id: trial.id, knowledgeSourceUsedAt: null },
      data: { knowledgeSource: source, knowledgeSourceUsedAt: new Date() },
    });
  } catch (error) {
    console.error(
      "[trial] knowledge attribution failed",
      { orgId, source },
      error,
    );
  }
  return result;
}
