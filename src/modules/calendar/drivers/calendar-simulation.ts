import type {
  AvailabilityResult,
  CalendarDriver,
  CalendarEventInput,
  CalendarSlot,
  CreateEventResult,
} from "@/modules/calendar/types";

/**
 * Deterministic fake calendar — the booking flow demos end-to-end with zero
 * Google setup (invariant 4). No network, no OAuth. A fixed lunch block
 * (13:00 local) is treated as taken so the "offer alternatives" path is
 * demoable; every other slot is free.
 */
export class CalendarSimulationDriver implements CalendarDriver {
  async checkAvailability(slot: CalendarSlot): Promise<AvailabilityResult> {
    const busy = new Date(slot.start).getHours() === 13;
    if (!busy) return { ok: true, available: true };
    return {
      ok: true,
      available: false,
      alternatives: [shiftSlot(slot, 60), shiftSlot(slot, 120)],
    };
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
