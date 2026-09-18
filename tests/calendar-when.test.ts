import { describe, it, expect } from "vitest";
import { parseWhen } from "@/modules/calendar/when";
import { zonedParts } from "@/lib/timezone";

/**
 * Every phrase is read on the business's clock. The founder's first booking
 * ("Friday 18 September at 4 PM", India) was stored as 16:00 UTC = 9:30 PM
 * IST because the parser used the server's zone. Never again.
 */

const IST = "Asia/Kolkata";
const SGT = "Asia/Singapore";

// Thu 17 Sep 2026, 2:26 PM IST (08:56 UTC) — the moment the founder booked.
const NOW = new Date("2026-09-17T08:56:48Z");

describe("parseWhen — on the business's clock", () => {
  it("stores the founder's booking at the right instant", () => {
    const p = parseWhen("Friday 18 September at 4 PM", NOW, IST)!;
    expect(p.start.toISOString()).toBe("2026-09-18T10:30:00.000Z"); // 4 PM IST
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 18, hour: 16, minute: 0, weekday: 5 });
    expect(p.end.getTime() - p.start.getTime()).toBe(60 * 60_000);
  });

  it("the same words mean a different instant in Singapore", () => {
    const p = parseWhen("Friday 4pm", NOW, SGT)!;
    expect(p.start.toISOString()).toBe("2026-09-18T08:00:00.000Z");
  });

  it("parses 'tomorrow 8pm' to the next local day at 20:00", () => {
    const p = parseWhen("tomorrow 8pm", NOW, IST)!;
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 18, hour: 20, minute: 0 });
  });

  it("'tomorrow' said after midnight IST is still the local tomorrow", () => {
    // 00:30 IST on the 18th is still 19:00 UTC on the 17th — the server's
    // date is behind the business's.
    const lateNight = new Date("2026-09-17T19:00:00Z");
    const p = parseWhen("tomorrow 11am", lateNight, IST)!;
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 19, hour: 11 });
  });

  it("keeps a later-today bare time on today", () => {
    const p = parseWhen("at 8pm", NOW, IST)!;
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 17, hour: 20 });
  });

  it("rolls an already-past bare time to tomorrow", () => {
    const p = parseWhen("11am", NOW, IST)!; // it is 2:26 PM
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 18, hour: 11 });
  });

  it("parses a weekday + time to the NEXT such weekday", () => {
    const p = parseWhen("Sat 1pm", NOW, IST)!;
    expect(zonedParts(p.start, IST)).toMatchObject({ day: 19, hour: 13, weekday: 6 });
    // "Thursday" on a Thursday means next week, not today.
    const next = parseWhen("Thursday 10am", NOW, IST)!;
    expect(zonedParts(next.start, IST)).toMatchObject({ day: 24, weekday: 4 });
  });

  it("honours a real ISO timestamp regardless of zone", () => {
    const p = parseWhen("2026-07-10T13:00:00Z", NOW, IST)!;
    expect(p.start.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("parses 24h times", () => {
    const p = parseWhen("tomorrow 14:30", NOW, IST)!;
    expect(zonedParts(p.start, IST)).toMatchObject({ hour: 14, minute: 30 });
  });

  it("defaults to UTC when no zone is given", () => {
    const p = parseWhen("today 4pm", NOW)!;
    expect(p.start.toISOString()).toBe("2026-09-17T16:00:00.000Z");
  });

  it("returns null when there's no resolvable time", () => {
    expect(parseWhen("sometime next week", NOW, IST)).toBeNull();
    expect(parseWhen("", NOW, IST)).toBeNull();
    expect(parseWhen("whenever suits you", NOW, IST)).toBeNull();
  });
});
