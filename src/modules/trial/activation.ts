import { prisma } from "@/lib/db";
import { requireRole, type OrgContext } from "@/modules/orgs/auth";
import type { Prisma } from "@prisma/client";

export type TrialActivationResult =
  | { status: "activated" }
  | { status: "no_knowledge" }
  | { status: "not_restricted" };

type TrialActivationTransaction = Pick<
  Prisma.TransactionClient,
  "acquisitionTrial" | "knowledgeEntry" | "agentProfile" | "org"
>;

async function activateInTransaction(
  ctx: OrgContext,
  tx: TrialActivationTransaction,
): Promise<TrialActivationResult> {
  const trial = await tx.acquisitionTrial.findUnique({
    where: { orgId: ctx.org.id },
    select: {
      id: true,
      convertedAt: true,
      org: { select: { subscriptionStatus: true } },
    },
  });
  if (
    !trial
    || trial.convertedAt
    || !trial.org
    || trial.org.subscriptionStatus === "active"
  ) {
    return { status: "not_restricted" };
  }

  const approvedFacts = await tx.knowledgeEntry.count({
    where: { orgId: ctx.org.id, status: "active" },
  });
  if (approvedFacts < 1) return { status: "no_knowledge" };

  await tx.agentProfile.upsert({
    where: { orgId: ctx.org.id },
    create: {
      orgId: ctx.org.id,
      enabled: true,
      vertical: ctx.org.vertical ?? "other",
      businessName: ctx.org.name,
    },
    update: { enabled: true },
  });
  await tx.org.updateMany({
    where: { id: ctx.org.id, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });
  return { status: "activated" };
}

/** Enable the trial agent only after the owner has approved grounded facts. */
export async function activateTrialAgentIfGrounded(
  ctx: OrgContext,
  transaction?: TrialActivationTransaction,
): Promise<TrialActivationResult> {
  requireRole(ctx, "ADMIN");
  if (transaction) return activateInTransaction(ctx, transaction);
  return prisma.$transaction((tx) => activateInTransaction(ctx, tx));
}
