import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { paginate } from "@/modules/admin/queries";

/**
 * Founder leads desk: the landing page's access requests ("Get access" /
 * hero form) and waitlist signups, normalised into one pipeline with a
 * status the founders move by hand. Cross-org module rules apply (see
 * queries.ts) — these tables are platform-level, not tenant data.
 */

export const LEAD_STATUSES = ["new", "contacted", "converted", "dismissed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(s: string): s is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(s);
}

export type LeadKind = "access" | "waitlist";

export interface LeadRow {
  id: string;
  kind: LeadKind;
  /** Person or shop name. */
  name: string;
  /** Email for access requests; city for waitlist signups. */
  secondary: string;
  phoneE164: string;
  vertical: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  /** Other matching submissions, deduplicated across shared phone/email keys. */
  duplicateCount: number;
  duplicateBy: ("phone" | "email")[];
  createdAt: Date;
}

export interface LeadsFilter {
  status?: LeadStatus | "all";
  kind?: LeadKind | "all";
  search?: string;
  page?: number;
}

export interface LeadsPage {
  rows: LeadRow[];
  page: number;
  pageCount: number;
  total: number;
}

const LEADS_QUERY_LIMIT = 500;
const LEADS_PAGE_SIZE = 50;

/** Badge count for the sidebar: leads nobody has touched yet. */
export async function newLeadsCount(): Promise<number> {
  const [a, w] = await Promise.all([
    prisma.accessRequest.count({ where: { status: "new" } }),
    prisma.waitlistSignup.count({ where: { status: "new" } }),
  ]);
  return a + w;
}

function accessWhere(status: LeadStatus | undefined, search: string): Prisma.AccessRequestWhereInput {
  const terms: Prisma.AccessRequestWhereInput[] = [];
  if (status) terms.push({ status });
  if (search) {
    terms.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneE164: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  return terms.length === 0 ? {} : terms.length === 1 ? terms[0] : { AND: terms };
}

function waitlistWhere(status: LeadStatus | undefined, search: string): Prisma.WaitlistSignupWhereInput {
  const terms: Prisma.WaitlistSignupWhereInput[] = [];
  if (status) terms.push({ status });
  if (search) {
    terms.push({
      OR: [
        { shopName: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { phoneE164: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  return terms.length === 0 ? {} : terms.length === 1 ? terms[0] : { AND: terms };
}

function leadIdentity(lead: Pick<LeadRow, "kind" | "id">): string {
  return `${lead.kind}:${lead.id}`;
}

function duplicateKeys(lead: LeadRow): { reason: "phone" | "email"; key: string }[] {
  const phone = lead.phoneE164.replace(/\D/g, "");
  const keys: { reason: "phone" | "email"; key: string }[] = phone
    ? [{ reason: "phone", key: `phone:${phone}` }]
    : [];
  if (lead.kind === "access") {
    const email = lead.secondary.trim().toLocaleLowerCase("en");
    if (email) keys.push({ reason: "email", key: `email:${email}` });
  }
  return keys;
}

/** Mark matching submission details while counting each matching record once. */
function withDuplicateSignals(rows: LeadRow[]): LeadRow[] {
  const leadsByKey = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const { key } of duplicateKeys(row)) {
      const matches = leadsByKey.get(key) ?? new Set<string>();
      matches.add(leadIdentity(row));
      leadsByKey.set(key, matches);
    }
  }
  return rows.map((row) => {
    const ownId = leadIdentity(row);
    const duplicateIds = new Set<string>();
    const duplicateBy: ("phone" | "email")[] = [];
    for (const { key, reason } of duplicateKeys(row)) {
      const matches = leadsByKey.get(key) ?? new Set<string>();
      if ([...matches].some((id) => id !== ownId)) duplicateBy.push(reason);
      for (const id of matches) if (id !== ownId) duplicateIds.add(id);
    }
    return { ...row, duplicateCount: duplicateIds.size, duplicateBy };
  });
}

export async function leadsList(filter: LeadsFilter = {}): Promise<LeadsPage> {
  const status = filter.status && filter.status !== "all" ? filter.status : undefined;
  const search = filter.search?.trim() ?? "";
  const wantAccess = !filter.kind || filter.kind === "all" || filter.kind === "access";
  const wantWaitlist = !filter.kind || filter.kind === "all" || filter.kind === "waitlist";
  const [access, waitlist] = await Promise.all([
    wantAccess
      ? prisma.accessRequest.findMany({
          where: accessWhere(status, search),
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: LEADS_QUERY_LIMIT,
          select: {
            id: true,
            name: true,
            email: true,
            phoneE164: true,
            source: true,
            status: true,
            notes: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    wantWaitlist
      ? prisma.waitlistSignup.findMany({
          where: waitlistWhere(status, search),
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: LEADS_QUERY_LIMIT,
          select: {
            id: true,
            shopName: true,
            city: true,
            phoneE164: true,
            vertical: true,
            source: true,
            status: true,
            notes: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const rows: LeadRow[] = [
    ...access.map((r) => ({
      id: r.id,
      kind: "access" as const,
      name: r.name,
      secondary: r.email,
      phoneE164: r.phoneE164,
      vertical: null,
      source: r.source,
      status: (isLeadStatus(r.status) ? r.status : "new") as LeadStatus,
      notes: r.notes,
      duplicateCount: 0,
      duplicateBy: [],
      createdAt: r.createdAt,
    })),
    ...waitlist.map((r) => ({
      id: r.id,
      kind: "waitlist" as const,
      name: r.shopName,
      secondary: r.city,
      phoneE164: r.phoneE164,
      vertical: r.vertical,
      source: r.source,
      status: (isLeadStatus(r.status) ? r.status : "new") as LeadStatus,
      notes: r.notes,
      duplicateCount: 0,
      duplicateBy: [],
      createdAt: r.createdAt,
    })),
  ];
  const sorted = rows.sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      leadIdentity(a).localeCompare(leadIdentity(b))
  );
  return paginate(withDuplicateSignals(sorted), filter.page ?? 1, LEADS_PAGE_SIZE);
}

export interface LeadCounts {
  total: number;
  byStatus: Record<LeadStatus, number>;
}

export async function leadCounts(): Promise<LeadCounts> {
  const [a, w] = await Promise.all([
    prisma.accessRequest.groupBy({ by: ["status"], _count: true }),
    prisma.waitlistSignup.groupBy({ by: ["status"], _count: true }),
  ]);
  const byStatus: Record<LeadStatus, number> = { new: 0, contacted: 0, converted: 0, dismissed: 0 };
  for (const row of [...a, ...w]) {
    const s = isLeadStatus(row.status) ? row.status : "new";
    byStatus[s] += row._count;
  }
  return { total: Object.values(byStatus).reduce((x, y) => x + y, 0), byStatus };
}

export type UpdateLeadResult = { ok: true } | { ok: false; error: string };

/** Move a lead through the pipeline and/or save a note (max 1000 chars). */
export async function updateLead(
  kind: LeadKind,
  id: string,
  patch: { status?: string; notes?: string | null }
): Promise<UpdateLeadResult> {
  const data: { status?: LeadStatus; notes?: string | null } = {};
  if (patch.status !== undefined) {
    if (!isLeadStatus(patch.status)) return { ok: false, error: `Unknown status "${patch.status}".` };
    data.status = patch.status;
  }
  if (patch.notes !== undefined) {
    const trimmed = patch.notes?.trim() ?? "";
    data.notes = trimmed ? trimmed.slice(0, 1000) : null;
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update." };
  try {
    if (kind === "access") await prisma.accessRequest.update({ where: { id }, data });
    else await prisma.waitlistSignup.update({ where: { id }, data });
    return { ok: true };
  } catch {
    return { ok: false, error: "Lead not found." };
  }
}
