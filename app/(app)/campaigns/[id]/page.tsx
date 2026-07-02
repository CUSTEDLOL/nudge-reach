import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { canSendMarketing } from "@/lib/consent";
import { campaignContentSchema } from "@/lib/campaign/schema";
import { refreshTemplateStatus } from "@/lib/whatsapp/approval";
import {
  applySimulatedProgress,
  campaignStats,
  processQueue,
} from "@/lib/send/queue";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignEditor } from "./editor";
import { ApprovalPanel } from "./approval-panel";
import { RunPanel } from "./run-panel";
import { StatsDashboard } from "./stats-dashboard";
import { WhatsappPreview } from "@/components/whatsapp-preview";

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
      include: { product: { select: { photoUrl: true } } },
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
  const ratePaise = Math.round((env.WHATSAPP_MARKETING_RATE_INR ?? 0.99) * 100);

  let audiences: { id: string; name: string; optedInCount: number }[] = [];
  if (campaign.status === "TEMPLATE_APPROVED") {
    const rows = await prisma.audience.findMany({
      where: { orgId: org.id },
      include: { contacts: { include: { contact: true } } },
      orderBy: { createdAt: "desc" },
    });
    audiences = rows.map((a) => ({
      id: a.id,
      name: a.name,
      optedInCount: a.contacts.filter((m) => canSendMarketing(m.contact))
        .length,
    }));
  }

  const stats = isSendingOrSent ? await campaignStats(campaign.id) : null;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={campaign.name}
        description={
          isSendingOrSent
            ? "Here's how your campaign is doing."
            : "Edit anything — the preview shows exactly what your customer sees."
        }
      />

      <div className="flex flex-col gap-6">
        {!isSendingOrSent && (
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
            ratePaise={ratePaise}
            simulation={env.SEND_MODE === "simulation"}
          />
        )}

        {isSendingOrSent && stats && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <StatsDashboard
              campaignId={campaign.id}
              status={campaign.status}
              stats={stats}
              ratePaise={ratePaise}
              simulation={env.SEND_MODE === "simulation"}
            />
            <WhatsappPreview
              content={content}
              photoUrl={campaign.product.photoUrl}
            />
          </div>
        )}

        {!isSendingOrSent && (
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
