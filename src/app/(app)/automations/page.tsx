import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { parseKeywordConfig } from "@/modules/automation/definitions";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { getRecoveryMetrics } from "@/modules/followup/metrics";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AutomationsList, type AutomationRow } from "./automations-list";
import { RevenueRecoveryCard } from "./revenue-recovery-card";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const { org, role } = await requireOrgContext();
  const canManage = hasRole(role, "ADMIN");

  const recovery = await getRecoveryMetrics(org.id);
  const hasFrontDesk = planHasAiFrontDesk(org.plan);

  const automations = await prisma.automation.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { steps: true, runs: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, status: true },
      },
    },
  });

  const rows: AutomationRow[] = automations.map((automation) => ({
    id: automation.id,
    name: automation.name,
    description: automation.description,
    trigger: automation.trigger,
    keywords:
      automation.trigger === "keyword"
        ? parseKeywordConfig(automation.triggerConfig).keywords
        : [],
    stepsCount: automation._count.steps,
    runsCount: automation._count.runs,
    enabled: automation.enabled,
    lastRunAt: automation.runs[0]?.createdAt.toISOString() ?? null,
    lastRunStatus: automation.runs[0]?.status ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Automations"
        description="Trigger-based flows: welcome messages, keyword replies and follow-ups."
        actions={
          canManage && (
            <Link href="/automations/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" aria-hidden />
              New automation
            </Link>
          )
        }
      />
      <div className="mb-6">
        <RevenueRecoveryCard
          enabled={recovery.enabled}
          hasFrontDesk={hasFrontDesk}
          bookingsThisMonth={recovery.bookingsThisMonth}
          followUpsThisMonth={recovery.followUpsThisMonth}
          canManage={canManage}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-5 w-5" aria-hidden />}
          title="No automations yet"
          description="Answer FAQs instantly, welcome new contacts and route VIPs — without lifting a finger."
          action={
            canManage && (
              <Link href="/automations/new" className={buttonVariants()}>
                <Plus className="h-4 w-4" aria-hidden />
                Create your first automation
              </Link>
            )
          }
        />
      ) : (
        <AutomationsList rows={rows} canManage={canManage} />
      )}
    </>
  );
}
