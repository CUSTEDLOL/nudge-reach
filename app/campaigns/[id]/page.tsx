import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { campaignContentSchema } from "@/lib/campaign/schema";
import { refreshTemplateStatus } from "@/lib/whatsapp/approval";
import { CampaignEditor } from "@/app/campaigns/[id]/editor";
import { ApprovalPanel } from "@/app/campaigns/[id]/approval-panel";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrg();

  let campaign = await prisma.campaign.findFirst({
    where: { id, orgId: org.id },
    include: { product: { select: { photoUrl: true } } },
  });
  if (!campaign) notFound();

  // Polling fallback: while a template review is pending, every page view
  // re-checks (the panel auto-refreshes every few seconds).
  if (campaign.status === "TEMPLATE_PENDING") {
    await refreshTemplateStatus(campaign.id, org.id);
    campaign = (await prisma.campaign.findFirst({
      where: { id, orgId: org.id },
      include: { product: { select: { photoUrl: true } } },
    }))!;
  }

  const latestTemplate = await prisma.template.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { submittedAt: "desc" },
    select: { rejectionReason: true },
  });

  const content = campaignContentSchema.parse(campaign.content);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-sm text-neutral-500">
          <Link href="/campaigns" className="hover:underline">
            ← Campaigns
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {campaign.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Edit anything — the preview shows exactly what your customer sees.
        </p>

        <div className="mt-6">
          <ApprovalPanel
            campaignId={campaign.id}
            status={campaign.status}
            rejectionReason={latestTemplate?.rejectionReason ?? null}
          />
        </div>

        <div className="mt-6">
          <CampaignEditor
            campaignId={campaign.id}
            initialContent={content}
            photoUrl={campaign.product.photoUrl}
          />
        </div>
      </div>
    </main>
  );
}
