import { prisma } from "@/lib/db";
import { voiceUsage } from "@/modules/voice/usage";

export interface DailyCount {
  label: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Zero-filled daily series (oldest → newest) over the last `days` days ending
 * today; `weight` lets the same helper sum cost instead of counting. Pure.
 */
export function dailySeries(
  items: { at: Date; weight?: number }[],
  days: number,
  now = new Date()
): DailyCount[] {
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(dayLabel(new Date(now.getTime() - i * DAY_MS)), 0);
  for (const it of items) {
    const label = dayLabel(it.at);
    if (byDay.has(label)) byDay.set(label, (byDay.get(label) ?? 0) + (it.weight ?? 1));
  }
  return [...byDay].map(([label, count]) => ({ label, count }));
}

/** What one org consumes and produces over a window — cost side and value side. */
export interface OrgUsage {
  days: number;
  aiCostMicroUsd: number;
  aiCostByokMicroUsd: number;
  aiCalls: number;
  aiByPurpose: { purpose: string; calls: number; costMicroUsd: number }[];
  aiCostByDay: DailyCount[];
  messagesIn: number;
  messagesOut: number;
  messagesByDay: DailyCount[];
  bookings: number;
  paymentsPaid: number;
  paymentsRequested: number;
  voiceCalls: number;
  voiceMinutesUsed: number;
  voiceMinutesIncluded: number | null;
  contacts: number;
  optedIn: number;
  optedOut: number;
  conversations: number;
}

export async function orgUsage(orgId: string, days: number, now = new Date()): Promise<OrgUsage> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [ai, aiByPurpose, msgs, bookings, paymentsPaid, paymentsRequested, voiceCalls, voice, contacts, optedIn, optedOut, conversations] =
    await Promise.all([
      prisma.aiUsage.findMany({ where: { orgId, createdAt: { gte: since } }, select: { costMicroUsd: true, byok: true, createdAt: true } }),
      prisma.aiUsage.groupBy({ by: ["purpose"], where: { orgId, createdAt: { gte: since } }, _count: true, _sum: { costMicroUsd: true } }),
      prisma.conversationMessage.findMany({
        where: { conversation: { orgId }, createdAt: { gte: since } },
        select: { direction: true, createdAt: true },
      }),
      prisma.bookingRequest.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.paymentRequest.count({ where: { orgId, status: "paid", paidAt: { gte: since } } }),
      prisma.paymentRequest.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.voiceCall.count({ where: { orgId, startedAt: { gte: since } } }),
      voiceUsage(orgId, 0, now),
      prisma.contact.count({ where: { orgId } }),
      prisma.contact.count({ where: { orgId, optedIn: true, optedOutAt: null } }),
      prisma.contact.count({ where: { orgId, optedOutAt: { not: null } } }),
      prisma.conversation.count({ where: { orgId } }),
    ]);
  let aiCost = 0;
  let aiByok = 0;
  for (const row of ai) {
    aiCost += row.costMicroUsd;
    if (row.byok) aiByok += row.costMicroUsd;
  }
  return {
    days,
    aiCostMicroUsd: aiCost,
    aiCostByokMicroUsd: aiByok,
    aiCalls: ai.length,
    aiByPurpose: aiByPurpose
      .map((p) => ({ purpose: p.purpose, calls: p._count, costMicroUsd: p._sum.costMicroUsd ?? 0 }))
      .sort((a, b) => b.costMicroUsd - a.costMicroUsd),
    aiCostByDay: dailySeries(ai.map((r) => ({ at: r.createdAt, weight: r.costMicroUsd })), days, now),
    messagesIn: msgs.filter((m) => m.direction === "inbound").length,
    messagesOut: msgs.filter((m) => m.direction === "outbound").length,
    messagesByDay: dailySeries(msgs.map((m) => ({ at: m.createdAt })), days, now),
    bookings,
    paymentsPaid,
    paymentsRequested,
    voiceCalls,
    voiceMinutesUsed: voice.used,
    voiceMinutesIncluded: voice.limit,
    contacts,
    optedIn,
    optedOut,
    conversations,
  };
}
