import { describe, it, expect } from "vitest";
import { CalendarSimulationDriver } from "@/modules/calendar/drivers/calendar-simulation";

// Local-time (no Z) ISO so getHours() in the driver is tz-independent.
const slotAt = (h: number) => ({
  start: `2026-07-10T${String(h).padStart(2, "0")}:00:00`,
  end: `2026-07-10T${String(h + 1).padStart(2, "0")}:00:00`,
});

describe("CalendarSimulationDriver", () => {
  const driver = new CalendarSimulationDriver();

  it("reports a free slot as available", async () => {
    const r = await driver.checkAvailability(slotAt(15));
    expect(r.ok).toBe(true);
    expect(r.available).toBe(true);
  });

  it("reports the 1pm lunch block as taken, with alternatives", async () => {
    const r = await driver.checkAvailability(slotAt(13));
    expect(r.ok).toBe(true);
    expect(r.available).toBe(false);
    expect(r.alternatives).toHaveLength(2);
  });

  it("creates a deterministic mocked event", async () => {
    const event = { summary: "Booking: Priya", slot: slotAt(15) };
    const a = await driver.createEvent(event);
    const b = await driver.createEvent(event);
    expect(a.ok).toBe(true);
    expect(a.eventId).toMatch(/^sim-cal-/);
    expect(a.eventId).toBe(b.eventId); // deterministic, no Math.random
    expect(a.htmlLink).toContain("calendar.google.com");
  });
});
