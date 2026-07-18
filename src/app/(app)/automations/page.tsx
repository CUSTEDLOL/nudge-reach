import type { Metadata } from "next";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { getRecoveryMetrics } from "@/modules/followup/metrics";
import { PageHeader } from "@/components/ui/page-header";
import { RevenueRecoveryCard } from "./revenue-recovery-card";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const { org, role } = await requireOrgContext();
  const canManage = hasRole(role, "ADMIN");
  const recovery = await getRecoveryMetrics(org.id);
  const hasFrontDesk = planHasAiFrontDesk(org.plan);

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Automatic reminders and re-engagement. Nudge chases every booking, no-show and quiet lead for you, so nobody slips through."
      />
      <RevenueRecoveryCard
        enabled={recovery.enabled}
        hasFrontDesk={hasFrontDesk}
        bookingsThisMonth={recovery.bookingsThisMonth}
        followUpsThisMonth={recovery.followUpsThisMonth}
        canManage={canManage}
      />
    </>
  );
}
