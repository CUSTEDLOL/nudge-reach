/**
 * Pure, unit-tested helpers behind `lib/analytics/queries.ts`.
 * No Prisma / IO here — everything takes plain data in and returns plain
 * data out so the date-bucketing, funnel and response-time math is testable.
 */

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

/** Parse a `?range=` query value; anything unknown falls back to 30 days. */
export function parseRange(raw: string | string[] | undefined): RangeDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (RANGE_OPTIONS as readonly number[]).includes(n)
    ? (n as RangeDays)
    : 30;
}

const DAY_MS = 86_400_000;

/** Midnight UTC of the given instant (dates are stored UTC — AGENTS.md). */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface AnalyticsWindow {
  /** Inclusive start of the current period (UTC day boundary). */
  start: Date;
  /** "Now" — the exclusive end of the current period. */
  end: Date;
  /** Inclusive start of the previous period (ends at `start`). */
  prevStart: Date;
}

/**
 * Current period = the last `days` UTC days including today; previous period
 * = the `days` days immediately before it (for delta comparisons).
 */
export function windowFor(days: RangeDays, now: Date = new Date()): AnalyticsWindow {
  const start = new Date(utcDayStart(now).getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  return { start, end: now, prevStart };
}

/** UTC day bucket key, e.g. "2026-07-02". */
export function dayKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DayPoint {
  /** UTC day key, e.g. "2026-07-02". */
  day: string;
  /** Short en-IN label, e.g. "2 Jul". */
  label: string;
  inbound: number;
  outbound: number;
}

/**
 * Bucket message events into a zero-filled daily series of `days` UTC days
 * ending on `end`'s day. Events outside the window are dropped.
 */
export function fillDailyCounts(
  days: number,
  end: Date,
  entries: Array<{ at: Date; direction: "inbound" | "outbound" }>
): DayPoint[] {
  const labelFmt = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const byDay = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY_MS);
    const key = dayKeyUTC(d);
    byDay.set(key, { day: key, label: labelFmt.format(d), inbound: 0, outbound: 0 });
  }
  for (const entry of entries) {
    const point = byDay.get(dayKeyUTC(entry.at));
    if (!point) continue;
    point[entry.direction] += 1;
  }
  return [...byDay.values()];
}

/** Gaps longer than this are capped so one forgotten thread can't dominate. */
export const FIRST_RESPONSE_CAP_MINUTES = 24 * 60;

/**
 * First-response gaps in minutes for one conversation's messages (ascending
 * by time). For each run of consecutive inbound messages, the gap is measured
 * from the FIRST inbound of the run to the next outbound reply. Inbound runs
 * that never got a reply produce no gap. Each gap is capped at `capMinutes`.
 */
export function firstResponseGaps(
  messages: Array<{ direction: string; createdAt: Date }>,
  capMinutes: number = FIRST_RESPONSE_CAP_MINUTES
): number[] {
  const gaps: number[] = [];
  let pendingInboundAt: Date | null = null;
  for (const m of messages) {
    if (m.direction === "inbound") {
      if (pendingInboundAt === null) pendingInboundAt = m.createdAt;
    } else if (pendingInboundAt !== null) {
      const minutes =
        (m.createdAt.getTime() - pendingInboundAt.getTime()) / 60_000;
      gaps.push(Math.min(Math.max(minutes, 0), capMinutes));
      pendingInboundAt = null;
    }
  }
  return gaps;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** numerator ÷ denominator as a 0–1 rate, or null when the denominator is 0. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** "62%" — or an honest "—" when there is no denominator. */
export function formatPct(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** "8m", "1h 12m", "<1m" — or "—" when there were no replies to measure. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface Delta {
  label: string;
  direction: "up" | "down" | "neutral";
}

/**
 * Count delta vs the previous period as a % change. Returns undefined when
 * both periods are zero; an absolute "+n" when the previous period was zero
 * (a % change from 0 would be fabricated).
 */
export function countDelta(
  current: number,
  previous: number,
  days: number
): Delta | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) {
    return { label: `+${current} vs prev ${days}d`, direction: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${pct > 0 ? "+" : ""}${pct}% vs prev ${days}d`,
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
  };
}

/**
 * Rate delta vs the previous period in percentage points. Undefined when
 * either period has no denominator — no fabricated comparisons.
 */
export function rateDelta(
  current: number | null,
  previous: number | null,
  days: number
): Delta | undefined {
  if (current === null || previous === null) return undefined;
  const pts = Math.round((current - previous) * 1000) / 10;
  return {
    label: `${pts > 0 ? "+" : ""}${pts} pts vs prev ${days}d`,
    direction: pts > 0 ? "up" : pts < 0 ? "down" : "neutral",
  };
}
