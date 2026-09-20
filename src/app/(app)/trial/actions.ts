"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";

export async function markTrialExploreViewedAction() {
  const { org } = await requireOrgContext();
  await prisma.acquisitionTrial.updateMany({
    where: {
      orgId: org.id,
      convertedAt: null,
      exploreViewedAt: null,
    },
    data: { exploreViewedAt: new Date() },
  });
  revalidatePath("/dashboard");
}
