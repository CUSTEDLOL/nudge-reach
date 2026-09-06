import Link from "next/link";
import { ArrowRight, Megaphone, MessagesSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  formatCount,
  formatRelativeTime,
} from "@/modules/dashboard/format";
import type {
  RecentCampaign,
  RecentConversation,
} from "@/modules/dashboard/queries";

const CAMPAIGN_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  TEMPLATE_PENDING: { label: "Pending approval", tone: "warning" },
  TEMPLATE_APPROVED: { label: "Ready to send", tone: "success" },
  SENDING: { label: "Sending", tone: "brand" },
  SENT: { label: "Sent", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

function campaignMeta(campaign: RecentCampaign): string {
  if (campaign.status === "SCHEDULED" && campaign.scheduledAt) {
    return `Scheduled ${new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(campaign.scheduledAt)}`;
  }
  const when = formatRelativeTime(campaign.createdAt);
  return campaign.recipientCount > 0
    ? `${formatCount(campaign.recipientCount)} recipients · ${when}`
    : `Created ${when}`;
}

function SectionHeader({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-100 px-4 sm:px-5">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/60"
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function Conversations({ conversations }: { conversations: RecentConversation[] }) {
  return (
    <div className="min-w-0">
      <SectionHeader title="Conversations" href="/inbox" />
      {conversations.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <MessagesSquare className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-950">
            No conversations yet
          </p>
          <p className="max-w-xs text-sm leading-5 text-neutral-600">
            Test the Front Desk to see a customer conversation here.
          </p>
          <Link
            href="/inbox/try"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Start a test chat
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 px-2 py-1">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/inbox/${conversation.id}`}
                className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/60 sm:px-3"
              >
                <Avatar name={conversation.contactName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-950">
                      {conversation.contactName}
                    </span>
                    {conversation.status === "handoff" && (
                      <Badge tone="warning">Needs human</Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-500">
                    {conversation.lastMessagePreview ?? "No messages yet"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs text-neutral-500">
                    {formatRelativeTime(conversation.lastMessageAt)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <Badge tone="brand" className="mt-1">
                      {conversation.unreadCount} new
                    </Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Campaigns({ campaigns }: { campaigns: RecentCampaign[] }) {
  return (
    <div className="min-w-0 border-t border-neutral-200 lg:border-l lg:border-t-0">
      <SectionHeader title="Campaigns" href="/campaigns" />
      {campaigns.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-950">
            No campaigns yet
          </p>
          <p className="max-w-xs text-sm leading-5 text-neutral-600">
            Campaigns are available when you want to reach opted-in customers.
          </p>
          <Link
            href="/campaigns/new"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Create a campaign
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 px-2 py-1">
          {campaigns.map((campaign) => {
            const status = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.DRAFT;
            return (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl px-2 py-2 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/60 sm:px-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-950">
                      {campaign.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {campaignMeta(campaign)}
                    </span>
                  </span>
                  <Badge tone={status.tone} className="shrink-0">
                    {status.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function RecentActivity({
  conversations,
  campaigns,
  showCampaigns = true,
}: {
  conversations: RecentConversation[];
  campaigns: RecentCampaign[];
  showCampaigns?: boolean;
}) {
  return (
    <section aria-labelledby="recent-activity-heading" className="min-w-0">
      <div className="mb-3">
        <h2
          id="recent-activity-heading"
          className="text-lg font-semibold tracking-tight text-neutral-950"
        >
          Recent activity
        </h2>
        <p className="mt-0.5 text-sm text-neutral-600">
          The latest customer work, kept secondary to what needs you now.
        </p>
      </div>
      <Card
        className={cn(
          "grid min-w-0 grid-cols-1 overflow-hidden shadow-none",
          showCampaigns &&
            "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        )}
      >
        <Conversations conversations={conversations} />
        {showCampaigns && <Campaigns campaigns={campaigns} />}
      </Card>
    </section>
  );
}
