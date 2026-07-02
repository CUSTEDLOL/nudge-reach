import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/lib/auth";
import { buildContactWhere, parseSegmentFilter } from "@/lib/segments";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ContactsToolbar } from "./forms";
import { ContactsTable } from "./contacts-table";
import { AudiencesSection } from "./audiences-section";
import type { AudienceRow, ContactRow, MemberOption, TagInfo } from "./types";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, ctx] = await Promise.all([searchParams, requireOrgContext()]);
  const { org, role } = ctx;
  const canManage = hasRole(role, "ADMIN");

  const filter = parseSegmentFilter(sp);
  const where = buildContactWhere(org.id, filter);

  const [contacts, totalCount, optedInCount, tags, audiences, memberships, optedInContacts] =
    await Promise.all([
      prisma.contact.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.contact.count({ where: { orgId: org.id } }),
      prisma.contact.count({
        where: { orgId: org.id, optedIn: true, optedOutAt: null },
      }),
      prisma.tag.findMany({
        where: { orgId: org.id },
        include: { _count: { select: { contacts: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.audience.findMany({
        where: { orgId: org.id },
        include: { _count: { select: { contacts: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.membership.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.contact.findMany({
        where: { orgId: org.id, optedIn: true, optedOutAt: null },
        select: { id: true, name: true, phoneE164: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const rows: ContactRow[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phoneE164: c.phoneE164,
    email: c.email,
    optedIn: c.optedIn,
    optedOutAt: c.optedOutAt?.toISOString() ?? null,
    optInSource: c.optInSource,
    leadStage: c.leadStage,
    assignedToUserId: c.assignedToUserId,
    lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    tags: c.tags.map((ct) => ({
      id: ct.tag.id,
      name: ct.tag.name,
      color: ct.tag.color,
    })),
  }));

  const tagInfos: TagInfo[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    contactCount: t._count.contacts,
  }));

  const audienceRows: AudienceRow[] = audiences.map((a) => ({
    id: a.id,
    name: a.name,
    memberCount: a._count.contacts,
  }));

  const members: MemberOption[] = memberships.map((m) => ({
    userId: m.userId,
    name: m.displayName || m.email,
  }));

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`${totalCount} contact${totalCount === 1 ? "" : "s"} · ${optedInCount} can receive campaigns`}
        actions={<ContactsToolbar tags={tagInfos} canManageTags={canManage} />}
      />

      {totalCount === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="No contacts yet"
          description="Add your first customer by hand, or paste a list from a spreadsheet with the Import CSV button above."
          action={
            <Link href="/contacts?new=1" className={buttonVariants()}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Add your first contact
            </Link>
          }
        />
      ) : (
        <>
          <ContactsTable
            rows={rows}
            tags={tagInfos}
            members={members}
            audiences={audienceRows}
          />
          <AudiencesSection
            audiences={audienceRows}
            optedInContacts={optedInContacts}
            canManage={canManage}
          />
        </>
      )}
    </div>
  );
}
