import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Cross-org audit reader. Two views share it: one org's Audit tab (orgId
 * fixed) and the platform-wide log (founders' own actions across every org,
 * plus anything a client did that we might need to explain). Read-only.
 */
export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilter {
  orgId?: string;
  /** Substring on actorName (e.g. "founder:" for every admin action). */
  actor?: string;
  /** Prefix on action (e.g. "admin." or "member."). */
  action?: string;
  cursor?: string;
}

export async function auditList(filter: AuditFilter = {}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.orgId) where.orgId = filter.orgId;
  if (filter.actor?.trim()) where.actorName = { contains: filter.actor.trim(), mode: "insensitive" };
  if (filter.action?.trim()) where.action = { startsWith: filter.action.trim() };
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: AUDIT_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      orgId: true,
      actorName: true,
      action: true,
      target: true,
      detail: true,
      createdAt: true,
      org: { select: { name: true } },
    },
  });
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
export type AuditRow = Awaited<ReturnType<typeof auditList>>["rows"][number];
