import { prisma } from "@/lib/db";
import { getPlan } from "@/modules/billing/plans";
import { ensureAgentProfile } from "@/modules/agent/profile";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { voiceDriverFor } from "@/modules/voice";
import { buildCallInit } from "@/modules/voice/initiation";

/**
 * Outbound reminder calls (moat 2, by phone). Opt-in per client
 * (FollowUpConfig.reminderCalls); only inside calling hours; never to a
 * contact who opted out. Runs on the same cron tick as WhatsApp reminders.
 */

const WINDOW_START_MIN = 90; // call when the booking is 90–150 minutes away
const WINDOW_END_MIN = 150;

export function isCallingHour(now: Date, timezone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(now)
  );
  return hour >= 9 && hour < 20;
}

export async function tickReminderCalls(now: Date = new Date()) {
  const result = { reminders: 0, noShows: 0, skipped: 0 };
  const configs = await prisma.followUpConfig.findMany({
    where: { enabled: true, reminderCalls: true },
    include: { org: { select: { plan: true } } },
  });
  for (const cfg of configs) {
    // E7 fix: reminder calls only run for plans with the voiceAgent flag.
    if (!getPlan(cfg.org.plan).limits.voiceAgent) continue;
    const [org, number] = await Promise.all([
      prisma.org.findUnique({ where: { id: cfg.orgId }, select: { id: true, timezone: true, simulated: true } }),
      prisma.voiceNumber.findFirst({ where: { orgId: cfg.orgId, enabled: true } }),
    ]);
    if (!org || !number || !isCallingHour(now, org.timezone)) continue;
    const profile = await ensureAgentProfile(org.id);
    if (!profile?.enabled) continue;
    const entries = await prisma.knowledgeEntry.findMany({
      where: { orgId: org.id, status: "active" },
      select: { category: true, fact: true, condition: true },
      take: 400,
    });
    const digest = buildKnowledgeDigest(entries);
    const driver = voiceDriverFor(org);

    const from = new Date(now.getTime() + WINDOW_START_MIN * 60_000);
    const to = new Date(now.getTime() + WINDOW_END_MIN * 60_000);
    const due = await prisma.bookingRequest.findMany({
      where: { orgId: org.id, status: "confirmed", reminder2SentAt: null, scheduledFor: { gte: from, lte: to } },
      include: { contact: true },
    });
    for (const booking of due) {
      if (booking.contact.optedOutAt) {
        result.skipped += 1;
        continue;
      }
      const init = buildCallInit({
        org: { id: org.id, timezone: org.timezone },
        number: {
          phoneE164: number.phoneE164,
          language: number.language,
          voiceId: number.voiceId,
          transferTo: number.transferTo,
        },
        profile: {
          vertical: profile.vertical,
          businessName: profile.businessName,
          businessInfo: profile.businessInfo,
          tone: profile.tone,
          doNots: profile.doNots,
        },
        knowledgeDigest: digest,
        contact: { name: booking.contact.name, phoneE164: booking.contact.phoneE164 },
        purpose: "reminder",
        booking: { requestedFor: booking.requestedFor, name: booking.name },
        now,
      });
      const placed = await driver.outboundCall({
        agentPhoneNumberId: number.elevenPhoneId ?? "sim",
        toE164: booking.contact.phoneE164,
        init,
      });
      await prisma.voiceCall.create({
        data: {
          orgId: org.id,
          contactId: booking.contact.id,
          direction: "outbound",
          purpose: "reminder",
          fromE164: number.phoneE164,
          toE164: booking.contact.phoneE164,
          providerCallId: placed.providerCallId ?? null,
          status: placed.ok ? "in_progress" : "failed",
        },
      });
      await prisma.bookingRequest.update({ where: { id: booking.id }, data: { reminder2SentAt: now } });
      if (placed.ok) result.reminders += 1;
      else result.skipped += 1;
    }
  }
  return result;
}
