import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, sourceLabel } from "../types";
import type {
  ActivityItem,
  CampaignMessageRow,
  ContactRow,
  MemberOption,
  NoteRow,
  TagInfo,
} from "../types";
import { ProfileView } from "./profile-view";

export default async function ContactProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, ctx] = await Promise.all([params, requireOrgContext()]);
  const { org } = ctx;

  const contact = await prisma.contact.findFirst({
    where: { id, orgId: org.id },
    include: {
      tags: { include: { tag: true } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) notFound();

  const [tags, memberships, convMessages, campaignMessages] =
    await Promise.all([
      prisma.tag.findMany({
        where: { orgId: org.id },
        include: { _count: { select: { contacts: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.membership.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.conversationMessage.findMany({
        where: { conversation: { contactId: contact.id, orgId: org.id } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.message.findMany({
        where: { contactId: contact.id, campaign: { orgId: org.id } },
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const row: ContactRow = {
    id: contact.id,
    name: contact.name,
    phoneE164: contact.phoneE164,
    email: contact.email,
    optedIn: contact.optedIn,
    optedOutAt: contact.optedOutAt?.toISOString() ?? null,
    optInSource: contact.optInSource,
    leadStage: contact.leadStage,
    assignedToUserId: contact.assignedToUserId,
    lastContactedAt: contact.lastContactedAt?.toISOString() ?? null,
    createdAt: contact.createdAt.toISOString(),
    tags: contact.tags.map((ct) => ({
      id: ct.tag.id,
      name: ct.tag.name,
      color: ct.tag.color,
    })),
  };

  const notes: NoteRow[] = contact.notes.map((n) => ({
    id: n.id,
    authorName: n.authorName,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
  }));

  const campaignRows: CampaignMessageRow[] = campaignMessages.map((m) => ({
    id: m.id,
    campaignName: m.campaign.name,
    status: m.status,
    costMinorUnits: m.costMinorUnits,
    sentAt: m.sentAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));

  // Merged timeline: conversation messages + campaign sends, newest first.
  const activity: ActivityItem[] = [
    ...convMessages.map((m): ActivityItem => ({
      id: `conv-${m.id}`,
      kind: m.direction === "inbound" ? "message_in" : "message_out",
      title: m.direction === "inbound" ? "Message received" : "Reply sent",
      body: m.body,
      at: m.createdAt.toISOString(),
    })),
    ...campaignMessages.map((m): ActivityItem => ({
      id: `camp-${m.id}`,
      kind: "campaign",
      title: `Campaign: ${m.campaign.name}`,
      body: "",
      status: m.status,
      at: (m.sentAt ?? m.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 100);

  const tagInfos: TagInfo[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    contactCount: t._count.contacts,
  }));

  const members: MemberOption[] = memberships.map((m) => ({
    userId: m.userId,
    name: m.displayName || m.email,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={contact.name}
        description={`Added ${formatDate(row.createdAt)} · ${sourceLabel(contact.optInSource)}`}
        actions={
          <Link
            href="/contacts"
            className={buttonVariants({ variant: "secondary" })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All contacts
          </Link>
        }
      />
      <ProfileView
        contact={row}
        tags={tagInfos}
        members={members}
        notes={notes}
        activity={activity}
        campaignMessages={campaignRows}
      />
    </div>
  );
}
