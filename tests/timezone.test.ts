import { describe, expect, it } from "vitest";
import {
  addDays,
  formatInTimezone,
  timezoneOffsetMs,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/timezone";

/**
 * Vercel runs in UTC and no client does. These helpers are what keeps a
 * "4 PM" in Delhi from being stored as 4 PM UTC (9:30 PM IST) — the bug the
 * founder hit on 2026-09-17 with the first booking on a fresh workspace.
 */
describe("timezone helpers", () => {
  it("reads the clock in the business's zone", () => {
    const instant = new Date("2026-09-17T08:56:48Z"); // 2:26 PM IST, Thursday
    expect(zonedParts(instant, "Asia/Kolkata")).toEqual({
      year: 2026,
      month: 9,
      day: 17,
      hour: 14,
      minute: 26,
      weekday: 4,
    });
    expect(zonedParts(instant, "Asia/Singapore").hour).toBe(16);
    expect(zonedParts(instant, "UTC").hour).toBe(8);
  });

  it("knows the offsets", () => {
    const instant = new Date("2026-09-17T08:00:00Z");
    expect(timezoneOffsetMs(instant, "Asia/Kolkata")).toBe(5.5 * 3_600_000);
    expect(timezoneOffsetMs(instant, "Asia/Singapore")).toBe(8 * 3_600_000);
    expect(timezoneOffsetMs(instant, "UTC")).toBe(0);
  });

  it("turns a wall time into the right instant", () => {
    const wall = { year: 2026, month: 9, day: 18, hour: 16, minute: 0 };
    expect(zonedTimeToUtc(wall, "Asia/Kolkata").toISOString()).toBe("2026-09-18T10:30:00.000Z");
    expect(zonedTimeToUtc(wall, "Asia/Singapore").toISOString()).toBe("2026-09-18T08:00:00.000Z");
    expect(zonedTimeToUtc(wall, "UTC").toISOString()).toBe("2026-09-18T16:00:00.000Z");
  });

  it("handles a DST zone across the change", () => {
    // London: 2026-03-29 clocks go forward. 10:00 before and after differ by an hour of UTC.
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 28, hour: 10, minute: 0 }, "Europe/London").toISOString())
      .toBe("2026-03-28T10:00:00.000Z");
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 30, hour: 10, minute: 0 }, "Europe/London").toISOString())
      .toBe("2026-03-30T09:00:00.000Z");
  });

  it("adds days across month ends", () => {
    expect(addDays({ year: 2026, month: 9, day: 30 }, 1)).toEqual({ year: 2026, month: 10, day: 1 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it("formats on the business clock", () => {
    const instant = new Date("2026-09-18T10:30:00Z");
    expect(formatInTimezone(instant, "Asia/Kolkata")).toMatch(/Fri 18 Sept?,? 4:00 pm/i);
    expect(formatInTimezone(instant, "Asia/Singapore")).toMatch(/6:30 pm/i);
  });
});
