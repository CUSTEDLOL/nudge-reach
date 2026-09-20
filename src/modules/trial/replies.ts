import { prisma } from "@/lib/db";
import { deriveTrialStatus, type TrialStatus } from "./state";

export interface TrialReplySummary {
  status: TrialStatus;
  repliesUsed: number;
  replyLimit: number;
  repliesRemaining: number;
}

interface TrialMeterableResult {
  /** Present only when a model successfully generated the customer reply. */
  generatedByAi?: true;
}

export type TrialReplyRun<T> =
  | {
      kind: "blocked";
      status: Exclude<TrialStatus, "active">;
      trial?: TrialReplySummary;
    }
  | { kind: "handled"; result: T; trial?: TrialReplySummary };

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
    expiresAt: trial.expiresAt,
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

/**
 * The single acquisition-trial boundary around simulated inbound messages.
 * Both tester entry points use this helper so no direct server action can
 * bypass the seven-day / 15-generated-reply allowance.
 */
export async function withTrialReplyReservation<T extends TrialMeterableResult>(
  orgId: string,
  work: () => Promise<T>,
  now = new Date()
): Promise<TrialReplyRun<T>> {
  const reservation = await reserveTrialReply(orgId, now);
  if (reservation.kind === "blocked") {
    const trial = await trialReplySummary(orgId, now);
    return {
      kind: "blocked",
      status: reservation.status,
      ...(trial ? { trial } : {}),
    };
  }

  let result: T;
  try {
    result = await work();
  } catch (error) {
    if (reservation.kind === "reserved") {
      await refundTrialReply(reservation.trialId).catch(() => {});
    }
    throw error;
  }

  if (reservation.kind !== "reserved") return { kind: "handled", result };

  if (!result.generatedByAi) {
    await refundTrialReply(reservation.trialId);
    return { kind: "handled", result };
  }

  const reservedSummary: TrialReplySummary = {
    status:
      reservation.expiresAt
      && new Date().getTime() >= reservation.expiresAt.getTime()
        ? "expired"
        : reservation.repliesRemaining === 0
          ? "exhausted"
          : "active",
    repliesUsed: reservation.repliesUsed,
    replyLimit: reservation.replyLimit,
    repliesRemaining: reservation.repliesRemaining,
  };
  try {
    const trial = await trialReplySummary(orgId);
    return { kind: "handled", result, trial: trial ?? reservedSummary };
  } catch (error) {
    // The reply is already persisted and its slot was atomically reserved.
    // A follow-up read must never turn that success into a false failure or
    // refund a reply that the customer actually received.
    console.error("[trial] reply summary refresh failed", error);
    return { kind: "handled", result, trial: reservedSummary };
  }
}
