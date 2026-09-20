import { z } from "zod";
import { addDays, zonedParts, zonedTimeToUtc } from "@/lib/timezone";
import type { CalendarSlot } from "@/modules/calendar/types";

/**
 * Opening hours, kept structured so booking is deterministic: an empty
 * calendar slot at 3 AM on a Sunday is not a free slot if the business is
 * shut. Stored on AgentProfile.openingHours as JSON; null means "no hours
 * set", which imposes no restriction (the behaviour before hours existed).
 *
 * Shape: one entry per weekday, each a list of [open, close] windows in
 * "HH:MM" 24h wall-clock time. An empty list is a closed day.
 */

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const windowSchema = z.tuple([z.string().regex(HHMM), z.string().regex(HHMM)]);
export const openingHoursSchema = z.object({
  sun: z.array(windowSchema),
  mon: z.array(windowSchema),
  tue: z.array(windowSchema),
  wed: z.array(windowSchema),
  thu: z.array(windowSchema),
  fri: z.array(windowSchema),
  sat: z.array(windowSchema),
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;
export type HoursWindow = [string, string];

export const DAY_LABELS: Record<DayKey, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

/** Validate stored JSON; anything malformed counts as "no hours set". */
export function parseOpeningHours(value: unknown): OpeningHours | null {
  const result = openingHoursSchema.safeParse(value);
  if (!result.success) return null;
  // Every window must close after it opens, or the day makes no sense.
  for (const key of DAY_KEYS) {
    for (const [open, close] of result.data[key]) {
      if (minutes(open) >= minutes(close)) return null;
    }
  }
  return result.data;
}

export function emptyHours(): OpeningHours {
  return { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Is the business open for the whole of this slot? Reads the slot on the
 * business's own clock. No hours set → always open (no restriction).
 */
export function isOpenFor(
  hours: OpeningHours | null,
  slot: CalendarSlot,
  timezone: string
): boolean {
  if (!hours) return true;
  const start = zonedParts(new Date(slot.start), timezone);
  const end = new Date(slot.end);
  const day = DAY_KEYS[start.weekday];
  const startMin = start.hour * 60 + start.minute;
  // Slot length on the clock; slots never straddle midnight in practice, and
  // one that does simply fails to fit any window.
  const lengthMin = Math.round((end.getTime() - new Date(slot.start).getTime()) / 60_000);
  return hours[day].some(
    ([open, close]) => startMin >= minutes(open) && startMin + lengthMin <= minutes(close)
  );
}

/** The open windows of the day `instant` falls on, as concrete slots. */
export function openWindowsOn(
  hours: OpeningHours,
  instant: Date,
  timezone: string
): CalendarSlot[] {
  const date = zonedParts(instant, timezone);
  const day = DAY_KEYS[date.weekday];
  return hours[day].map(([open, close]) => ({
    start: zonedTimeToUtc({ ...date, hour: Number(open.slice(0, 2)), minute: Number(open.slice(3)) }, timezone).toISOString(),
    end: zonedTimeToUtc({ ...date, hour: Number(close.slice(0, 2)), minute: Number(close.slice(3)) }, timezone).toISOString(),
  }));
}

/** "10:00 am – 8:00 pm" / "Closed" for the day `instant` falls on. */
export function describeDay(hours: OpeningHours, instant: Date, timezone: string): string {
  const date = zonedParts(instant, timezone);
  const windows = hours[DAY_KEYS[date.weekday]];
  if (!windows.length) return `Closed on ${DAY_LABELS[DAY_KEYS[date.weekday]]}`;
  return windows.map(([o, c]) => `${clock(o)} – ${clock(c)}`).join(", ");
}

function clock(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${h12} ${suffix}` : `${h12}:${m} ${suffix}`;
}

/**
 * Free slots of `durationMin`, at `stepMin` intervals, inside the open windows
 * of the days from `from` onwards, skipping anything overlapping `busy`.
 * With no hours set, the day is treated as open 9–9 so a search still
 * returns something sensible. Never returns a slot that has already started.
 */
export function freeSlots(input: {
  hours: OpeningHours | null;
  busy: CalendarSlot[];
  from: Date;
  timezone: string;
  durationMin?: number;
  stepMin?: number;
  limit?: number;
  daysAhead?: number;
}): CalendarSlot[] {
  const duration = (input.durationMin ?? 60) * 60_000;
  const step = (input.stepMin ?? 30) * 60_000;
  const limit = input.limit ?? 2;
  const days = input.daysAhead ?? 7;
  const out: CalendarSlot[] = [];

  const hours = input.hours ?? allDay(input.timezone);
  for (let d = 0; d < days && out.length < limit; d++) {
    const dayInstant = d === 0 ? input.from : startOfDayPlus(input.from, d, input.timezone);
    for (const window of openWindowsOn(hours, dayInstant, input.timezone)) {
      let t = Math.max(new Date(window.start).getTime(), roundUp(input.from.getTime(), step));
      const close = new Date(window.end).getTime();
      while (t + duration <= close && out.length < limit) {
        const slot = { start: new Date(t).toISOString(), end: new Date(t + duration).toISOString() };
        if (!overlapsAny(slot, input.busy)) out.push(slot);
        t += step;
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

function allDay(timezone: string): OpeningHours {
  void timezone;
  const w: HoursWindow[] = [["09:00", "21:00"]];
  return { sun: w, mon: w, tue: w, wed: w, thu: w, fri: w, sat: w };
}

function startOfDayPlus(from: Date, days: number, timezone: string): Date {
  const date = addDays(zonedParts(from, timezone), days);
  return zonedTimeToUtc({ ...date, hour: 0, minute: 0 }, timezone);
}

function roundUp(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

export function overlapsAny(slot: CalendarSlot, busy: CalendarSlot[]): boolean {
  const s = new Date(slot.start).getTime();
  const e = new Date(slot.end).getTime();
  return busy.some((b) => new Date(b.start).getTime() < e && new Date(b.end).getTime() > s);
}
