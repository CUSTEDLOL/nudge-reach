import { describe, expect, it } from "vitest";
import { calendarModeFor } from "@/modules/calendar/index";

/**
 * Which calendar a connection really talks to. The rule that matters for a
 * paying client: a real connection is never quietly downgraded to the test
 * calendar — it is Google or it is "unavailable", and the booking tool hands
 * off to staff in the second case.
 */
describe("calendarModeFor", () => {
  const live = { sendMode: "live", googleConfigured: true };

  it("a mocked connection is the test calendar, whatever the platform", () => {
    expect(calendarModeFor({ simulated: true }, live)).toBe("test");
    expect(calendarModeFor({ simulated: true }, { sendMode: "simulation", googleConfigured: false })).toBe("test");
  });

  it("a real connection talks to Google on a live platform with keys", () => {
    expect(calendarModeFor({ simulated: false }, live)).toBe("google");
  });

  it("a real connection is unavailable, never faked, when Google can't be reached", () => {
    expect(calendarModeFor({ simulated: false }, { sendMode: "live", googleConfigured: false })).toBe("unavailable");
    expect(calendarModeFor({ simulated: false }, { sendMode: "simulation", googleConfigured: true })).toBe("unavailable");
  });
});
