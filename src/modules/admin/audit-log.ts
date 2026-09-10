import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { csvField, csvRow } from "@/lib/csv";

/**
 * Cross-org audit reader. Two views share it: one org's Audit tab (orgId
 * fixed) and the platform-wide log. This module is deliberately read-only.
 */
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 10_000;
export const AUDIT_RESULTS = ["all", "requested", "failed", "completed"] as const;

export type AuditResult = Exclude<(typeof AUDIT_RESULTS)[number], "all">;

export interface AuditFilter {
  orgId?: string;
  /** Substring on actorName (e.g. "founder:" for every admin action). */
  actor?: string;
  /** Prefix on action (e.g. "admin." or "member."). */
  action?: string;
  result?: (typeof AUDIT_RESULTS)[number];
  /** Inclusive UTC calendar day, formatted YYYY-MM-DD. */
  dateFrom?: string;
  /** Inclusive UTC calendar day, formatted YYYY-MM-DD. */
  dateTo?: string;
  cursor?: string;
}

const auditSelect = {
  id: true,
  orgId: true,
  actorName: true,
  action: true,
  target: true,
  detail: true,
  createdAt: true,
  org: { select: { name: true } },
} satisfies Prisma.AuditLogSelect;

function utcDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/** Derive an explicit result from the immutable audit action name. */
export function auditResult(action: string): AuditResult {
  if (action.endsWith("requested")) return "requested";
  if (action.endsWith("failed")) return "failed";
  return "completed";
}

/** Shared predicate for the paginated screen and bounded CSV export. */
export function auditWhere(filter: AuditFilter = {}): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const orgId = filter.orgId?.trim();
  const actor = filter.actor?.trim();
  const action = filter.action?.trim();

  if (orgId) where.orgId = orgId;
  if (actor) where.actorName = { contains: actor, mode: "insensitive" };

  const from = utcDay(filter.dateFrom);
  const to = utcDay(filter.dateTo);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1_000) } : {}),
    };
  }

  const actionClauses: Prisma.AuditLogWhereInput[] = [];
  if (action) actionClauses.push({ action: { startsWith: action } });
  if (filter.result === "requested") {
    actionClauses.push({ action: { endsWith: "requested" } });
  } else if (filter.result === "failed") {
    actionClauses.push({ action: { endsWith: "failed" } });
  } else if (filter.result === "completed") {
    actionClauses.push({
      NOT: [
        { action: { endsWith: "requested" } },
        { action: { endsWith: "failed" } },
      ],
    });
  }

  if (actionClauses.length === 1) Object.assign(where, actionClauses[0]);
  if (actionClauses.length > 1) where.AND = actionClauses;
  return where;
}

export async function auditList(filter: AuditFilter = {}) {
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(filter),
    orderBy: { createdAt: "desc" },
    take: AUDIT_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: auditSelect,
  });
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function auditExportRows(filter: AuditFilter = {}) {
  return prisma.auditLog.findMany({
    where: auditWhere(filter),
    orderBy: { createdAt: "desc" },
    take: AUDIT_EXPORT_LIMIT,
    select: auditSelect,
  });
}

type AuditExportRow = Awaited<ReturnType<typeof auditExportRows>>[number];

/** Kept public so formula-injection protection can be regression-tested. */
export function csvCell(value: string) {
  return csvField(value);
}

export function serializeAuditCsv(rows: AuditExportRow[]) {
  const header = csvRow(["Time", "Result", "Organisation", "Organisation ID", "Actor", "Action", "Target", "Detail"]);
  const body = rows.map((row) => csvRow([
    row.createdAt.toISOString(),
    auditResult(row.action),
    row.org.name,
    row.orgId,
    row.actorName,
    row.action,
    row.target ?? "",
    row.detail ?? "",
  ]));
  return [header, ...body].join("\r\n") + "\r\n";
}

export type AuditRow = Awaited<ReturnType<typeof auditList>>["rows"][number];
