import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn(async () => ({ timezone: "Asia/Kolkata" })) },
    bookingRequest: { update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "b1", calendarEventId: "e1", status: "confirmed", scheduledFor: null, ...args.data })) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

const { getEvent, getCalendarAccount, getCalendarCredentials } = vi.hoisted(() => ({
  getEvent: vi.fn(),
  getCalendarAccount: vi.fn(),
  getCalendarCredentials: vi.fn(),
}));
vi.mock("@/modules/calendar/accounts", () => ({ getCalendarAccount, getCalendarCredentials }));
vi.mock("@/modules/calendar/index", () => ({
  calendarModeFor: (a: { simulated: boolean }) => (a.simulated ? "test" : "google"),
  driverFor: () => ({ getEvent }),
}));

import { syncBookingWithCalendar } from "@/modules/calendar/sync";

const booking = {
  id: "b1",
  status: "confirmed",
  scheduledFor: new Date("2026-09-18T10:30:00Z"),
  calendarEventId: "e1",
};

beforeEach(() => {
  vi.clearAllMocks();
  getCalendarAccount.mockResolvedValue({ simulated: false });
  getCalendarCredentials.mockResolvedValue({ refreshToken: "r", calendarId: "primary", accountEmail: "o@x" });
});

describe("syncBookingWithCalendar", () => {
  it("leaves an unchanged event alone", async () => {
    getEvent.mockResolvedValue({ ok: true, status: "confirmed", start: "2026-09-18T16:00:00+05:30" });
    const r = await syncBookingWithCalendar("o1", booking);
    expect(r.change).toBe("unchanged");
    expect(prisma.bookingRequest.update).not.toHaveBeenCalled();
  });

  it("follows a move made in Google Calendar", async () => {
    getEvent.mockResolvedValue({ ok: true, status: "confirmed", start: "2026-09-18T17:00:00+05:30" });
    const r = await syncBookingWithCalendar("o1", booking);
    expect(r.change).toBe("moved");
    expect(prisma.bookingRequest.update.mock.calls[0][0].data).toEqual({
      scheduledFor: new Date("2026-09-18T11:30:00Z"),
    });
  });

  it("cancels a booking whose event was deleted", async () => {
    getEvent.mockResolvedValue({ ok: true, status: "missing" });
    const r = await syncBookingWithCalendar("o1", booking);
    expect(r.change).toBe("cancelled");
    expect(prisma.bookingRequest.update.mock.calls[0][0].data).toEqual({ status: "cancelled" });
  });

  it("skips test calendars, pending bookings, and Google errors", async () => {
    getCalendarAccount.mockResolvedValue({ simulated: true });
    expect((await syncBookingWithCalendar("o1", booking)).change).toBe("skipped");
    getCalendarAccount.mockResolvedValue({ simulated: false });
    expect((await syncBookingWithCalendar("o1", { ...booking, status: "pending" })).change).toBe("skipped");
    getEvent.mockResolvedValue({ ok: false, error: "events.get 500" });
    expect((await syncBookingWithCalendar("o1", booking)).change).toBe("skipped");
    expect(prisma.bookingRequest.update).not.toHaveBeenCalled();
  });
});
