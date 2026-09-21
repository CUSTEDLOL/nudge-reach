/**
 * Wall-clock ↔ instant conversion for a named IANA timezone, with no
 * dependency on the server's own zone. Vercel runs in UTC; every client
 * business does not. Anything that turns "4 PM" into a moment, or shows a
 * moment as a clock time, goes through here.
 */

export interface ZonedParts {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function formatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
}

/** The clock reading in `timezone` at `instant`. */
export function zonedParts(instant: Date, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // "24" never appears with hourCycle h23, but guard anyway.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/** Milliseconds `timezone` is ahead of UTC at `instant` (negative when behind). */
export function timezoneOffsetMs(instant: Date, timezone: string): number {
  const p = zonedParts(instant, timezone);
  const second = Number(
    formatter(timezone)
      .formatToParts(instant)
      .find((x) => x.type === "second")?.value ?? "0"
  );
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the clock in `timezone` reads the given wall time.
 * Two passes settle the offset across a DST change; zones without DST
 * (India, Singapore, the Gulf) resolve on the first.
 */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    guess = naive - timezoneOffsetMs(new Date(guess), timezone);
  }
  return new Date(guess);
}

/** Shift a calendar date by whole days without touching the clock. */
export function addDays(
  wall: { year: number; month: number; day: number },
  days: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** "Fri 18 Sept, 4:00 pm" in the business's own clock. */
export function formatInTimezone(
  instant: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone }).format(instant);
}
