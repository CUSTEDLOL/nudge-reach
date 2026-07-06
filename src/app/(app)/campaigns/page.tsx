import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY_INFO, orgCurrency } from "@/modules/billing/money";
import { CampaignsTable, type CampaignRow } from "./campaigns-table";

/** Statuses that count toward the "sent" number (left the queue, not failed). */
const SENT_STATUSES = new Set(["SENT", "DELIVERED", "READ", "CLICKED"]);
const DELIVERED_STATUSES = new Set(["DELIVERED", "READ", "CLICKED"]);
const READ_STATUSES = new Set(["READ", "CLICKED"]);

export default async function CampaignsPage() {
  const org = await requireOrg();

  // One groupBy covers the message aggregates for every row (no N+1).
  const [campaigns, grouped] = await Promise.all([
    prisma.campaign.findMany({
      where: { orgId: org.id },
      include: {
        product: { select: { photoUrl: true } },
        audience: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.groupBy({
      by: ["campaignId", "status"],
      where: { campaign: { orgId: org.id } },
      _count: true,
      _sum: { costMinorUnits: true },
    }),
  ]);

  const aggregates = new Map<
    string,
    { sent: number; delivered: number; read: number; costMinor: number }
  >();
  for (const g of grouped) {
    const agg = aggregates.get(g.campaignId) ?? {
      sent: 0,
      delivered: 0,
      read: 0,
      costMinor: 0,
    };
    if (SENT_STATUSES.has(g.status)) agg.sent += g._count;
    if (DELIVERED_STATUSES.has(g.status)) agg.delivered += g._count;
    if (READ_STATUSES.has(g.status)) agg.read += g._count;
    agg.costMinor += g._sum.costMinorUnits ?? 0;
    aggregates.set(g.campaignId, agg);
  }

  const rows: CampaignRow[] = campaigns.map((c) => {
    const agg = aggregates.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      photoUrl: c.product.photoUrl,
      audienceName: c.audience?.name ?? null,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      sent: agg?.sent ?? 0,
      delivered: agg?.delivered ?? 0,
      read: agg?.read ?? 0,
      costMinor: agg?.costMinor ?? 0,
    };
  });

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Campaigns"
        description="Broadcasts to your opted-in customers — from a photo, a template, or scratch."
        actions={
          <Link href="/campaigns/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" aria-hidden />
            New broadcast
          </Link>
        }
      />
      <CampaignsTable
        rows={rows}
        currencySymbol={CURRENCY_INFO[orgCurrency(org)].symbol}
      />
    </div>
  );
}
