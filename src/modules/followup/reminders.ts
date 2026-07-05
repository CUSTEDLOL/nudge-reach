import { prisma } from "@/lib/db";
import { sendApprovedTemplate } from "@/modules/followup/send";
import { planHasAiFrontDesk } from "@/modules/billing/limits";

const HOUR = 3_600_000;

export interface ReminderTickResult {
  reminders: number;
  reviews: number;
  rebooks: number;
}

/**
 * The outbound moat: business-initiated, time-absolute follow-ups the inbound-
 * only platform agents can't do. Runs on the cron tick alongside the campaign /
 * automation ticks. Every send goes through the approved-template + consent path
 * (sendApprovedTemplate → sendMessage), so simulation, consent and template
 * approval all still apply. Idempotent: each booking carries a one-shot stamp
 * per follow-up so a re-tick never double-sends.
 */
export async function tickBookingReminders(
  now: Date = new Date()
): Promise<ReminderTickResult> {
  const result: ReminderTickResult = { reminders: 0, reviews: 0, rebooks: 0 };
  const configs = await prisma.followUpConfig.findMany({ where: { enabled: true } });
  if (!configs.length) return result;

  // Runtime flagship gate: an org that downgraded off AI Front Desk stops
  // running the paid moat, even if its config row is still enabled.
  const orgs = await prisma.org.findMany({
    where: { id: { in: configs.map((c) => c.orgId) } },
    select: { id: true, plan: true },
  });
  const flagship = new Set(
    orgs.filter((o) => planHasAiFrontDesk(o.plan)).map((o) => o.id)
  );

  for (const cfg of configs) {
    if (!flagship.has(cfg.orgId)) continue;
    // 1) T-24h reminder — confirmed booking due in the 2h–24h window (the >2h
    //    lower bound stops a same-day booking from getting BOTH reminders on one
    //    tick, and keeps the "tomorrow" copy honest).
    if (cfg.bookingReminders) {
      const due24 = await prisma.bookingRequest.findMany({
        where: {
          orgId: cfg.orgId,
          status: "confirmed",
          reminder24SentAt: null,
          scheduledFor: {
            gt: new Date(now.getTime() + 2 * HOUR),
            lte: new Date(now.getTime() + 24 * HOUR),
          },
        },
        include: { contact: true },
        take: 200,
      });
      for (const b of due24) {
        const r = await sendApprovedTemplate(b.contact, "appt_reminder_24h", b.conversationId);
        await stamp(b.id, { reminder24SentAt: now });
        if (r.ok) result.reminders++;
      }

      // 2) T-2h reminder — due within the next 2h.
      const due2 = await prisma.bookingRequest.findMany({
        where: {
          orgId: cfg.orgId,
          status: "confirmed",
          reminder2SentAt: null,
          scheduledFor: { gt: now, lte: new Date(now.getTime() + 2 * HOUR) },
        },
        include: { contact: true },
        take: 200,
      });
      for (const b of due2) {
        const r = await sendApprovedTemplate(b.contact, "appt_reminder_2h", b.conversationId);
        await stamp(b.id, { reminder2SentAt: now });
        if (r.ok) result.reminders++;
      }
    }

    // 3) Post-service review — appointment finished 2h+ ago, still confirmed.
    if (cfg.postServiceReview) {
      const done = await prisma.bookingRequest.findMany({
        where: {
          orgId: cfg.orgId,
          status: "confirmed",
          reviewAskedAt: null,
          scheduledFor: { lt: new Date(now.getTime() - 2 * HOUR) },
        },
        include: { contact: true },
        take: 200,
      });
      for (const b of done) {
        const r = await sendApprovedTemplate(b.contact, "review_ask", b.conversationId);
        await prisma.bookingRequest.update({
          where: { id: b.id },
          data: { reviewAskedAt: now, status: "completed" },
        });
        if (r.ok) result.reviews++;
      }
    }

    // 4) No-show rebook — staff marked the booking no_show; chase once (MARKETING,
    //    so consent still gates it). reviewAskedAt doubles as the terminal stamp.
    if (cfg.noShowRebook) {
      const noShows = await prisma.bookingRequest.findMany({
        where: { orgId: cfg.orgId, status: "no_show", reviewAskedAt: null },
        include: { contact: true },
        take: 200,
      });
      for (const b of noShows) {
        const r = await sendApprovedTemplate(b.contact, "no_show_rebook", b.conversationId);
        await stamp(b.id, { reviewAskedAt: now });
        if (r.ok) result.rebooks++;
      }
    }
  }

  return result;
}

function stamp(id: string, data: Record<string, Date>) {
  return prisma.bookingRequest.update({ where: { id }, data });
}
