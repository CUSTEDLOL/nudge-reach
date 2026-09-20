import { prisma } from "@/lib/db";
import { deriveTrialStatus, type TrialStatus } from "./state";

export interface TrialReplySummary {
  status: TrialStatus;
  repliesUsed: number;
  replyLimit: number;
  repliesRemaining: number;
}

export async function reserveTrialReply(orgId: string, now = new Date()) {
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    include: { org: { select: { subscriptionStatus: true } } },
  });
  if (
    !trial
    || trial.convertedAt
    || trial.org?.subscriptionStatus === "active"
  ) {
    return { kind: "not_trial" as const };
  }

  const status = deriveTrialStatus(
    {
      orgId: trial.orgId,
      claimedAt: trial.claimedAt,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      repliesUsed: trial.repliesUsed,
      replyLimit: trial.replyLimit,
      convertedAt: trial.convertedAt,
      subscriptionStatus: trial.org?.subscriptionStatus ?? "inactive",
    },
    now
  );
  if (status !== "active") {
    return { kind: "blocked" as const, status };
  }

  const reserved = await prisma.acquisitionTrial.updateMany({
    where: {
      id: trial.id,
      convertedAt: null,
      expiresAt: { gt: now },
      repliesUsed: { lt: trial.replyLimit },
    },
    data: { repliesUsed: { increment: 1 } },
  });
  if (reserved.count !== 1) {
    return { kind: "blocked" as const, status: "exhausted" as const };
  }

  const repliesUsed = trial.repliesUsed + 1;
  return {
    kind: "reserved" as const,
    trialId: trial.id,
    repliesUsed,
    replyLimit: trial.replyLimit,
    repliesRemaining: Math.max(0, trial.replyLimit - repliesUsed),
  };
}

export async function refundTrialReply(trialId: string): Promise<void> {
  await prisma.acquisitionTrial.updateMany({
    where: { id: trialId, repliesUsed: { gt: 0 } },
    data: { repliesUsed: { decrement: 1 } },
  });
}

export async function trialReplySummary(
  orgId: string,
  now = new Date()
): Promise<TrialReplySummary | undefined> {
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    include: { org: { select: { subscriptionStatus: true } } },
  });
  if (
    !trial
    || trial.convertedAt
    || trial.org?.subscriptionStatus === "active"
  ) {
    return undefined;
  }

  const status = deriveTrialStatus(
    {
      orgId: trial.orgId,
      claimedAt: trial.claimedAt,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      repliesUsed: trial.repliesUsed,
      replyLimit: trial.replyLimit,
      convertedAt: trial.convertedAt,
      subscriptionStatus: trial.org?.subscriptionStatus ?? "inactive",
    },
    now
  );

  return {
    status,
    repliesUsed: trial.repliesUsed,
    replyLimit: trial.replyLimit,
    repliesRemaining: Math.max(0, trial.replyLimit - trial.repliesUsed),
  };
}
