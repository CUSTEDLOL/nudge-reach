import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real Google driver had never run: production has no Google keys, so
 * every connection so far was the test calendar. These tests pin the exact
 * requests and the way each Google answer is read, with fetch mocked.
 */

vi.mock("@/modules/calendar/google", () => ({
  accessTokenFromRefresh: vi.fn(async () => "access-token"),
}));

import { GoogleCalendarDriver } from "@/modules/calendar/drivers/calendar-google";

const creds = { refreshToken: "r", calendarId: "primary", accountEmail: "o@x.in" };
const slot = { start: "2026-09-18T10:30:00.000Z", end: "2026-09-18T11:30:00.000Z" };

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("GoogleCalendarDriver", () => {
  const driver = new GoogleCalendarDriver();

  it("asks freeBusy about exactly the slot and reads busy as unavailable", async () => {
    fetchMock.mockResolvedValueOnce(json({ calendars: { primary: { busy: [slot] } } }));
    const r = await driver.checkAvailability(slot, creds);
    expect(r).toEqual({ ok: true, available: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    expect(JSON.parse(init.body)).toEqual({ timeMin: slot.start, timeMax: slot.end, items: [{ id: "primary" }] });
    expect(init.headers.Authorization).toBe("Bearer access-token");
  });

  it("reads an empty busy list as free", async () => {
    fetchMock.mockResolvedValueOnce(json({ calendars: { primary: { busy: [] } } }));
    expect((await driver.checkAvailability(slot, creds)).available).toBe(true);
  });

  it("never throws: a Google error becomes ok:false", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 403));
    const r = await driver.checkAvailability(slot, creds);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("freeBusy 403");
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect((await driver.createEvent({ summary: "x", slot }, creds)).ok).toBe(false);
  });

  it("refuses without credentials rather than calling Google", async () => {
    expect((await driver.checkAvailability(slot)).ok).toBe(false);
    expect((await driver.busyBetween(slot)).ok).toBe(false);
    expect((await driver.getEvent("e1")).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the event with the slot as sent and returns Google's id and link", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "evt_1", htmlLink: "https://calendar.google.com/e/1" }));
    const r = await driver.createEvent({ summary: "Booking: A", slot, description: "via WhatsApp" }, creds);
    expect(r).toEqual({ ok: true, eventId: "evt_1", htmlLink: "https://calendar.google.com/e/1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(JSON.parse(init.body)).toEqual({
      summary: "Booking: A",
      description: "via WhatsApp",
      start: { dateTime: slot.start },
      end: { dateTime: slot.end },
    });
  });

  it("returns busy intervals for a range", async () => {
    const busy = [{ start: "2026-09-18T04:30:00Z", end: "2026-09-18T05:30:00Z" }];
    fetchMock.mockResolvedValueOnce(json({ calendars: { primary: { busy } } }));
    const r = await driver.busyBetween({ start: "2026-09-18T00:00:00Z", end: "2026-09-25T00:00:00Z" }, creds);
    expect(r).toEqual({ ok: true, busy });
  });

  it("reads an event back: moved, cancelled, or gone", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "confirmed", start: { dateTime: "2026-09-18T12:30:00+05:30" } }));
    expect(await driver.getEvent("e1", creds)).toEqual({ ok: true, status: "confirmed", start: "2026-09-18T12:30:00+05:30" });
    fetchMock.mockResolvedValueOnce(json({ status: "cancelled" }));
    expect((await driver.getEvent("e1", creds)).status).toBe("cancelled");
    fetchMock.mockResolvedValueOnce(json({}, 404));
    expect((await driver.getEvent("e1", creds)).status).toBe("missing");
    expect(fetchMock.mock.calls[0][0]).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events/e1");
  });
});
