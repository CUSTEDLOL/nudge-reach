import { prisma } from "@/lib/db";
import { getPlan } from "@/modules/billing/plans";
import {
  computeChurnRisk,
  computeLeadScore,
  type ScoringFeatures,
} from "@/modules/scoring";

/**
 * Feature gathering + persistence for E6. Recompute is fire-and-forget from
 * hot paths and batched on the cron tick — scoring must never slow down or
 * break a customer-facing flow.
 */

const DAY_MS = 24 * 3600_000;
const STALE_AFTER_MS = DAY_MS; // rescore at most daily per contact
const BATCH_PER_TICK = 200;

async function gatherFeatures(
  orgId: string,
  contactId: string,
  now: Date
): Promise<ScoringFeatures | null> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId },
    select: { leadStage: true, optedOutAt: true },
  });
  if (!contact) return null;

  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const [conversation, inboundLast30d, campaignStatuses, bookings, paymentsPaid] =
    await Promise.all([
      prisma.conversation.findUnique({
        where: { orgId_contactId: { orgId, contactId } },
        select: { id: true, lastInboundAt: true },
      }),
      prisma.conversationMessage.count({
        where: {
          conversation: { orgId, contactId },
          direction: "inbound",
          createdAt: { gte: since30d },
        },
      }),
      prisma.message.groupBy({
        by: ["status"],
        where: { contactId, campaign: { orgId } },
      }),
      prisma.bookingRequest.groupBy({
        by: ["status"],
        _count: true,
        where: { orgId, contactId },
      }),
      prisma.paymentRequest.count({
        where: { orgId, contactId, status: "paid" },
      }),
    ]);

  const bookingCount = (status: string) =>
    bookings.find((b) => b.status === status)?._count ?? 0;
  const statuses = new Set(campaignStatuses.map((s) => s.status));
  const lastInbound = conversation?.lastInboundAt ?? null;

  return {
    daysSinceLastInbound: lastInbound
      ? Math.floor((now.getTime() - lastInbound.getTime()) / DAY_MS)
      : null,
    inboundLast30d,
    clickedCampaign: statuses.has("CLICKED"),
    readCampaign: statuses.has("READ"),
    bookingsCompleted: bookingCount("completed"),
    bookingsNoShow: bookingCount("no_show"),
    bookingsUpcoming: bookingCount("confirmed") + bookingCount("pending"),
    paymentsPaid,
    leadStage: contact.leadStage,
    optedOut: contact.optedOutAt !== null,
  };
}

/** Activity dates for churn cadence: kept bookings + paid payments. */
async function gatherActivityDates(orgId: string, contactId: string): Promise<Date[]> {
  const [bookings, payments] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: { orgId, contactId, status: "completed" },
      select: { scheduledFor: true, createdAt: true },
    }),
    prisma.paymentRequest.findMany({
      where: { orgId, contactId, status: "paid", paidAt: { not: null } },
      select: { paidAt: true },
    }),
  ]);
  return [
    ...bookings.map((b) => b.scheduledFor ?? b.createdAt),
    ...payments.map((p) => p.paidAt!),
  ];
}

/** Score one contact and persist. Never throws (hot-path safe). Plan-gated. */
export async function scoreContact(orgId: string, contactId: string): Promise<void> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!org || !getPlan(org.plan).limits.leadScoring) return;
    const now = new Date();
    const features = await gatherFeatures(orgId, contactId, now);
    if (!features) return;
    const { score, reasons } = computeLeadScore(features);

    // Churn only means something for repeat customers.
    const activity = await gatherActivityDates(orgId, contactId);
    const churn = activity.length >= 2 ? computeChurnRisk(activity, now) : null;

    await prisma.contact.updateMany({
      where: { id: contactId, orgId },
      data: { leadScore: score, leadScoreReasons: reasons, churnRisk: churn, scoredAt: now },
    });
  } catch (err) {
    console.error("[scoring] scoreContact failed", err);
  }
}

/** Fire-and-forget wrapper for hot paths (inbound messages). */
export function scoreContactSoon(orgId: string, contactId: string): void {
  void scoreContact(orgId, contactId);
}

/**
 * Cron batch: rescore stale contacts for orgs whose plan has leadScoring.
 * Bounded per tick so the cron stays fast at any org size.
 */
export async function tickLeadScoring(now: Date = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
  const candidates = await prisma.contact.findMany({
    where: {
      OR: [{ scoredAt: null }, { scoredAt: { lt: staleBefore } }],
    },
    select: { id: true, orgId: true, org: { select: { plan: true } } },
    orderBy: { scoredAt: { sort: "asc", nulls: "first" } },
    take: BATCH_PER_TICK,
  });

  let scored = 0;
  for (const c of candidates) {
    if (!getPlan(c.org.plan).limits.leadScoring) continue;
    await scoreContact(c.orgId, c.id);
    scored++;
  }
  return scored;
}
