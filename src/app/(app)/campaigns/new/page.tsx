import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrg } from "@/modules/orgs/auth";
import { canSendMarketing } from "@/modules/consent";
import { getApprovedTemplates } from "@/modules/whatsapp/library";
import { getMessageRateMinor } from "@/modules/billing";
import { CURRENCY_INFO, orgCurrency } from "@/modules/billing/money";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignWizard, type WizardTemplate } from "./wizard";

export default async function NewBroadcastPage() {
  const org = await requireOrg();

  const [libraryTemplates, audienceRows, tags, sourceRows] = await Promise.all([
    getApprovedTemplates(org.id),
    prisma.audience.findMany({
      where: { orgId: org.id },
      include: { contacts: { include: { contact: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { orgId: org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      where: { orgId: org.id },
      select: { optInSource: true },
      distinct: ["optInSource"],
      orderBy: { optInSource: "asc" },
    }),
  ]);

  // Only templates with editable §7-shape content can seed a campaign.
  const templates: WizardTemplate[] = libraryTemplates.flatMap((t) =>
    t.content
      ? [{ id: t.id, name: t.name, category: t.category, language: t.language, content: t.content }]
      : []
  );

  const audiences = audienceRows.map((a) => ({
    id: a.id,
    name: a.name,
    optedInCount: a.contacts.filter((m) => canSendMarketing(m.contact)).length,
  }));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="New broadcast"
        description="Three quick steps: write it, pick who gets it, review and send."
      />
      <CampaignWizard
        templates={templates}
        audiences={audiences}
        tags={tags}
        sources={sourceRows.map((s) => s.optInSource)}
        ratePaise={getMessageRateMinor(orgCurrency(org))}
        currencySymbol={CURRENCY_INFO[orgCurrency(org)].symbol}
        simulation={isSimulated(org)}
      />
    </div>
  );
}
