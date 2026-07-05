import { prisma } from "@/lib/db";
import type { BuilderOptions } from "./builder";

/** Selects for the builder's pickers — org-scoped, shared by new + edit. */
export async function loadBuilderOptions(
  orgId: string,
  { includeContacts = false }: { includeContacts?: boolean } = {}
): Promise<BuilderOptions> {
  const [templates, tags, members, contacts] = await Promise.all([
    // Library templates only (campaignId null): approved are selectable,
    // pending are listed but disabled in the picker (spec §M6).
    prisma.template.findMany({
      where: {
        orgId,
        campaignId: null,
        metaStatus: { in: ["APPROVED", "PENDING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, metaStatus: true },
    }),
    prisma.tag.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, displayName: true, email: true },
    }),
    includeContacts
      ? prisma.contact.findMany({
          where: { orgId },
          orderBy: { name: "asc" },
          take: 100,
          select: { id: true, name: true, phoneE164: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.metaStatus,
    })),
    tags,
    members: members.map((m) => ({
      userId: m.userId,
      label: m.displayName ?? m.email,
    })),
    contacts,
  };
}
