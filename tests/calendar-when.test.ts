import { describe, it, expect } from "vitest";
import { parseWhen } from "@/modules/calendar/when";

// Mon 6 Jul 2026, 10:00 local (constructed in local time so getHours/getDate
// comparisons below are tz-independent — parseWhen also uses local setters).
const MON_10AM = new Date(2026, 6, 6, 10, 0, 0);

describe("parseWhen", () => {
  it("parses 'tomorrow 8pm' to the next day at 20:00", () => {
    const p = parseWhen("tomorrow 8pm", MON_10AM)!;
    expect(p).not.toBeNull();
    expect(p.start.getDate()).toBe(7);
    expect(p.start.getHours()).toBe(20);
    // default 60-minute appointment
    expect(p.end.getTime() - p.start.getTime()).toBe(60 * 60_000);
  });

  it("keeps a later-today bare time on today", () => {
    const p = parseWhen("at 8pm", MON_10AM)!;
    expect(p.start.getDate()).toBe(6);
    expect(p.start.getHours()).toBe(20);
  });

  it("rolls an already-past bare time to tomorrow", () => {
    const eve = new Date(2026, 6, 6, 17, 0, 0); // 5pm
    const p = parseWhen("3pm", eve)!;
    expect(p.start.getDate()).toBe(7);
    expect(p.start.getHours()).toBe(15);
  });

  it("parses a weekday + time to the NEXT such weekday", () => {
    const p = parseWhen("Sat 1pm", MON_10AM)!;
    expect(p.start.getDay()).toBe(6); // Saturday
    expect(p.start.getHours()).toBe(13);
  });

  it("honours a real ISO timestamp", () => {
    const p = parseWhen("2026-07-10T13:00:00Z", MON_10AM)!;
    expect(p.start.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("parses 24h times", () => {
    const p = parseWhen("tomorrow 14:30", MON_10AM)!;
    expect(p.start.getHours()).toBe(14);
    expect(p.start.getMinutes()).toBe(30);
  });

  it("returns null when there's no resolvable time", () => {
    expect(parseWhen("sometime next week", MON_10AM)).toBeNull();
    expect(parseWhen("", MON_10AM)).toBeNull();
    expect(parseWhen("whenever suits you", MON_10AM)).toBeNull();
  });
});
