import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { AttentionQueueSection } from "@/components/features/dashboard/attention-queue";
import { BusinessPulse } from "@/components/features/dashboard/business-pulse";
import { FrontDeskSummary } from "@/components/features/dashboard/front-desk-summary";
import { OperationsSummary } from "@/components/features/dashboard/operations-summary";
import { RecentActivity } from "@/components/features/dashboard/recent-activity";
import { SetupProgress } from "@/components/features/dashboard/setup-progress";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  greetingForHour,
  hourInTimezone,
} from "@/modules/dashboard/format";
import { getDashboardData } from "@/modules/dashboard/queries";
import {
  buildAttentionQueue,
  buildOperationsSummary,
  estimateRevenueInfluencedInr,
  shouldRedirectToOnboarding,
} from "@/modules/dashboard/stats";
import {
  deriveWorkspaceDefaults,
  parseWorkspaceProfile,
} from "@/modules/dashboard/workspace-profile";
import { requireOrgContext } from "@/modules/orgs/auth";

export default async function DashboardPage() {
  const { org, membership, email } = await requireOrgContext();
  const now = new Date();
  const isAgent = membership.role === "AGENT";
  const allowedWhatsappAccountIds =
    isAgent && membership.whatsappAccountIds.length > 0
      ? membership.whatsappAccountIds
      : null;
  const data = await getDashboardData(
    org.id,
    org.timezone,
    now,
    allowedWhatsappAccountIds
  );

  if (
    shouldRedirectToOnboarding({
      role: membership.role,
      onboardedAt: org.onboardedAt,
      contactCount: data.contactCount,
    })
  ) {
    redirect("/onboarding");
  }

  const profile = parseWorkspaceProfile(org.settings);
  const workspaceDefaults = deriveWorkspaceDefaults(profile);
  const attention = buildAttentionQueue({
    role: membership.role,
    attentionOrder: workspaceDefaults.attentionOrder,
    handoffCount: data.handoffCount,
    ownerQuestionCount: data.ownerQuestionCount,
    unreadMessageCount: data.unreadMessageCount,
    pendingBookingCount: data.pendingBookingCount,
    pendingPaymentCount: data.pendingPaymentCount,
    followupsEnabled: data.recovery.enabled,
    setupRemaining: data.checklist.total - data.checklist.completed,
  });
  const operations = buildOperationsSummary({
    bookingsToday: data.bookingsToday,
    pendingBookings: data.pendingBookingCount,
    openConversations: data.openConversationCount,
    followUpsThisMonth: data.recovery.followUpsThisMonth,
    pendingPayments: data.pendingPaymentCount,
    pendingPaymentAmountMinor: data.pendingPaymentAmountMinor,
  });
  const visibleOperations = isAgent
    ? operations.filter((item) => item.key === "conversations")
    : operations;
  const firstName =
    (membership.displayName || email.split("@")[0] || "there").split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: org.timezone,
  }).format(now);
  const revenueInfluenced = estimateRevenueInfluencedInr(
    data.wonContactCount,
    org.settings
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-500">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-[1.75rem]">
            {greetingForHour(hourInTimezone(org.timezone, now))}, {firstName}
          </h1>
          <p className="mt-1 text-base leading-6 text-neutral-600">
            Here&apos;s what needs you at {org.name} today.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Badge tone={data.simulationMode ? "info" : "success"}>
            {data.simulationMode ? "Test workspace" : "Live workspace"}
          </Badge>
          <Link
            href="/inbox/try"
            className={buttonVariants({ className: "ml-auto sm:ml-0" })}
          >
            <Bot className="h-4 w-4" aria-hidden />
            Test Front Desk
          </Link>
        </div>
      </header>

      <AttentionQueueSection
        queue={attention}
        showDescription={workspaceDefaults.showSectionDescriptions}
      />

      <OperationsSummary
        items={visibleOperations}
        currency={org.currency}
        showDescription={workspaceDefaults.showSectionDescriptions}
      />

      <FrontDeskSummary
        openConversations={data.openConversationCount}
        bookingsThisMonth={data.recovery.bookingsThisMonth}
        followUpsThisMonth={data.recovery.followUpsThisMonth}
        handoffCount={data.handoffCount}
        followupsEnabled={data.recovery.enabled}
        simulationMode={data.simulationMode}
        showBusinessOutcomes={!isAgent}
      />

      {!isAgent && (
        <BusinessPulse
          bookingsThisMonth={data.recovery.bookingsThisMonth}
          leadsChasedThisMonth={data.recovery.followUpsThisMonth}
          revenueInfluenced={revenueInfluenced}
          wonContacts={data.wonContactCount}
          optedInContacts={data.optedInContactCount}
          totalContacts={data.contactCount}
          currency={org.currency}
          showDescription={workspaceDefaults.showSectionDescriptions}
        />
      )}

      {!isAgent && !data.checklist.allDone && (
        <SetupProgress checklist={data.checklist} orgName={org.name} />
      )}

      <RecentActivity
        conversations={data.recentConversations}
        campaigns={data.recentCampaigns}
        showCampaigns={!isAgent}
      />
    </div>
  );
}
