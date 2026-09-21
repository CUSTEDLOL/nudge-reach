"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";

export interface CompleteTrialSetupResult {
  ok: false;
  message: string;
}

class TrialSetupError extends Error {}

export async function completeTrialSetupAction(): Promise<CompleteTrialSetupResult> {
  const ctx = await requireOrgContext();

  try {
    requireRole(ctx, "ADMIN");
    await prisma.$transaction(async (tx) => {
      const trial = await tx.acquisitionTrial.findUnique({
        where: { orgId: ctx.org.id },
        select: {
          id: true,
          convertedAt: true,
          org: { select: { subscriptionStatus: true } },
        },
      });
      if (
        !trial ||
        trial.convertedAt ||
        trial.org?.subscriptionStatus === "active"
      ) {
        throw new TrialSetupError("This free-trial setup is no longer available.");
      }

      const facts = await tx.knowledgeEntry.count({
        where: { orgId: ctx.org.id, status: "active" },
      });
      if (facts < 1) {
        throw new TrialSetupError(
          "Approve at least one business fact before opening your trial.",
        );
      }

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
      await tx.org.update({
        where: { id: ctx.org.id },
        data: { onboardedAt: new Date() },
      });
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof TrialSetupError
          ? error.message
          : "Couldn't finish your trial setup. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agent");
  redirect("/dashboard");
}
