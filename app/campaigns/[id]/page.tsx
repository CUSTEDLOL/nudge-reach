import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { campaignContentSchema } from "@/lib/campaign/schema";
import { CampaignEditor } from "@/app/campaigns/[id]/editor";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrg();

  const campaign = await prisma.campaign.findFirst({
    where: { id, orgId: org.id },
    include: { product: { select: { photoUrl: true } } },
  });
  if (!campaign) notFound();

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
