import { DAY_KEYS, emptyHours, parseOpeningHours, type DayKey, type OpeningHours } from "@/modules/calendar/hours";

/**
 * Deterministic reading of the way owners actually write hours in the
 * questionnaire — "Mon–Sat 10am–8pm, Sun closed", "Daily 9:30-21:00",
 * "Monday to Friday 9 am to 6 pm; Saturday 10-2". Returns null when a
 * segment can't be read, so the caller can fall back to the model or leave
 * hours unset rather than store something half right.
 */

const DAY_ALIASES: Record<string, DayKey> = {
  sun: "sun", sunday: "sun",
  mon: "mon", monday: "mon",
  tue: "tue", tues: "tue", tuesday: "tue",
  wed: "wed", weds: "wed", wednesday: "wed",
  thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
  fri: "fri", friday: "fri",
  sat: "sat", saturday: "sat",
};

const ALL_DAYS = /^(daily|every ?day|all days|everyday|7 days|mon(day)?\s*(-|–|—|to|through)\s*sun(day)?)$/;

function toMinutes(h: number, m: number, suffix: string | undefined, assumePm: boolean): number | null {
  if (suffix === "am") {
    if (h === 12) h = 0;
  } else if (suffix === "pm") {
    if (h !== 12) h += 12;
  } else if (assumePm && h < 9) {
    // "10-2" on a shop means 10 am to 2 pm.
    h += 12;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?`;
const RANGE = new RegExp(`${TIME}\\s*(?:-|–|—|to|till|until)\\s*${TIME}`, "i");

function readRange(m: RegExpMatchArray): [string, string] | null {
  const norm = (s?: string) => s?.replace(/\./g, "").toLowerCase();
  const openSuffix = norm(m[3]);
  const closeSuffix = norm(m[6]);
  const open = toMinutes(Number(m[1]), Number(m[2] ?? 0), openSuffix, false);
  let close = toMinutes(Number(m[4]), Number(m[5] ?? 0), closeSuffix, true);
  if (open === null || close === null) return null;
  // "10am–8" with no suffix on the close: read as pm when it would otherwise be earlier.
  if (!closeSuffix && close <= open && close + 12 * 60 <= 23 * 60 + 59) close += 12 * 60;
  if (close <= open) return null;
  return [hhmm(open), hhmm(close)];
}

/** Every "open – close" in a segment ("10 am to 2 pm and 4pm to 8pm" is two). */
function parseRanges(text: string): [string, string][] | null {
  const out: [string, string][] = [];
  for (const m of text.matchAll(new RegExp(RANGE.source, "gi"))) {
    const range = readRange(m);
    if (!range) return null;
    out.push(range);
  }
  return out.length ? out : null;
}

function parseDays(text: string): DayKey[] | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (ALL_DAYS.test(t)) return [...DAY_KEYS];
  const range = t.match(/^([a-z]+)\s*(?:-|–|—|to|through)\s*([a-z]+)$/);
  if (range) {
    const a = DAY_ALIASES[range[1]];
    const b = DAY_ALIASES[range[2]];
    if (!a || !b) return null;
    const out: DayKey[] = [];
    let i = DAY_KEYS.indexOf(a);
    for (let n = 0; n < 7; n++) {
      out.push(DAY_KEYS[i]);
      if (DAY_KEYS[i] === b) return out;
      i = (i + 1) % 7;
    }
    return null;
  }
  const list = t.split(/\s*(?:,|&|and|\/)\s*/).filter(Boolean);
  const days = list.map((d) => DAY_ALIASES[d]);
  return days.every(Boolean) ? (days as DayKey[]) : null;
}

export function parseHoursText(answer: string): OpeningHours | null {
  const segments = answer
    .split(/[;\n]|,(?=\s*[a-z]{3,}\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return null;

  const hours = emptyHours();
  let touched = 0;
  for (const seg of segments) {
    const lower = seg.toLowerCase();
    const closed = /\b(closed|off|holiday)\b/.test(lower);
    // Split "days part" from "times part" at the first digit.
    const firstDigit = lower.search(/\d/);
    const daysText = closed ? lower.replace(/\b(closed|off|holiday)\b.*$/, "") : firstDigit === -1 ? lower : lower.slice(0, firstDigit);
    const days = parseDays(daysText.replace(/[:]/g, "").replace(/\bopen\b/g, ""));
    if (!days) return null;
    if (closed) {
      for (const d of days) hours[d] = [];
      touched++;
      continue;
    }
    const ranges = parseRanges(seg);
    if (!ranges) return null;
    for (const d of days) hours[d] = [...hours[d], ...ranges];
    touched++;
  }
  return touched ? parseOpeningHours(hours) : null;
}
