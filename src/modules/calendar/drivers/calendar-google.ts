import { accessTokenFromRefresh } from "@/modules/calendar/google";
import type {
  AvailabilityResult,
  BusyResult,
  CalendarCredentials,
  CalendarDriver,
  CalendarEventInput,
  CalendarEventState,
  CalendarSlot,
  CreateEventResult,
} from "@/modules/calendar/types";

/**
 * Real Google Calendar via the REST API (live mode only). Never throws — a
 * Google failure returns { ok:false, error } so the booking tool degrades to a
 * staff hand-off rather than surfacing an exception to the customer.
 */
export class GoogleCalendarDriver implements CalendarDriver {
  async checkAvailability(
    slot: CalendarSlot,
    credentials?: CalendarCredentials
  ): Promise<AvailabilityResult> {
    if (!credentials) return { ok: false, available: false, error: "no credentials" };
    try {
      const token = await accessTokenFromRefresh(credentials.refreshToken);
      const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: slot.start,
          timeMax: slot.end,
          items: [{ id: credentials.calendarId }],
        }),
      });
      if (!res.ok) return { ok: false, available: false, error: `freeBusy ${res.status}` };
      const data = (await res.json()) as {
        calendars?: Record<string, { busy?: unknown[] }>;
      };
      const busy = data.calendars?.[credentials.calendarId]?.busy ?? [];
      return { ok: true, available: busy.length === 0 };
    } catch (err) {
      return {
        ok: false,
        available: false,
        error: err instanceof Error ? err.message : "freeBusy failed",
      };
    }
  }

  async busyBetween(
    range: CalendarSlot,
    credentials?: CalendarCredentials
  ): Promise<BusyResult> {
    if (!credentials) return { ok: false, busy: [], error: "no credentials" };
    try {
      const token = await accessTokenFromRefresh(credentials.refreshToken);
      const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: range.start,
          timeMax: range.end,
          items: [{ id: credentials.calendarId }],
        }),
      });
      if (!res.ok) return { ok: false, busy: [], error: `freeBusy ${res.status}` };
      const data = (await res.json()) as {
        calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
      };
      const busy = data.calendars?.[credentials.calendarId]?.busy ?? [];
      return { ok: true, busy: busy.map((b) => ({ start: b.start, end: b.end })) };
    } catch (err) {
      return { ok: false, busy: [], error: err instanceof Error ? err.message : "freeBusy failed" };
    }
  }

  async getEvent(
    eventId: string,
    credentials?: CalendarCredentials
  ): Promise<CalendarEventState> {
    if (!credentials) return { ok: false, error: "no credentials" };
    try {
      const token = await accessTokenFromRefresh(credentials.refreshToken);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          credentials.calendarId
        )}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Google answers 404 (and sometimes 410) once an event is gone for good.
      if (res.status === 404 || res.status === 410) return { ok: true, status: "missing" };
      if (!res.ok) return { ok: false, error: `events.get ${res.status}` };
      const data = (await res.json()) as {
        status?: string;
        start?: { dateTime?: string; date?: string };
      };
      const status =
        data.status === "cancelled"
          ? "cancelled"
          : data.status === "tentative"
            ? "tentative"
            : "confirmed";
      return { ok: true, status, start: data.start?.dateTime ?? data.start?.date };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "events.get failed" };
    }
  }

  async createEvent(
    event: CalendarEventInput,
    credentials?: CalendarCredentials
  ): Promise<CreateEventResult> {
    if (!credentials) return { ok: false, error: "no credentials" };
    try {
      const token = await accessTokenFromRefresh(credentials.refreshToken);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          credentials.calendarId
        )}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.slot.start },
            end: { dateTime: event.slot.end },
          }),
        }
      );
      if (!res.ok) return { ok: false, error: `events.insert ${res.status}` };
      const data = (await res.json()) as { id?: string; htmlLink?: string };
      return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "insert failed" };
    }
  }
}
