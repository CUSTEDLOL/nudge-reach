/**
 * Calendar module — mirrors the messaging driver split (simulation | live)
 * exactly. The agent books real appointments through this; in simulation a
 * deterministic fake calendar keeps the whole flow demoable with zero Google
 * setup (invariant 4).
 */

export interface CalendarSlot {
  /** ISO 8601. */
  start: string;
  end: string;
}

export interface AvailabilityResult {
  ok: boolean;
  available: boolean;
  /** Concrete alternative slots to offer when the asked time is taken. */
  alternatives?: CalendarSlot[];
  error?: string;
}

export interface CreateEventResult {
  ok: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}

/** Decrypted, per-org (live only). */
export interface CalendarCredentials {
  refreshToken: string;
  calendarId: string;
  accountEmail: string;
}

export interface CalendarEventInput {
  summary: string;
  slot: CalendarSlot;
  description?: string;
}

export interface BusyResult {
  ok: boolean;
  busy: CalendarSlot[];
  error?: string;
}

/** What the calendar says an event we created has become. */
export interface CalendarEventState {
  ok: boolean;
  /** "cancelled" when deleted in the calendar; "missing" when it no longer exists at all. */
  status?: "confirmed" | "tentative" | "cancelled" | "missing";
  /** ISO start, if the event still has one (it may have been moved). */
  start?: string;
  error?: string;
}

export interface CalendarDriver {
  checkAvailability(
    slot: CalendarSlot,
    credentials?: CalendarCredentials
  ): Promise<AvailabilityResult>;
  createEvent(
    event: CalendarEventInput,
    credentials?: CalendarCredentials
  ): Promise<CreateEventResult>;
  /** Busy intervals between two instants, so free slots can be offered. */
  busyBetween(
    range: CalendarSlot,
    credentials?: CalendarCredentials
  ): Promise<BusyResult>;
  /** Read back an event we created: moved, cancelled, or unchanged. */
  getEvent(
    eventId: string,
    credentials?: CalendarCredentials
  ): Promise<CalendarEventState>;
}

/** What booking an appointment resolved to — the booking tool turns this into
 *  a customer-facing message. */
export type BookOutcome =
  | {
      status: "booked";
      scheduledFor: Date;
      /** The business's IANA timezone — format `scheduledFor` with it, never in server time. */
      timezone: string;
      eventId?: string;
      htmlLink?: string;
    }
  | { status: "unavailable"; alternatives: CalendarSlot[]; timezone: string }
  /** The business is shut then. `hours` describes that day; alternatives are inside opening hours. */
  | { status: "closed"; hours: string; alternatives: CalendarSlot[]; timezone: string }
  | { status: "no_calendar" }
  | { status: "unparsed_time" }
  | { status: "error"; error?: string };
