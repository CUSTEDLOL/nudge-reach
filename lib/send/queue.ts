import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { canSendMarketing } from "@/lib/consent";
import { sendMessage } from "@/lib/messaging";
import {
  isForwardTransition,
  simulatedStatusFor,
} from "@/lib/send/sim-progress";

/**
 * Postgres-backed send queue (smallest reversible choice — no extra infra;
 * an Inngest/worker swap stays possible behind these functions).
 *
 * - enqueueCampaign: consent-gated fan-out to Message rows (QUEUED)
 * - processQueue: rate-limited batch sender (called on dashboard views and
 *   by /api/cron/process-queue)
 * - releaseDueCampaigns: SCHEDULED → SENDING once scheduledAt is due (cron)
 * - applySimulatedProgress: simulation-mode status lifecycle
 */

const BATCH_SIZE = 30;

export async function enqueueCampaign(
  campaignId: string,
  audienceId: string,
  orgId: string
): Promise<{ queued: number; skippedNoConsent: number }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.status !== "TEMPLATE_APPROVED") {
    throw new Error("The template must be approved before sending.");
  }

  const members = await prisma.audienceContact.findMany({
    where: { audienceId, audience: { orgId } },
    include: { contact: true },
  });
  if (members.length === 0) {
    throw new Error("That audience is empty.");
  }

  // THE consent gate (rule 2): only opted-in, never-opted-out contacts are
  // ever enqueued. The messaging layer re-checks per send.
  const eligible = members.filter((m) => canSendMarketing(m.contact));
  const skippedNoConsent = members.length - eligible.length;
  if (eligible.length === 0) {
    throw new Error("No one in that audience has opted in.");
  }

  await prisma.$transaction([
    prisma.message.createMany({
      data: eligible.map((m) => ({
        campaignId,
        contactId: m.contact.id,
      })),
      skipDuplicates: true,
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING", audienceId },
    }),
  ]);

  return { queued: eligible.length, skippedNoConsent };
}

export async function processQueue(campaignId: string): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      templates: { orderBy: { submittedAt: "desc" }, take: 1 },
      product: { select: { photoUrl: true } },
    },
  });
  if (!campaign || campaign.status !== "SENDING") return 0;
  const template = campaign.templates[0];
  if (!template || template.metaStatus !== "APPROVED") return 0;

  const queued = await prisma.message.findMany({
    where: { campaignId, status: "QUEUED" },
    include: { contact: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  let processed = 0;
  for (const message of queued) {
    const result = await sendMessage(
      "whatsapp",
      {
        address: message.contact.phoneE164,
        optedIn: message.contact.optedIn,
        optedOutAt: message.contact.optedOutAt,
      },
      {
        kind: "template",
        category: "MARKETING",
        templateName: template.name,
        language: template.language,
        bodyParams: [message.contact.name.split(" ")[0]],
        headerImageUrl: campaign.product.photoUrl ?? undefined,
      }
    );

    await prisma.message.update({
      where: { id: message.id },
      data: result.ok
        ? {
            status: "SENT",
            metaMessageId: result.providerMessageId,
            sentAt: new Date(),
          }
        : {
            status: "FAILED",
            errorCode: result.blockedByConsent
              ? "no_consent"
              : result.error?.slice(0, 100) ?? "send_failed",
          },
    });
    processed++;
    // Gentle pacing — Meta throttles by quality tier; ~10 msgs/sec is safe.
    if (env.SEND_MODE === "live") {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await maybeCompleteCampaign(campaignId);
  return processed;
}

/**
 * Cron tick for scheduled broadcasts (spec §M4): every SCHEDULED campaign
 * whose scheduledAt is due and which has an audience picked gets enqueued.
 *
 * A campaign can only reach SCHEDULED from TEMPLATE_APPROVED (the wizard and
 * the run panel enforce this), so its latest template is already approved —
 * we flip the status back before calling enqueueCampaign, which re-validates.
 * The updateMany claim is atomic, so concurrent cron ticks can't
 * double-release the same campaign.
 */
export async function releaseDueCampaigns(): Promise<number> {
  const due = await prisma.campaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
      audienceId: { not: null },
    },
    select: { id: true, orgId: true, audienceId: true },
  });

  let released = 0;
  for (const campaign of due) {
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "TEMPLATE_APPROVED" },
    });
    if (claimed.count === 0) continue; // another tick claimed it first

    try {
      await enqueueCampaign(campaign.id, campaign.audienceId!, campaign.orgId);
      released++;
    } catch {
      // Audience emptied or everyone opted out since scheduling. The campaign
      // stays TEMPLATE_APPROVED so the owner can re-run it manually; we don't
      // retry a broken schedule forever.
      await prisma.campaign.updateMany({
        where: { id: campaign.id },
        data: { scheduledAt: null },
      });
    }
  }
  return released;
}

/** Simulation only: advance message statuses on the deterministic timeline. */
export async function applySimulatedProgress(campaignId: string): Promise<void> {
  if (env.SEND_MODE !== "simulation") return;
  const rate = Math.round((env.WHATSAPP_MARKETING_RATE_INR ?? 0.99) * 100);

  const messages = await prisma.message.findMany({
    where: {
      campaignId,
      status: { in: ["SENT", "DELIVERED", "READ"] },
      sentAt: { not: null },
    },
  });

  const now = Date.now();
  for (const message of messages) {
    const next = simulatedStatusFor(message.id, message.sentAt!.getTime(), now);
    if (next !== message.status && isForwardTransition(message.status, next)) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: next,
          // billing is per delivered message
          costMinorUnits:
            next === "FAILED" ? null : message.costMinorUnits ?? rate,
        },
      });
    }
  }

  await maybeCompleteCampaign(campaignId);
}

async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const remaining = await prisma.message.count({
    where: { campaignId, status: "QUEUED" },
  });
  if (remaining === 0) {
    await prisma.campaign.updateMany({
      where: { id: campaignId, status: "SENDING" },
      data: { status: "SENT" },
    });
  }
}

/** Window after the last send during which simulated statuses still evolve. */
const SETTLE_WINDOW_MS = 25_000;

export async function campaignStats(campaignId: string) {
  const [groups, agg] = await Promise.all([
    prisma.message.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
      _sum: { costMinorUnits: true },
    }),
    prisma.message.aggregate({
      where: { campaignId },
      _max: { sentAt: true },
    }),
  ]);
  const byStatus: Record<string, number> = {};
  let total = 0;
  let actualCostMinor = 0;
  for (const g of groups) {
    byStatus[g.status] = g._count;
    total += g._count;
    actualCostMinor += g._sum.costMinorUnits ?? 0;
  }
  const delivered =
    (byStatus.DELIVERED ?? 0) + (byStatus.READ ?? 0) + (byStatus.CLICKED ?? 0);
  const queued = byStatus.QUEUED ?? 0;
  const lastSentAt = agg._max.sentAt;

  // "Settled" = nothing left to send AND past the simulated-progress window,
  // so the dashboard can stop polling instead of refreshing forever.
  const settled =
    queued === 0 &&
    (!lastSentAt || Date.now() - lastSentAt.getTime() > SETTLE_WINDOW_MS);

  return {
    total,
    queued,
    sent: (byStatus.SENT ?? 0) + delivered,
    delivered,
    read: (byStatus.READ ?? 0) + (byStatus.CLICKED ?? 0),
    clicked: byStatus.CLICKED ?? 0,
    failed: byStatus.FAILED ?? 0,
    actualCostMinor,
    settled,
  };
}
