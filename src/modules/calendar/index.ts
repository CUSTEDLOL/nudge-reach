import { env } from "@/lib/env";
import { CalendarSimulationDriver } from "@/modules/calendar/drivers/calendar-simulation";
import { GoogleCalendarDriver } from "@/modules/calendar/drivers/calendar-google";
import { isGoogleCalendarConfigured } from "@/modules/calendar/google";
import {
  getCalendarAccount,
  getCalendarCredentials,
} from "@/modules/calendar/accounts";
import { parseWhen } from "@/modules/calendar/when";
import type {
  BookOutcome,
  CalendarDriver,
  CalendarSlot,
} from "@/modules/calendar/types";

export type { BookOutcome, CalendarSlot } from "@/modules/calendar/types";
export { parseWhen } from "@/modules/calendar/when";
export {
  getCalendarAccount,
  saveCalendarAccount,
  disconnectCalendar,
} from "@/modules/calendar/accounts";
export { isGoogleCalendarConfigured } from "@/modules/calendar/google";

/** Real Google only when live AND configured AND the connection isn't mocked. */
function shouldUseGoogle(simulated: boolean): boolean {
  return env.SEND_MODE === "live" && isGoogleCalendarConfigured() && !simulated;
}

export async function isCalendarConnected(orgId: string): Promise<boolean> {
  return Boolean(await getCalendarAccount(orgId));
}

/**
 * The moat action: parse a requested time, check the org's connected calendar,
 * and book a real event if the slot is free. Returns a discriminated outcome
 * the booking tool turns into a customer message. Never throws.
 *
 * Falls back cleanly: no calendar connected → "no_calendar"; unparseable time
 * → "unparsed_time" — both let the tool keep its old "record + hand off"
 * behavior so lower-tier / unconfigured orgs are unaffected.
 */
export async function bookAppointment(
  orgId: string,
  input: { summary: string; requestedFor: string; description?: string; now?: Date }
): Promise<BookOutcome> {
  const account = await getCalendarAccount(orgId);
  if (!account) return { status: "no_calendar" };

  const parsed = parseWhen(input.requestedFor, input.now);
  if (!parsed) return { status: "unparsed_time" };

  const slot: CalendarSlot = {
    start: parsed.start.toISOString(),
    end: parsed.end.toISOString(),
  };

  const real = shouldUseGoogle(account.simulated);
  const driver: CalendarDriver = real
    ? new GoogleCalendarDriver()
    : new CalendarSimulationDriver();
  const credentials = real
    ? (await getCalendarCredentials(orgId)) ?? undefined
    : undefined;

  const availability = await driver.checkAvailability(slot, credentials);
  if (!availability.ok) return { status: "error", error: availability.error };
  if (!availability.available) {
    return { status: "unavailable", alternatives: availability.alternatives ?? [] };
  }

  const created = await driver.createEvent(
    { summary: input.summary, slot, description: input.description },
    credentials
  );
  if (!created.ok) return { status: "error", error: created.error };

  return {
    status: "booked",
    scheduledFor: parsed.start,
    eventId: created.eventId,
    htmlLink: created.htmlLink,
  };
}
