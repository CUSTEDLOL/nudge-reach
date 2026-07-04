import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { campaignContentSchema } from "@/lib/campaign/schema";
import { refreshTemplateStatus } from "@/lib/whatsapp/approval";
import {
  applySimulatedProgress,
  campaignStats,
  processQueue,
} from "@/lib/send/queue";
import { getMessageRateMinor } from "@/lib/billing";
import { CURRENCY_INFO, orgCurrency } from "@/lib/billing/money";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { WhatsappPreview } from "@/components/whatsapp-preview";
import { CampaignEditor } from "./editor";
import { ApprovalPanel } from "./approval-panel";
import { RunPanel } from "./run-panel";
import { SchedulePanel } from "./schedule-panel";
import { StatsDashboard } from "./stats-dashboard";
import { RecipientsTable, type RecipientRow } from "./recipients-table";

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  TEMPLATE_PENDING: { label: "In review", tone: "warning" },
  TEMPLATE_APPROVED: { label: "Ready to send", tone: "brand" },
  SENDING: { label: "Sending", tone: "info" },
  SENT: { label: "Sent", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrg();

  const load = () =>
    prisma.campaign.findFirst({
      where: { id, orgId: org.id },
      include: {
        product: { select: { photoUrl: true } },
        audience: { select: { id: true, name: true } },
      },
    });

  let campaign = await load();
  if (!campaign) notFound();

  // Server-side ticks on every view: approval poll while pending, queue +
  // simulated delivery while sending. The client panels auto-refresh.
  if (campaign.status === "TEMPLATE_PENDING") {
    await refreshTemplateStatus(campaign.id, org.id);
    campaign = (await load())!;
  }
  if (campaign.status === "SENDING") {
    await processQueue(campaign.id);
    await applySimulatedProgress(campaign.id);
    campaign = (await load())!;
  }

  const latestTemplate = await prisma.template.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { submittedAt: "desc" },
    select: { rejectionReason: true },
  });

  const content = campaignContentSchema.parse(campaign.content);
  const isSendingOrSent =
    campaign.status === "SENDING" || campaign.status === "SENT";
  const isScheduled = campaign.status === "SCHEDULED";
  const currency = orgCurrency(org);
  const ratePaise = getMessageRateMinor(currency);
  const currencySymbol = CURRENCY_INFO[currency].symbol;
  const simulation = env.SEND_MODE === "simulation";

  let audiences: { id: string; name: string; optedInCount: number }[] = [];
  if (campaign.status === "TEMPLATE_APPROVED" || isScheduled) {
    // Count opted-in members per audience WITHOUT loading contact rows — a
    // groupBy over the join table scales to large audiences (was loading every
    // contact of every audience into memory just to count).
    const [rows, grouped] = await Promise.all([
      prisma.audience.findMany({
        where: { orgId: org.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.audienceContact.groupBy({
        by: ["audienceId"],
        where: {
          audience: { orgId: org.id },
          contact: { optedIn: true, optedOutAt: null },
        },
        _count: { contactId: true },
      }),
    ]);
    const countByAudience = new Map(
      grouped.map((g) => [g.audienceId, g._count.contactId])
    );
    audiences = rows.map((a) => ({
      id: a.id,
      name: a.name,
      optedInCount: countByAudience.get(a.id) ?? 0,
    }));
  }
  const scheduledAudience = isScheduled
    ? audiences.find((a) => a.id === campaign.audienceId) ?? null
    : null;

  const stats = isSendingOrSent ? await campaignStats(campaign.id) : null;

  let recipients: RecipientRow[] = [];
  if (isSendingOrSent) {
    const messages = await prisma.message.findMany({
      where: { campaignId: campaign.id },
      include: { contact: { select: { name: true, phoneE164: true } } },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });
    recipients = messages.map((m) => ({
      id: m.id,
      name: m.contact.name,
      phone: m.contact.phoneE164,
      status: m.status,
      costMinor: m.costMinorUnits,
      sentAt: m.sentAt?.toISOString() ?? null,
    }));
  }

  const statusMeta = STATUS_META[campaign.status] ?? STATUS_META.DRAFT;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={campaign.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            <span>
              Created{" "}
              {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                campaign.createdAt
              )}
            </span>
            {campaign.sourceTemplateId && (
              <Badge tone="neutral">From template</Badge>
            )}
          </span>
        }
        actions={
          <Link
            href="/campaigns"
            className={buttonVariants({ variant: "secondary" })}
          >
            All campaigns
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {isScheduled && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <SchedulePanel
              campaignId={campaign.id}
              scheduledAt={campaign.scheduledAt?.toISOString() ?? null}
              audienceName={campaign.audience?.name ?? "—"}
              optedInCount={scheduledAudience?.optedInCount ?? 0}
              ratePaise={ratePaise}
              currencySymbol={currencySymbol}
              simulation={simulation}
            />
            <WhatsappPreview
              content={content}
              photoUrl={campaign.product.photoUrl}
            />
          </div>
        )}

        {!isSendingOrSent && !isScheduled && (
          <ApprovalPanel
            campaignId={campaign.id}
            status={campaign.status}
            rejectionReason={latestTemplate?.rejectionReason ?? null}
          />
        )}

        {campaign.status === "TEMPLATE_APPROVED" && (
          <RunPanel
            campaignId={campaign.id}
            audiences={audiences}
            defaultAudienceId={campaign.audienceId}
            ratePaise={ratePaise}
              currencySymbol={currencySymbol}
            simulation={simulation}
          />
        )}

        {isSendingOrSent && stats && (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <StatsDashboard
                campaignId={campaign.id}
                status={campaign.status}
                stats={stats}
                ratePaise={ratePaise}
              currencySymbol={currencySymbol}
                simulation={simulation}
              />
              <WhatsappPreview
                content={content}
                photoUrl={campaign.product.photoUrl}
              />
            </div>
            <RecipientsTable rows={recipients} currencySymbol={currencySymbol} />
          </>
        )}

        {!isSendingOrSent && !isScheduled && (
          <CampaignEditor
            campaignId={campaign.id}
            initialContent={content}
            photoUrl={campaign.product.photoUrl}
          />
        )}
      </div>
    </div>
  );
}
