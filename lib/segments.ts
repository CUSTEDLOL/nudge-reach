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
  assignedToUserId?: string;
  /** Free-text search over name / phone / email. */
  q?: string;
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
  if (filter.assignedToUserId) where.assignedToUserId = filter.assignedToUserId;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { phoneE164: { contains: filter.q } },
      { email: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return where;
}
