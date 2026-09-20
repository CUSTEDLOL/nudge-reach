import type { Membership, Org, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { trialGrant } from "@/modules/billing/credits";
import { hashClaimToken } from "./signup";
import { trialEndsAt } from "./state";

export type TrialClaim = { trialId: string; claimToken: string };

export function parseTrialClaimMetadata(raw: unknown): TrialClaim | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;
  const trialId = value.acquisition_trial_id;
  const claimToken = value.acquisition_trial_token;
  if (
    typeof trialId !== "string"
    || !/^[A-Za-z0-9_-]{1,128}$/.test(trialId)
  ) {
    return null;
  }
  if (
    typeof claimToken !== "string"
    || !/^[A-Za-z0-9_-]{40,128}$/.test(claimToken)
  ) {
    return null;
  }

  return { trialId, claimToken };
}

export async function claimAcquisitionTrial(input: {
  userId: string;
  email: string;
  claim: TrialClaim;
  now?: Date;
}): Promise<{ org: Org; membership: Membership } | null> {
  const now = input.now ?? new Date();
  const emailNormalized = input.email.trim().toLowerCase();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const trial = await tx.acquisitionTrial.findFirst({
      where: {
        id: input.claim.trialId,
        claimTokenHash: hashClaimToken(input.claim.claimToken),
        emailNormalized,
        claimedAt: null,
        claimExpiresAt: { gt: now },
      },
    });
    if (!trial) return null;

    const expiresAt = trialEndsAt(now);
    const org = await tx.org.create({
      data: {
        ownerUserId: input.userId,
        name: trial.businessName,
        plan: "free",
        simulated: true,
        trialEndsAt: expiresAt,
        memberships: {
          create: {
            userId: input.userId,
            email: input.email,
            displayName: trial.ownerName,
            role: "OWNER",
          },
        },
        creditGrants: { create: trialGrant(expiresAt) },
      },
      include: { memberships: true },
    });
    const claimed = await tx.acquisitionTrial.updateMany({
      where: { id: trial.id, claimedAt: null },
      data: { orgId: org.id, claimedAt: now, startedAt: now, expiresAt },
    });
    if (claimed.count !== 1) throw new Error("Trial was already claimed.");

    const { memberships, ...orgRow } = org;
    return { org: orgRow, membership: memberships[0] };
  });
}
