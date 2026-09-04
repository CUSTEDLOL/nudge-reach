import { prisma } from "@/lib/db";
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
  founderEmail: string
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

  await prisma.org.update({ where: { id: org.id }, data: { plan } });
  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      actorUserId: "founder",
      actorName: `founder:${founderEmail}`,
      action: "admin.plan_changed",
      target: org.name,
      detail: `${org.plan} → ${plan}`,
    },
  });
  return { ok: true, from: org.plan, to: plan };
}
