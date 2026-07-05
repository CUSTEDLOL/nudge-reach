import { prisma } from "@/lib/db";

export interface RecoveryMetrics {
  enabled: boolean;
  bookingsThisMonth: number;
  followUpsThisMonth: number;
}

/** Honest counting (no inflated attribution): bookings created this month and
 *  Revenue-Recovery follow-ups actually sent this month (reminder/review stamps). */
export async function getRecoveryMetrics(
  orgId: string,
  now: Date = new Date()
): Promise<RecoveryMetrics> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [config, bookingsThisMonth, r24, r2, terminal] = await Promise.all([
    prisma.followUpConfig.findUnique({ where: { orgId } }),
    prisma.bookingRequest.count({ where: { orgId, createdAt: { gte: monthStart } } }),
    prisma.bookingRequest.count({
      where: { orgId, reminder24SentAt: { gte: monthStart } },
    }),
    prisma.bookingRequest.count({
      where: { orgId, reminder2SentAt: { gte: monthStart } },
    }),
    prisma.bookingRequest.count({
      where: { orgId, reviewAskedAt: { gte: monthStart } },
    }),
  ]);
  return {
    enabled: config?.enabled ?? false,
    bookingsThisMonth,
    followUpsThisMonth: r24 + r2 + terminal,
  };
}
