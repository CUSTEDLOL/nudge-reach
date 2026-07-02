import type { Prisma } from "@prisma/client";
import type { LeadStage } from "@prisma/client";

/**
 * Dynamic segments = saved filter criteria over Contacts (spec §M3).
 * Audiences stay static lists; a segment materializes to contacts at use time
 * (list filtering, campaign audience picking). Owned by M3; consumed by M4.
 */
export interface SegmentFilter {
  stage?: LeadStage;
  tagId?: string;
  optedIn?: boolean;
  source?: string;
  /** A Membership.userId, or the sentinel "unassigned" for no assignee. */
  assignedToUserId?: string;
  /** Free-text search over name / phone / email. */
  q?: string;
}

const LEAD_STAGES: ReadonlySet<string> = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "WON",
  "LOST",
]);

/**
 * Parse URL search params (e.g. /contacts?stage=WON&tag=…&optin=yes) into a
 * SegmentFilter. Unknown/empty values are dropped, so a hand-edited URL can
 * never produce an invalid Prisma query. Shared by the contacts list (M3) and
 * the campaign audience picker (M4).
 */
export function parseSegmentFilter(
  params: Record<string, string | string[] | undefined>
): SegmentFilter {
  const get = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };

  const filter: SegmentFilter = {};
  const stage = get("stage");
  if (stage && LEAD_STAGES.has(stage)) filter.stage = stage as LeadStage;
  const tagId = get("tag");
  if (tagId) filter.tagId = tagId;
  const optin = get("optin");
  if (optin === "yes") filter.optedIn = true;
  if (optin === "no") filter.optedIn = false;
  const source = get("source");
  if (source) filter.source = source;
  const assignee = get("assignee");
  if (assignee) filter.assignedToUserId = assignee;
  const q = get("q");
  if (q) filter.q = q.slice(0, 100);
  return filter;
}

/** Build an org-scoped Prisma where clause from a segment filter. */
export function buildContactWhere(
  orgId: string,
  filter: SegmentFilter
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { orgId };
  if (filter.stage) where.leadStage = filter.stage;
  if (filter.tagId) where.tags = { some: { tagId: filter.tagId } };
  if (filter.optedIn !== undefined) {
    // Consent semantics match lib/consent.ts: opted-out is permanent.
    where.optedIn = filter.optedIn;
    if (filter.optedIn) where.optedOutAt = null;
  }
  if (filter.source) where.optInSource = filter.source;
  if (filter.assignedToUserId) {
    where.assignedToUserId =
      filter.assignedToUserId === "unassigned" ? null : filter.assignedToUserId;
  }
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { phoneE164: { contains: filter.q } },
      { email: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return where;
}
