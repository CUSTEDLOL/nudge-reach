import { prisma } from "@/lib/db";
import { founderAudit, withReason } from "@/modules/admin/audit";
import { PLANS, type PlanId } from "@/modules/billing/plans";

/**
 * The founder panel's ONE mutation: change an org's plan. Shared semantics
 * with scripts/set-plan.ts (plan validated against PLANS; before → after
 * reported). Every change leaves a plainly-labeled AuditLog row — founders
 * are not org members, so the row is written directly rather than through
 * recordAudit (which needs an org membership context).
 */

export type SetPlanResult =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string };

export function isValidPlanId(plan: string): plan is PlanId {
  return PLANS.some((p) => p.id === plan);
}

export async function setOrgPlan(
  orgId: string,
  plan: string,
  founderEmail: string,
  reason?: string
): Promise<SetPlanResult> {
  if (!isValidPlanId(plan)) {
    return { ok: false, error: `Unknown plan "${plan}".` };
  }
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, plan: true },
  });
  if (!org) return { ok: false, error: "Org not found." };
  if (org.plan === plan) return { ok: false, error: `Already on ${plan}.` };

  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { plan } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.plan_changed",
      org.name,
      withReason(`${org.plan} → ${plan}`, reason),
      tx
    );
  });
  return { ok: true, from: org.plan, to: plan };
}
