"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { isTrialTourStep } from "@/modules/trial/tour";

interface TrialTourActionResult {
  ok: boolean;
  message?: string;
}

async function activeTrialForCurrentOrg() {
  const { org } = await requireOrgContext();
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId: org.id },
    select: { id: true, convertedAt: true },
  });
  if (!trial || trial.convertedAt) return null;
  return { orgId: org.id, trialId: trial.id };
}

async function updateActiveTrial(
  data: {
    tourStep?: string;
    tourCompletedAt?: Date | null;
    tourDismissedAt?: Date | null;
  },
): Promise<TrialTourActionResult> {
  const active = await activeTrialForCurrentOrg();
  if (!active) return { ok: false, message: "Trial not found." };

  const updated = await prisma.acquisitionTrial.updateMany({
    where: {
      id: active.trialId,
      orgId: active.orgId,
      convertedAt: null,
    },
    data,
  });
  if (updated.count !== 1) return { ok: false, message: "Trial not found." };
  revalidatePath("/dashboard");
  return { ok: true };
}

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

export async function saveTrialTourStepAction(
  step: string,
): Promise<TrialTourActionResult> {
  if (!isTrialTourStep(step)) {
    return { ok: false, message: "Unknown tour step." };
  }
  return updateActiveTrial({ tourStep: step });
}

export async function dismissTrialTourAction(): Promise<TrialTourActionResult> {
  return updateActiveTrial({ tourDismissedAt: new Date() });
}

export async function completeTrialTourAction(): Promise<TrialTourActionResult> {
  return updateActiveTrial({
    tourStep: "finish",
    tourCompletedAt: new Date(),
  });
}

export async function restartTrialTourAction(): Promise<TrialTourActionResult> {
  return updateActiveTrial({
    tourStep: "welcome",
    tourDismissedAt: null,
    tourCompletedAt: null,
  });
}
