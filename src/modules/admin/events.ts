import { prisma } from "@/lib/db";

/**
 * Event/funnel queries for the founder panel (cross-org module rules apply —
 * see queries.ts). ContactEvent is append-only history written since E0;
 * this page is what the which-vertical-demand decision reads.
 */

export interface EventsOverview {
  /** Totals per event type in range, largest first. */
  typeTotals: { type: string; count: number }[];
  /** Per-day counts per type (pivot), oldest day first. */
  byDay: { label: string; counts: Record<string, number> }[];
  /** Org signups in range grouped by vertical, largest first. */
  signupsByVertical: { vertical: string; count: number }[];
  recent: {
    type: string;
    orgName: string;
    createdAt: Date;
  }[];
}

const EVENT_SCAN_CAP = 20_000;

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Pure pivot: events → per-day stacked counts (exported for tests). */
export function pivotByDay(
  days: number,
  now: Date,
  events: { type: string; createdAt: Date }[]
): EventsOverview["byDay"] {
  const frame: { label: string; counts: Record<string, number> }[] = [];
  const index = new Map<string, Record<string, number>>();
  for (let i = days - 1; i >= 0; i--) {
    const label = dayLabel(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    const counts: Record<string, number> = {};
    frame.push({ label, counts });
    index.set(label, counts);
  }
  for (const e of events) {
    const counts = index.get(dayLabel(e.createdAt));
    if (counts) counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return frame;
}

export async function eventsOverview(days: number): Promise<EventsOverview> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [typeGroups, rangeEvents, verticalGroups, recent] = await Promise.all([
    prisma.contactEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.contactEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: EVENT_SCAN_CAP,
    }),
    prisma.org.groupBy({
      by: ["vertical"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.contactEvent.findMany({
      select: {
        type: true,
        createdAt: true,
        org: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const count = (g: { _count: number | { _all?: number } }): number =>
    typeof g._count === "number" ? g._count : (g._count._all ?? 0);

  return {
    typeTotals: typeGroups
      .map((g) => ({ type: g.type, count: count(g) }))
      .sort((a, b) => b.count - a.count),
    byDay: pivotByDay(days, new Date(), rangeEvents),
    signupsByVertical: verticalGroups
      .map((g) => ({ vertical: g.vertical ?? "unset", count: count(g) }))
      .sort((a, b) => b.count - a.count),
    recent: recent.map((e) => ({
      type: e.type,
      orgName: e.org.name,
      createdAt: e.createdAt,
    })),
  };
}
