import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  IndianRupee,
  Megaphone,
  MessagesSquare,
  Plug,
  Send,
  UserPlus,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getDashboardData } from "@/modules/dashboard/queries";
import type { RecentCampaign, RecentConversation } from "@/modules/dashboard/queries";
import {
  estimateRevenueInfluencedInr,
  parseAvgOrderValueInr,
  type Checklist,
} from "@/modules/dashboard/stats";
import {
  formatCount,
  formatMajorAmount,
  formatPercent,
  formatRelativeTime,
  greetingForHour,
  hourInTimezone,
} from "@/modules/dashboard/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardPage() {
  const { org, membership, email } = await requireOrgContext();
  const data = await getDashboardData(org.id);

  // First visit with an empty workspace → guided setup (spec §M1).
  if (!org.onboardedAt && data.contactCount === 0) {
    redirect("/onboarding");
  }

  const firstName =
    (membership.displayName || email.split("@")[0] || "there").split(/\s+/)[0];
  const avgOrderValueInr = parseAvgOrderValueInr(org.settings);
  const revenueInr = estimateRevenueInfluencedInr(
    data.wonContactCount,
    org.settings
  );
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title={`${greetingForHour(hourInTimezone(org.timezone))}, ${firstName}`}
        description={`${today} · Here's how ${org.name} is doing.`}
        actions={
          <Link href="/campaigns/new" className={buttonVariants()}>
            <Megaphone className="h-4 w-4" aria-hidden />
            New broadcast
          </Link>
        }
      />

      {!data.checklist.allDone && (
        <ChecklistCard checklist={data.checklist} orgName={org.name} />
      )}

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        <StatCard
          label="Contacts"
          value={formatCount(data.contactCount)}
          icon={<Users className="h-4 w-4" aria-hidden />}
          hint={`${formatCount(data.optedInContactCount)} opted in`}
        />
        <StatCard
          label="Open conversations"
          value={formatCount(data.openConversationCount)}
          icon={<MessagesSquare className="h-4 w-4" aria-hidden />}
          hint={
            data.unreadMessageCount > 0
              ? `${formatCount(data.unreadMessageCount)} unread`
              : "All caught up"
          }
        />
        <StatCard
          label="Campaigns sent"
          value={formatCount(data.campaignsSentCount)}
          icon={<Megaphone className="h-4 w-4" aria-hidden />}
          hint={
            data.scheduledCampaignCount > 0
              ? `${formatCount(data.scheduledCampaignCount)} scheduled`
              : "Broadcasts so far"
          }
        />
        <StatCard
          label="Revenue influenced"
          value={formatMajorAmount(revenueInr, org.currency)}
          icon={<IndianRupee className="h-4 w-4" aria-hidden />}
          hint={`Estimate · ${formatCount(data.wonContactCount)} won × ${formatMajorAmount(avgOrderValueInr, org.currency)}`}
        />
        <StatCard
          label="Messages sent"
          value={formatCount(data.rates.sentTotal)}
          icon={<Send className="h-4 w-4" aria-hidden />}
          hint="Across all campaigns"
        />
        <StatCard
          label="Delivered rate"
          value={formatPercent(data.rates.deliveredRate)}
          icon={<CheckCheck className="h-4 w-4" aria-hidden />}
          hint={
            data.rates.sentTotal > 0
              ? `${formatCount(data.rates.deliveredCount)} of ${formatCount(data.rates.sentTotal)} sent`
              : "No sends yet"
          }
        />
        <StatCard
          label="Read rate"
          value={formatPercent(data.rates.readRate)}
          icon={<Eye className="h-4 w-4" aria-hidden />}
          hint={
            data.rates.sentTotal > 0
              ? `${formatCount(data.rates.readCount)} of ${formatCount(data.rates.sentTotal)} sent`
              : "No sends yet"
          }
        />
        <StatCard
          label="Active automations"
          value={formatCount(data.enabledAutomationCount)}
          icon={<Workflow className="h-4 w-4" aria-hidden />}
          hint={`${formatCount(data.automationCount)} total`}
        />
      </section>

      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <RecentConversationsCard
          conversations={data.recentConversations}
          className="lg:col-span-2"
        />
        <div className="flex flex-col gap-6">
          <QuickActionsCard />
          <RecentCampaignsCard campaigns={data.recentCampaigns} />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding checklist                                                */
/* ------------------------------------------------------------------ */

function ChecklistCard({
  checklist,
  orgName,
}: {
  checklist: Checklist;
  orgName: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <CardTitle>Finish setting up {orgName}</CardTitle>
          <CardDescription className="mt-0.5">
            {checklist.completed} of {checklist.total} steps done — you&apos;re
            close to your first campaign.
          </CardDescription>
        </div>
        <div className="flex w-44 items-center gap-2">
          <Progress
            value={checklist.completed}
            max={checklist.total}
            label="Setup progress"
          />
          <span className="shrink-0 text-xs font-medium text-neutral-500">
            {checklist.completed}/{checklist.total}
          </span>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {checklist.items.map((item, index) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "group flex h-full flex-col gap-2 rounded-xl border p-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
                item.done
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-neutral-200 bg-white hover:border-brand-300 hover:bg-brand-50/40"
              )}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                    item.done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-brand-50 text-brand-700"
                  )}
                >
                  {item.done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                {!item.done && (
                  <ArrowRight
                    className="h-3.5 w-3.5 text-neutral-300 transition-colors duration-150 group-hover:text-brand-500"
                    aria-hidden
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  item.done ? "text-emerald-800" : "text-neutral-900"
                )}
              >
                {item.title}
              </span>
              <span className="text-xs leading-relaxed text-neutral-500">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Recent conversations                                                */
/* ------------------------------------------------------------------ */

function RecentConversationsCard({
  conversations,
  className,
}: {
  conversations: RecentConversation[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <CardTitle>Recent conversations</CardTitle>
          <CardDescription className="mt-0.5">
            The latest customer chats across your inbox.
          </CardDescription>
        </div>
        <Link
          href="/inbox"
          className="shrink-0 text-xs font-medium text-brand-700 transition-colors duration-150 hover:text-brand-800"
        >
          View inbox →
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MessagesSquare className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-900">
            No conversations yet
          </p>
          <p className="max-w-xs text-sm text-neutral-500">
            When customers reply to your campaigns, their chats land here.
          </p>
          <Link
            href="/inbox"
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: "mt-1",
            })}
          >
            Open inbox
          </Link>
        </div>
      ) : (
        <ul className="mt-2 px-2 pb-2">
          {conversations.map((c) => (
            <li key={c.id} className="border-t border-neutral-100 first:border-t-0">
              <Link
                href={`/inbox/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/50"
              >
                <Avatar name={c.contactName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {c.contactName}
                    </p>
                    {c.status === "handoff" && (
                      <Badge tone="warning">Needs human</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {c.lastMessagePreview ?? "No messages yet"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-neutral-400">
                    {formatRelativeTime(c.lastMessageAt)}
                  </span>
                  {c.unreadCount > 0 && (
                    <Badge tone="brand">{c.unreadCount} new</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS: {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    label: "New broadcast",
    description: "Message an audience",
    href: "/campaigns/new",
    icon: Megaphone,
  },
  {
    label: "Add contact",
    description: "Save an opted-in customer",
    href: "/contacts?new=1",
    icon: UserPlus,
  },
  {
    label: "New automation",
    description: "Reply & route automatically",
    href: "/automations/new",
    icon: Zap,
  },
  {
    label: "Connect WhatsApp",
    description: "Link your business number",
    href: "/settings/whatsapp",
    icon: Plug,
  },
];

function QuickActionsCard() {
  return (
    <Card className="p-5">
      <CardTitle>Quick actions</CardTitle>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col rounded-xl border border-neutral-200 p-3 outline-none transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <action.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-medium text-neutral-900">
              {action.label}
            </span>
            <span className="mt-0.5 text-xs text-neutral-500">
              {action.description}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Recent campaigns                                                    */
/* ------------------------------------------------------------------ */

const CAMPAIGN_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  TEMPLATE_PENDING: { label: "Pending approval", tone: "warning" },
  TEMPLATE_APPROVED: { label: "Ready to send", tone: "success" },
  SENDING: { label: "Sending", tone: "brand" },
  SENT: { label: "Sent", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

function campaignMeta(c: RecentCampaign): string {
  if (c.status === "SCHEDULED" && c.scheduledAt) {
    return `Scheduled ${new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(c.scheduledAt)}`;
  }
  const when = formatRelativeTime(c.createdAt);
  return c.recipientCount > 0
    ? `${formatCount(c.recipientCount)} recipients · ${when}`
    : `Created ${when}`;
}

function RecentCampaignsCard({ campaigns }: { campaigns: RecentCampaign[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between p-5 pb-0">
        <CardTitle>Recent campaigns</CardTitle>
        <Link
          href="/campaigns"
          className="shrink-0 text-xs font-medium text-brand-700 transition-colors duration-150 hover:text-brand-800"
        >
          View all →
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-900">
            No campaigns yet
          </p>
          <p className="max-w-xs text-sm text-neutral-500">
            Turn one product photo into a ready-to-send broadcast.
          </p>
          <Link
            href="/campaigns/new"
            className={buttonVariants({ size: "sm", className: "mt-1" })}
          >
            Create a campaign
          </Link>
        </div>
      ) : (
        <ul className="mt-2 px-2 pb-2">
          {campaigns.map((c) => {
            const status = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.DRAFT;
            return (
              <li
                key={c.id}
                className="border-t border-neutral-100 first:border-t-0"
              >
                <Link
                  href={`/campaigns/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {c.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {campaignMeta(c)}
                    </p>
                  </div>
                  <Badge tone={status.tone} className="shrink-0">
                    {status.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
