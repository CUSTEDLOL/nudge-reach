import { prisma } from "@/lib/db";

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
  createdAt: Date;
}

export interface LeadsFilter {
  status?: LeadStatus | "all";
  kind?: LeadKind | "all";
}

/** Badge count for the sidebar: leads nobody has touched yet. */
export async function newLeadsCount(): Promise<number> {
  const [a, w] = await Promise.all([
    prisma.accessRequest.count({ where: { status: "new" } }),
    prisma.waitlistSignup.count({ where: { status: "new" } }),
  ]);
  return a + w;
}

export async function leadsList(filter: LeadsFilter = {}): Promise<LeadRow[]> {
  const status = filter.status && filter.status !== "all" ? filter.status : undefined;
  const wantAccess = !filter.kind || filter.kind === "all" || filter.kind === "access";
  const wantWaitlist = !filter.kind || filter.kind === "all" || filter.kind === "waitlist";
  const where = status ? { status } : {};
  const [access, waitlist] = await Promise.all([
    wantAccess
      ? prisma.accessRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 })
      : Promise.resolve([]),
    wantWaitlist
      ? prisma.waitlistSignup.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 })
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
      createdAt: r.createdAt,
    })),
  ];
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
