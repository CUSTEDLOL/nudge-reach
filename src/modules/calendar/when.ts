/**
 * Best-effort natural-language → appointment time. Deterministic (takes `now`),
 * so it's unit-testable and the simulation flow is reproducible. When it can't
 * resolve a time it returns null and the booking tool falls back to the old
 * "record request + hand off to staff" behavior (graceful degradation).
 *
 * Not a full NL date library — it covers the phrasings customers actually use
 * ("tomorrow 8pm", "Sat 1pm", "20:00", ISO). The org can refine later.
 */

export interface ParsedWhen {
  start: Date;
  end: Date;
}

const APPOINTMENT_MINUTES = 60;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Extract an hour/minute from phrasings that carry an explicit time. */
function parseTimeOfDay(s: string): { h: number; m: number } | null {
  // "8pm", "8:30 pm", "at 8 pm"
  const ampm = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (ampm[3] === "pm") h += 12;
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    return h > 23 || m > 59 ? null : { h, m };
  }
  // 24h "20:00" / "20.00"
  const h24 = s.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    return h > 23 || m > 59 ? null : { h, m };
  }
  return null;
}

export function parseWhen(text: string, now: Date = new Date()): ParsedWhen | null {
  if (!text) return null;

  // 1) A real ISO / parseable timestamp wins outright.
  const direct = Date.parse(text);
  if (!Number.isNaN(direct)) {
    const start = new Date(direct);
    return { start, end: new Date(start.getTime() + APPOINTMENT_MINUTES * 60_000) };
  }

  const raw = text.trim().toLowerCase();
  const time = parseTimeOfDay(raw);
  if (!time) return null;

  const target = new Date(now);
  target.setSeconds(0, 0);

  const hasDayKeyword =
    raw.includes("tomorrow") ||
    raw.includes("today") ||
    WEEKDAYS.some((d) => raw.includes(d));

  if (raw.includes("tomorrow")) {
    target.setDate(target.getDate() + 1);
  } else if (!raw.includes("today")) {
    const wd = WEEKDAYS.findIndex((d) => raw.includes(d));
    if (wd >= 0) {
      let diff = (wd - target.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // "on Monday" means the next one, not today
      target.setDate(target.getDate() + diff);
    }
  }

  target.setHours(time.h, time.m, 0, 0);

  // A bare time already past today ("3pm" at 5pm) rolls to tomorrow.
  if (!hasDayKeyword && target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return {
    start: target,
    end: new Date(target.getTime() + APPOINTMENT_MINUTES * 60_000),
  };
}
