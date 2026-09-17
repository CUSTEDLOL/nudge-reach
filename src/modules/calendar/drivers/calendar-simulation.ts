import { addDays, zonedParts, zonedTimeToUtc } from "@/lib/timezone";
import type {
  AvailabilityResult,
  BusyResult,
  CalendarDriver,
  CalendarEventInput,
  CalendarEventState,
  CalendarSlot,
  CreateEventResult,
} from "@/modules/calendar/types";

/**
 * Deterministic fake calendar — the booking flow demos end-to-end with zero
 * Google setup (invariant 4). No network, no OAuth. A fixed lunch block
 * (13:00 on the business's clock) is treated as taken so the "offer
 * alternatives" path is demoable; every other slot is free.
 */
export class CalendarSimulationDriver implements CalendarDriver {
  constructor(private readonly timezone: string = "UTC") {}

  async checkAvailability(slot: CalendarSlot): Promise<AvailabilityResult> {
    const busy = zonedParts(new Date(slot.start), this.timezone).hour === 13;
    if (!busy) return { ok: true, available: true };
    return {
      ok: true,
      available: false,
      alternatives: [shiftSlot(slot, 60), shiftSlot(slot, 120)],
    };
  }

  /** The lunch block of every day in the range, on the business's clock. */
  async busyBetween(range: CalendarSlot): Promise<BusyResult> {
    const busy: CalendarSlot[] = [];
    const end = new Date(range.end).getTime();
    let date = zonedParts(new Date(range.start), this.timezone);
    for (let i = 0; i < 14; i++) {
      const start = zonedTimeToUtc({ ...date, hour: 13, minute: 0 }, this.timezone);
      if (start.getTime() > end) break;
      busy.push({ start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString() });
      date = { ...date, ...addDays(date, 1) };
    }
    return { ok: true, busy };
  }

  /** A mocked event is never moved or cancelled behind our back. */
  async getEvent(): Promise<CalendarEventState> {
    return { ok: true, status: "confirmed" };
  }

  async createEvent(event: CalendarEventInput): Promise<CreateEventResult> {
    const eventId = "sim-cal-" + slug(event.slot.start + event.summary);
    return {
      ok: true,
      eventId,
      htmlLink: `https://calendar.google.com/calendar/r/eventedit?sim=${eventId}`,
    };
  }
}

function shiftSlot(slot: CalendarSlot, minutes: number): CalendarSlot {
  const ms = minutes * 60_000;
  return {
    start: new Date(new Date(slot.start).getTime() + ms).toISOString(),
    end: new Date(new Date(slot.end).getTime() + ms).toISOString(),
  };
}

function slug(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
