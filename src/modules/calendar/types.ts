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

export interface CalendarDriver {
  checkAvailability(
    slot: CalendarSlot,
    credentials?: CalendarCredentials
  ): Promise<AvailabilityResult>;
  createEvent(
    event: CalendarEventInput,
    credentials?: CalendarCredentials
  ): Promise<CreateEventResult>;
}

/** What booking an appointment resolved to — the booking tool turns this into
 *  a customer-facing message. */
export type BookOutcome =
  | { status: "booked"; scheduledFor: Date; eventId?: string; htmlLink?: string }
  | { status: "unavailable"; alternatives: CalendarSlot[] }
  | { status: "no_calendar" }
  | { status: "unparsed_time" }
  | { status: "error"; error?: string };
