import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { parseKeywordConfig } from "@/modules/automation/definitions";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { getRecoveryMetrics } from "@/modules/followup/metrics";
import {
  getFollowUpConfig,
  getPackTemplateIds,
  LEAD_NUDGE_NAME,
} from "@/modules/followup/install";
import { FOLLOW_UP_KINDS, normalizeTiming } from "@/modules/followup/pack";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AutomationsList, type AutomationRow } from "./automations-list";
import { RevenueRecoveryCard } from "./revenue-recovery-card";
import { FollowUpRows, type FollowUpRow } from "./follow-up-rows";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const { org, role } = await requireOrgContext();
  const canManage = hasRole(role, "ADMIN");
  const hasFrontDesk = planHasAiFrontDesk(org.plan);

  const [recovery, config, packTemplates, automations] = await Promise.all([
    getRecoveryMetrics(org.id),
    getFollowUpConfig(org.id),
    getPackTemplateIds(org.id),
    prisma.automation.findMany({
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
    }),
  ]);

  const packAutomation = automations.find((a) => a.name === LEAD_NUDGE_NAME);
  const timing = normalizeTiming(config ?? {});

  // The pack's four follow-ups, each with the templates whose wording it sends.
  const followUps: FollowUpRow[] = config
    ? FOLLOW_UP_KINDS.map((kind) => ({
        flag: kind.flag,
        label: kind.label,
        timing: kind.timing,
        description: kind.description,
        enabled: config[kind.flag],
        timingFields: [...kind.timingFields],
        builderHref:
          kind.editableInBuilder && packAutomation
            ? `/automations/${packAutomation.id}`
            : undefined,
        templates: kind.templateNames.flatMap((name) => {
          const row = packTemplates.get(name);
          return row ? [{ id: row.id, name, status: row.metaStatus }] : [];
        }),
      }))
    : [];

  // The pack's automation is already shown as a row above — listing it here too
  // gave the same follow-up two switches.
  const rows: AutomationRow[] = automations
    .filter((a) => a.name !== LEAD_NUDGE_NAME)
    .map((automation) => ({
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
        title="Follow-ups"
        description="Automatic reminders and re-engagement. Nudge chases every booking, no-show and quiet lead for you, so nobody slips through."
        actions={
          canManage && (
            <Link href="/automations/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" aria-hidden />
              New follow-up
            </Link>
          )
        }
      />

      <RevenueRecoveryCard
        enabled={recovery.enabled}
        hasFrontDesk={hasFrontDesk}
        bookingsThisMonth={recovery.bookingsThisMonth}
        followUpsThisMonth={recovery.followUpsThisMonth}
        canManage={canManage}
      />

      {followUps.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-900">
            Follow-ups around appointments
          </h2>
          <p className="mb-2.5 mt-0.5 text-sm text-neutral-500">
            These fire off your bookings — before the appointment, after it, and
            when someone doesn&rsquo;t turn up. Set the hours and edit the wording
            here.
          </p>
          <FollowUpRows
            rows={followUps}
            timing={timing}
            canManage={canManage}
            paused={!recovery.enabled}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-900">
          Follow-ups you build yourself
        </h2>
        <p className="mb-2.5 mt-0.5 text-sm text-neutral-500">
          These start from something a customer does — replies to a campaign,
          sends a keyword, gets tagged — rather than from an appointment.
        </p>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Workflow className="h-5 w-5" aria-hidden />}
            title="You haven't built one yet"
            description="Pick what starts it, add a wait and an approved template, and it runs on autopilot."
            action={
              canManage && (
                <Link href="/automations/new" className={buttonVariants()}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create a follow-up
                </Link>
              )
            }
          />
        ) : (
          <AutomationsList rows={rows} canManage={canManage} />
        )}
      </section>
    </>
  );
}
