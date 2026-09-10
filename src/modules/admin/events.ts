import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Event/funnel queries for the founder panel (cross-org module rules apply —
 * see queries.ts). ContactEvent is append-only history written since E0;
 * this page is what the which-vertical-demand decision reads.
 */

export interface EventsOverview {
  eventTypes: string[];
  verticals: string[];
  /** Totals per event type in range, largest first. */
  typeTotals: { type: string; count: number }[];
  /** Per-day counts per type (pivot), oldest day first. */
  byDay: { label: string; counts: Record<string, number> }[];
  /** Org signups in range grouped by vertical, largest first. */
  signupsByVertical: { vertical: string; count: number }[];
  recent: {
    type: string;
    orgId: string;
    orgName: string;
    createdAt: Date;
  }[];
}

const EVENT_SCAN_CAP = 20_000;
export const EVENT_RANGES = [7, 30, 90] as const;
export type EventRange = (typeof EVENT_RANGES)[number];

export interface EventsFilter {
  days?: number;
  type?: string;
  orgId?: string;
  vertical?: string;
}

export function parseEventsDays(value: unknown): EventRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return (EVENT_RANGES as readonly number[]).includes(parsed) ? (parsed as EventRange) : 30;
}

/** One privacy-safe predicate reused for totals, chart series, and recent rows. */
export function eventsWhere(filter: EventsFilter, since: Date): Prisma.ContactEventWhereInput {
  const where: Prisma.ContactEventWhereInput = { createdAt: { gte: since } };
  const type = filter.type?.trim();
  const orgId = filter.orgId?.trim();
  const vertical = filter.vertical?.trim();
  if (type && type !== "all") where.type = type;
  if (orgId) where.orgId = orgId;
  if (vertical && vertical !== "all") where.org = { vertical };
  return where;
}

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

export async function eventsOverview(
  filter: EventsFilter = {},
  now = new Date()
): Promise<EventsOverview> {
  const days = parseEventsDays(filter.days);
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const where = eventsWhere(filter, since);
  const vertical = filter.vertical?.trim();
  const orgId = filter.orgId?.trim();

  const [typeGroups, rangeEvents, verticalGroups, recent] = await Promise.all([
    prisma.contactEvent.groupBy({
      by: ["type"],
      where,
      _count: true,
    }),
    prisma.contactEvent.findMany({
      where,
      select: { type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: EVENT_SCAN_CAP,
    }),
    prisma.org.groupBy({
      by: ["vertical"],
      where: {
        createdAt: { gte: since },
        ...(orgId ? { id: orgId } : {}),
        ...(vertical && vertical !== "all" ? { vertical } : {}),
      },
      _count: true,
    }),
    prisma.contactEvent.findMany({
      where,
      select: {
        type: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const count = (g: { _count: number | { _all?: number } }): number =>
    typeof g._count === "number" ? g._count : (g._count._all ?? 0);

  return {
    eventTypes: typeGroups.map((group) => group.type).sort(),
    verticals: verticalGroups.map((group) => group.vertical ?? "unset").sort(),
    typeTotals: typeGroups
      .map((g) => ({ type: g.type, count: count(g) }))
      .sort((a, b) => b.count - a.count),
    byDay: pivotByDay(days, now, rangeEvents),
    signupsByVertical: verticalGroups
      .map((g) => ({ vertical: g.vertical ?? "unset", count: count(g) }))
      .sort((a, b) => b.count - a.count),
    recent: recent.map((e) => ({
      type: e.type,
      orgId: e.org.id,
      orgName: e.org.name,
      createdAt: e.createdAt,
    })),
  };
}
