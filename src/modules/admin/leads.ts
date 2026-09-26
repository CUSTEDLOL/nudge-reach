import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { paginate } from "@/modules/admin/queries";

/**
 * Founder leads desk: landing-page access requests, waitlist signups, free
 * trials, and signed demo bookings normalised into one pipeline with a status
 * the founders move by hand. Cross-org module rules apply (see queries.ts) —
 * these tables are platform-level, not tenant data.
 */

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "dismissed",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(s: string): s is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(s);
}

export const LEAD_KINDS = ["access", "waitlist", "booking", "trial"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export function isLeadKind(value: string): value is LeadKind {
  return (LEAD_KINDS as readonly string[]).includes(value);
}

export function isOpaqueLeadId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function formatBookingStart(
  instant: Date,
  timeZone = env.FOUNDER_TIME_ZONE || "Asia/Kolkata"
) {
  const formatted = instant.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
    timeZone,
  });
  return `${formatted} (${timeZone})`;
}

export interface LeadRow {
  id: string;
  kind: LeadKind;
  /** Person or shop name. */
  name: string;
  /** Email, city, or scheduled-date fallback according to lead kind. */
  secondary: string;
  email: string | null;
  phoneE164: string | null;
  /** Human-readable appointment time for bookings. */
  scheduledFor: string | null;
  vertical: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  /** Trial workspace ownership context; null for unclaimed trials and legacy leads. */
  orgId: string | null;
  claimedAt: Date | null;
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
  const [a, w, b, t] = await Promise.all([
    prisma.accessRequest.count({ where: { status: "new" } }),
    prisma.waitlistSignup.count({ where: { status: "new" } }),
    prisma.demoBooking.count({ where: { status: "new" } }),
    prisma.acquisitionTrial.count({ where: { leadStatus: "new" } }),
  ]);
  return a + w + b + t;
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

function bookingWhere(status: LeadStatus | undefined, search: string): Prisma.DemoBookingWhereInput {
  const terms: Prisma.DemoBookingWhereInput[] = [];
  if (status) terms.push({ status });
  if (search) {
    terms.push({
      OR: [
        { attendeeName: { contains: search, mode: "insensitive" } },
        { attendeeEmail: { contains: search, mode: "insensitive" } },
        { attendeePhoneE164: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  return terms.length === 0 ? {} : terms.length === 1 ? terms[0] : { AND: terms };
}

function trialWhere(
  status: LeadStatus | undefined,
  search: string
): Prisma.AcquisitionTrialWhereInput {
  const terms: Prisma.AcquisitionTrialWhereInput[] = [];
  if (status) terms.push({ leadStatus: status });
  if (search) {
    terms.push({
      OR: [
        { ownerName: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
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
  const phone = lead.phoneE164?.replace(/\D/g, "") ?? "";
  const keys: { reason: "phone" | "email"; key: string }[] = phone
    ? [{ reason: "phone", key: `phone:${phone}` }]
    : [];
  if (lead.email) {
    const email = lead.email.trim().toLocaleLowerCase("en");
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
  const wantBooking = !filter.kind || filter.kind === "all" || filter.kind === "booking";
  const wantTrial = !filter.kind || filter.kind === "all" || filter.kind === "trial";
  const [access, waitlist, bookings, trials] = await Promise.all([
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
    wantBooking
      ? prisma.demoBooking.findMany({
          where: bookingWhere(status, search),
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: LEADS_QUERY_LIMIT,
          select: {
            id: true,
            attendeeName: true,
            attendeeEmail: true,
            attendeePhoneE164: true,
            startTime: true,
            source: true,
            utmSource: true,
            status: true,
            notes: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    wantTrial
      ? prisma.acquisitionTrial.findMany({
          where: trialWhere(status, search),
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: LEADS_QUERY_LIMIT,
          select: {
            id: true,
            orgId: true,
            claimedAt: true,
            ownerName: true,
            businessName: true,
            email: true,
            phoneE164: true,
            source: true,
            leadStatus: true,
            founderNotes: true,
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
      email: r.email,
      phoneE164: r.phoneE164,
      scheduledFor: null,
      vertical: null,
      source: r.source,
      status: (isLeadStatus(r.status) ? r.status : "new") as LeadStatus,
      notes: r.notes,
      orgId: null,
      claimedAt: null,
      duplicateCount: 0,
      duplicateBy: [],
      createdAt: r.createdAt,
    })),
    ...waitlist.map((r) => ({
      id: r.id,
      kind: "waitlist" as const,
      name: r.shopName,
      secondary: r.city,
      email: null,
      phoneE164: r.phoneE164,
      scheduledFor: null,
      vertical: r.vertical,
      source: r.source,
      status: (isLeadStatus(r.status) ? r.status : "new") as LeadStatus,
      notes: r.notes,
      orgId: null,
      claimedAt: null,
      duplicateCount: 0,
      duplicateBy: [],
      createdAt: r.createdAt,
    })),
    ...bookings.map((r) => {
      const scheduledFor = formatBookingStart(r.startTime);
      return {
        id: r.id,
        kind: "booking" as const,
        name: r.attendeeName?.trim() || r.attendeeEmail || "Demo booking",
        secondary: r.attendeeEmail || scheduledFor,
        email: r.attendeeEmail,
        phoneE164: r.attendeePhoneE164,
        scheduledFor,
        vertical: null,
        source: r.utmSource ?? r.source,
        status: (isLeadStatus(r.status) ? r.status : "new") as LeadStatus,
        notes: r.notes,
        orgId: null,
        claimedAt: null,
        duplicateCount: 0,
        duplicateBy: [],
        createdAt: r.createdAt,
      };
    }),
    ...trials.map((r) => ({
      id: r.id,
      kind: "trial" as const,
      name: r.ownerName,
      secondary: r.businessName,
      email: r.email,
      phoneE164: r.phoneE164,
      scheduledFor: null,
      vertical: null,
      source: r.source,
      status: (isLeadStatus(r.leadStatus) ? r.leadStatus : "new") as LeadStatus,
      notes: r.founderNotes,
      orgId: r.orgId,
      claimedAt: r.claimedAt,
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
  const [a, w, b, t] = await Promise.all([
    prisma.accessRequest.groupBy({ by: ["status"], _count: true }),
    prisma.waitlistSignup.groupBy({ by: ["status"], _count: true }),
    prisma.demoBooking.groupBy({ by: ["status"], _count: true }),
    prisma.acquisitionTrial.groupBy({ by: ["leadStatus"], _count: true }),
  ]);
  const byStatus: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    dismissed: 0,
  };
  for (const row of [...a, ...w, ...b]) {
    const s = isLeadStatus(row.status) ? row.status : "new";
    byStatus[s] += row._count;
  }
  for (const row of t) {
    const s = isLeadStatus(row.leadStatus) ? row.leadStatus : "new";
    byStatus[s] += row._count;
  }
  return { total: Object.values(byStatus).reduce((x, y) => x + y, 0), byStatus };
}

export type LeadTransition = {
  previous: LeadStatus;
  current: LeadStatus;
  gaClientId: string | null;
} | null;

export type UpdateLeadResult =
  | { ok: true; transition: LeadTransition }
  | { ok: false; error: string };

const LEAD_EDIT_CONFLICT =
  "Lead changed while you were editing. Refresh and try again.";

/** Move a lead through the pipeline and/or save a note (max 1000 chars). */
export async function updateLead(
  kind: LeadKind,
  id: string,
  patch: { status?: string; notes?: string | null }
): Promise<UpdateLeadResult> {
  if (!isLeadKind(kind) || !isOpaqueLeadId(id)) {
    return { ok: false, error: "Bad lead reference." };
  }
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
    if (kind === "booking" && data.status) {
      const observed = await prisma.demoBooking.findUnique({
        where: { id },
        select: { status: true, gaClientId: true },
      });
      if (!observed) return { ok: false, error: "Lead not found." };

      const committed = await prisma.demoBooking.updateMany({
        where: { id, status: observed.status },
        data,
      });
      if (committed.count === 1) {
        const previous = isLeadStatus(observed.status) ? observed.status : "new";
        return {
          ok: true,
          transition:
            previous === data.status
              ? null
              : {
                  previous,
                  current: data.status,
                  gaClientId: observed.gaClientId,
                },
        };
      }

      const latest = await prisma.demoBooking.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!latest) return { ok: false, error: "Lead not found." };
      if (latest.status !== data.status) {
        return { ok: false, error: LEAD_EDIT_CONFLICT };
      }

      if (data.notes !== undefined) {
        const notesCommitted = await prisma.demoBooking.updateMany({
          where: { id, status: latest.status },
          data: { notes: data.notes },
        });
        if (notesCommitted.count !== 1) {
          return { ok: false, error: LEAD_EDIT_CONFLICT };
        }
      }
      return { ok: true, transition: null };
    }

    if (kind === "access") {
      await prisma.accessRequest.update({ where: { id }, data });
    } else if (kind === "waitlist") {
      await prisma.waitlistSignup.update({ where: { id }, data });
    } else if (kind === "booking") {
      await prisma.demoBooking.update({ where: { id }, data });
    } else {
      await prisma.acquisitionTrial.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { leadStatus: data.status } : {}),
          ...(data.notes !== undefined ? { founderNotes: data.notes } : {}),
        },
      });
    }
    return { ok: true, transition: null };
  } catch {
    return { ok: false, error: "Lead not found." };
  }
}
