import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CheckCheck,
  Eye,
  IndianRupee,
  Reply,
  Send,
} from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { formatMoney } from "@/lib/billing";
import { orgCurrency } from "@/lib/billing/money";
import {
  countDelta,
  formatMinutes,
  formatPct,
  parseRange,
  rateDelta,
} from "@/lib/analytics/compute";
import {
  agentPerformance,
  campaignPerformance,
  hasAnyMessages,
  leadFunnel,
  messageVolumeByDay,
  rates,
  topTags,
} from "@/lib/analytics/queries";
import { AreaVolumeChart } from "@/components/charts/area-volume-chart";
import { FunnelBars } from "@/components/charts/funnel-bars";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagPill } from "@/components/ui/tag-pill";
import { RangeTabs } from "./range-tabs";

export const metadata: Metadata = { title: "Analytics" };

const CAMPAIGN_STATUS_TONE: Record<string, BadgeTone> = {
  SENT: "success",
  SENDING: "info",
  SCHEDULED: "info",
  FAILED: "danger",
  DRAFT: "neutral",
  TEMPLATE_PENDING: "warning",
  TEMPLATE_APPROVED: "brand",
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const org = await requireOrg();
  const currency = orgCurrency(org);
  const days = parseRange((await searchParams).range);

  if (!(await hasAnyMessages(org.id))) {
    return (
      <>
        <PageHeader
          title="Analytics"
          description="Message volume, campaign performance, agent stats and your lead funnel."
        />
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" aria-hidden />}
          title="No message data yet"
          description="Analytics light up as soon as you send your first campaign or receive a WhatsApp message."
          action={
            <Link href="/campaigns/new" className={buttonVariants()}>
              Create your first campaign
            </Link>
          }
        />
      </>
    );
  }

  const [volume, rateStats, campaigns, agents, funnel, tags] =
    await Promise.all([
      messageVolumeByDay(org.id, days),
      rates(org.id, days),
      campaignPerformance(org.id, days),
      agentPerformance(org.id, days),
      leadFunnel(org.id),
      topTags(org.id),
    ]);

  const { current, previous } = rateStats;
  const messagesSent = current.totals.sent + current.totals.outboundConversation;
  const messagesSentPrev =
    previous.totals.sent + previous.totals.outboundConversation;
  const spendDelta = countDelta(
    current.totals.costMinorUnits,
    previous.totals.costMinorUnits,
    days
  );
  const totalContacts = funnel.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Computed from your real workspace data — nothing modeled or projected."
        actions={<RangeTabs value={String(days)} />}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          label="Messages sent"
          value={messagesSent.toLocaleString("en-IN")}
          delta={countDelta(messagesSent, messagesSentPrev, days)}
          icon={<Send className="h-4 w-4" aria-hidden />}
          hint="campaigns + replies"
        />
        <StatCard
          label="Delivery rate"
          value={formatPct(current.deliveredRate)}
          delta={rateDelta(current.deliveredRate, previous.deliveredRate, days)}
          icon={<CheckCheck className="h-4 w-4" aria-hidden />}
          hint="delivered ÷ sent"
        />
        <StatCard
          label="Read rate"
          value={formatPct(current.readRate)}
          delta={rateDelta(current.readRate, previous.readRate, days)}
          icon={<Eye className="h-4 w-4" aria-hidden />}
          hint="read ÷ delivered"
        />
        <StatCard
          label="Reply rate"
          value={formatPct(current.replyRate)}
          delta={rateDelta(current.replyRate, previous.replyRate, days)}
          icon={<Reply className="h-4 w-4" aria-hidden />}
          hint="replies ÷ recipients"
        />
        <StatCard
          label="Campaign spend"
          value={formatMoney(current.totals.costMinorUnits, currency)}
          delta={spendDelta && { ...spendDelta, direction: "neutral" }}
          icon={<IndianRupee className="h-4 w-4" aria-hidden />}
          hint="estimate"
        />
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Reply rate counts unique campaign recipients whose conversation received
        an inbound message after the send — a proxy for interest, not tracked
        intent. Rates cover campaign messages only; deltas compare the previous{" "}
        {days} days.
      </p>

      {/* Volume */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Message volume</CardTitle>
              <CardDescription>
                Daily inbound vs outbound — conversations plus campaign sends.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-4 pt-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "#06c167" }}
                />
                Outbound
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "#6fe3a8" }}
                />
                Inbound
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AreaVolumeChart
            data={volume.map((p) => ({
              label: p.label,
              inbound: p.inbound,
              outbound: p.outbound,
            }))}
          />
        </CardContent>
      </Card>

      {/* Campaign performance + lead funnel */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Campaign performance</CardTitle>
            <CardDescription>
              Messages by campaign in the last {days} days, largest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No campaign messages in this period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-t-0 hover:bg-transparent">
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Read</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="max-w-[16rem] truncate font-medium text-neutral-900 hover:text-brand-700"
                          >
                            {c.name}
                          </Link>
                          <Badge tone={CAMPAIGN_STATUS_TONE[c.status] ?? "neutral"}>
                            {c.status.replaceAll("_", " ").toLowerCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.sent.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.delivered.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.read.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.clicked.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          c.failed > 0 ? "text-red-600" : "text-neutral-400"
                        }`}
                      >
                        {c.failed.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(c.costMinorUnits, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead funnel</CardTitle>
            <CardDescription>
              All {totalContacts.toLocaleString("en-IN")} contacts by stage —
              current snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalContacts === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No contacts yet.{" "}
                <Link href="/contacts" className="font-medium text-brand-700">
                  Import your list
                </Link>{" "}
                to see the funnel.
              </p>
            ) : (
              <FunnelBars
                data={funnel.map((f) => ({ label: f.label, count: f.count }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent performance + top tags */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Agent performance</CardTitle>
            <CardDescription>
              Assigned conversations with activity in the last {days} days.
              First response = customer message → next team reply, capped at
              24h per gap.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {agents.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No team members yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-t-0 hover:bg-transparent">
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Avg first response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={agent.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">
                              {agent.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {ROLE_LABEL[agent.role] ?? agent.role}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {agent.assigned.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {agent.resolved.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinutes(agent.avgFirstResponseMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top tags</CardTitle>
            <CardDescription>
              Most-used contact tags across your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No tags applied to contacts yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <TagPill label={tag.name} color={tag.color} />
                    <span className="text-xs tabular-nums text-neutral-500">
                      {tag.count.toLocaleString("en-IN")}{" "}
                      {tag.count === 1 ? "contact" : "contacts"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
