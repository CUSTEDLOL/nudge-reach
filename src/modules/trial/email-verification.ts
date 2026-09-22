import "server-only";
import { prisma } from "@/lib/db";

export async function markAcquisitionTrialEmailVerified(input: {
  userId: string;
  email: string;
  now?: Date;
}): Promise<boolean> {
  const emailNormalized = input.email?.trim().toLowerCase();
  if (!input.userId || !emailNormalized) return false;

  const now = input.now ?? new Date();
  const updated = await prisma.acquisitionTrial.updateMany({
    where: {
      emailNormalized,
      emailVerifiedAt: null,
      claimedAt: { not: null },
      orgId: { not: null },
      org: { memberships: { some: { userId: input.userId } } },
    },
    data: { emailVerifiedAt: now },
  });

  return updated.count === 1;
}
