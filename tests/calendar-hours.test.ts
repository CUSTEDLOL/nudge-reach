import { describe, expect, it } from "vitest";
import {
  describeDay,
  freeSlots,
  isOpenFor,
  openWindowsOn,
  parseOpeningHours,
} from "@/modules/calendar/hours";
import { parseHoursText } from "@/modules/calendar/hours-text";

const IST = "Asia/Kolkata";
const SHOP = parseOpeningHours({
  sun: [],
  mon: [["10:00", "20:00"]],
  tue: [["10:00", "20:00"]],
  wed: [["10:00", "20:00"]],
  thu: [["10:00", "20:00"]],
  fri: [["10:00", "20:00"]],
  sat: [["10:00", "14:00"], ["16:00", "20:00"]],
})!;

// 4 PM IST on Fri 18 Sep 2026.
const FRI_4PM = { start: "2026-09-18T10:30:00.000Z", end: "2026-09-18T11:30:00.000Z" };

describe("opening hours", () => {
  it("validates the stored shape", () => {
    expect(SHOP).not.toBeNull();
    expect(parseOpeningHours({ mon: [["10:00", "09:00"]] })).toBeNull(); // closes before it opens
    expect(parseOpeningHours(null)).toBeNull();
    expect(parseOpeningHours("Mon-Sat 10-8")).toBeNull();
  });

  it("knows when the business is open, on its own clock", () => {
    expect(isOpenFor(SHOP, FRI_4PM, IST)).toBe(true);
    // 3 AM Sunday IST: an empty calendar slot, but the shop is shut.
    const sun3am = { start: "2026-09-19T21:30:00.000Z", end: "2026-09-19T22:30:00.000Z" };
    expect(isOpenFor(SHOP, sun3am, IST)).toBe(false);
    // Saturday 2:30 PM falls in the lunch gap.
    const sat230 = { start: "2026-09-19T09:00:00.000Z", end: "2026-09-19T10:00:00.000Z" };
    expect(isOpenFor(SHOP, sat230, IST)).toBe(false);
    // A slot that runs past closing does not fit.
    const fri730 = { start: "2026-09-18T14:00:00.000Z", end: "2026-09-18T15:00:00.000Z" };
    expect(isOpenFor(SHOP, fri730, IST)).toBe(false);
  });

  it("imposes nothing when no hours are set", () => {
    const sun3am = { start: "2026-09-19T21:30:00.000Z", end: "2026-09-19T22:30:00.000Z" };
    expect(isOpenFor(null, sun3am, IST)).toBe(true);
  });

  it("describes a day for the customer", () => {
    expect(describeDay(SHOP, new Date(FRI_4PM.start), IST)).toBe("10 am – 8 pm");
    expect(describeDay(SHOP, new Date("2026-09-20T05:00:00Z"), IST)).toBe("Closed on Sunday");
    expect(describeDay(SHOP, new Date("2026-09-19T05:00:00Z"), IST)).toBe("10 am – 2 pm, 4 pm – 8 pm");
  });

  it("lists the day's windows as instants", () => {
    const windows = openWindowsOn(SHOP, new Date(FRI_4PM.start), IST);
    expect(windows).toEqual([{ start: "2026-09-18T04:30:00.000Z", end: "2026-09-18T14:30:00.000Z" }]);
  });

  it("finds the next free slots inside opening hours, skipping busy ones", () => {
    const from = new Date("2026-09-18T10:30:00Z"); // Fri 4 PM IST
    const busy = [{ start: "2026-09-18T10:30:00Z", end: "2026-09-18T11:30:00Z" }]; // 4–5 PM taken
    const slots = freeSlots({ hours: SHOP, busy, from, timezone: IST });
    // 4:30 overlaps the busy hour; 5 PM and 5:30 PM are the first two free.
    expect(slots.map((s) => s.start)).toEqual(["2026-09-18T11:30:00.000Z", "2026-09-18T12:00:00.000Z"]);
  });

  it("rolls to the next open day when today is full", () => {
    const from = new Date("2026-09-18T14:00:00Z"); // Fri 7:30 PM IST — no full hour left
    const slots = freeSlots({ hours: SHOP, busy: [], from, timezone: IST });
    // Saturday 10 AM IST.
    expect(slots[0].start).toBe("2026-09-19T04:30:00.000Z");
  });
});

describe("parseHoursText — the way owners write it", () => {
  it("reads the questionnaire placeholder", () => {
    const h = parseHoursText("Mon–Sat 10am–8pm, Sun closed")!;
    expect(h.mon).toEqual([["10:00", "20:00"]]);
    expect(h.sat).toEqual([["10:00", "20:00"]]);
    expect(h.sun).toEqual([]);
  });

  it("reads long day names, 24h clocks and lunch breaks", () => {
    const h = parseHoursText("Monday to Friday 09:30-18:00; Saturday 10 am to 2 pm and 4pm to 8pm; Sunday closed")!;
    expect(h.mon).toEqual([["09:30", "18:00"]]);
    expect(h.fri).toEqual([["09:30", "18:00"]]);
    expect(h.sat).toEqual([["10:00", "14:00"], ["16:00", "20:00"]]);
    expect(h.sun).toEqual([]);
  });

  it("reads 'daily' and a bare close hour as pm", () => {
    const h = parseHoursText("Daily 10am–8")!;
    expect(h.sun).toEqual([["10:00", "20:00"]]);
    expect(h.wed).toEqual([["10:00", "20:00"]]);
  });

  it("refuses rather than guess", () => {
    expect(parseHoursText("we are open most days, call us")).toBeNull();
    expect(parseHoursText("")).toBeNull();
    expect(parseHoursText("Mon 8pm–10am")).toBeNull(); // crosses midnight: not supported
  });
});
