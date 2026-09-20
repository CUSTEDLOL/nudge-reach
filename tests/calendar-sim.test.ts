import { describe, it, expect } from "vitest";
import { CalendarSimulationDriver } from "@/modules/calendar/drivers/calendar-simulation";

// 1 PM IST on 10 July 2026 is 07:30 UTC.
const IST = "Asia/Kolkata";
const slotIst = (h: number) => {
  const start = new Date(Date.UTC(2026, 6, 10, h - 6, 30)); // IST is UTC+5:30
  return { start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString() };
};

describe("CalendarSimulationDriver", () => {
  const driver = new CalendarSimulationDriver(IST);

  it("reports a free slot as available", async () => {
    const r = await driver.checkAvailability(slotIst(15));
    expect(r.ok).toBe(true);
    expect(r.available).toBe(true);
  });

  it("treats 1pm on the business's clock as the lunch block, with alternatives", async () => {
    const r = await driver.checkAvailability(slotIst(13));
    expect(r.ok).toBe(true);
    expect(r.available).toBe(false);
    expect(r.alternatives).toHaveLength(2);
  });

  it("does not use the server's idea of 1pm", async () => {
    // 13:00 UTC is 6:30 PM in India — a free slot there.
    const utc1pm = { start: "2026-07-10T13:00:00.000Z", end: "2026-07-10T14:00:00.000Z" };
    expect((await driver.checkAvailability(utc1pm)).available).toBe(true);
    expect((await new CalendarSimulationDriver("UTC").checkAvailability(utc1pm)).available).toBe(false);
  });

  it("creates a deterministic mocked event", async () => {
    const event = { summary: "Booking: Priya", slot: slotIst(15) };
    const a = await driver.createEvent(event);
    const b = await driver.createEvent(event);
    expect(a.ok).toBe(true);
    expect(a.eventId).toMatch(/^sim-cal-/);
    expect(a.eventId).toBe(b.eventId); // deterministic, no Math.random
    expect(a.htmlLink).toContain("calendar.google.com");
  });
});
