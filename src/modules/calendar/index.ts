import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { CalendarSimulationDriver } from "@/modules/calendar/drivers/calendar-simulation";
import { GoogleCalendarDriver } from "@/modules/calendar/drivers/calendar-google";
import { isGoogleCalendarConfigured } from "@/modules/calendar/google";
import {
  getCalendarAccount,
  getCalendarCredentials,
} from "@/modules/calendar/accounts";
import { describeDay, freeSlots, isOpenFor } from "@/modules/calendar/hours";
import { readOpeningHours } from "@/modules/calendar/hours-store";
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

export type CalendarMode = "google" | "test" | "unavailable";

/**
 * Which calendar a connection actually talks to.
 *
 * - A mocked connection (made while the workspace was in test mode) is the
 *   deterministic test calendar.
 * - A real connection talks to Google — unless the platform kill switch is
 *   on or the Google keys are missing, in which case it is "unavailable":
 *   we never pretend a real account is being booked into while quietly
 *   writing nothing.
 */
export function calendarModeFor(
  account: { simulated: boolean },
  platform: { sendMode: string; googleConfigured: boolean } = {
    sendMode: env.SEND_MODE,
    googleConfigured: isGoogleCalendarConfigured(),
  }
): CalendarMode {
  if (account.simulated) return "test";
  if (platform.sendMode === "simulation" || !platform.googleConfigured) return "unavailable";
  return "google";
}

export function driverFor(mode: Exclude<CalendarMode, "unavailable">, timezone: string): CalendarDriver {
  return mode === "google" ? new GoogleCalendarDriver() : new CalendarSimulationDriver(timezone);
}

export async function isCalendarConnected(orgId: string): Promise<boolean> {
  return Boolean(await getCalendarAccount(orgId));
}

const ALTERNATIVE_SEARCH_DAYS = 7;

/**
 * The moat action: parse a requested time on the business's clock, refuse it
 * when the business is shut, check the connected calendar, and book a real
 * event if the slot is free. Returns a discriminated outcome the booking
 * tool turns into a customer message. Never throws.
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

  // Runtime flagship gate: an org that downgraded off AI Front Desk stops
  // booking even though the connected-calendar row persists.
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { plan: true, timezone: true, settings: true },
  });
  if (!org || !planHasAiFrontDesk(org.plan)) return { status: "no_calendar" };

  const mode = calendarModeFor(account);
  if (mode === "unavailable") {
    return { status: "error", error: "calendar unavailable on this deployment" };
  }

  // "4 PM" means 4 PM where the business is, not on the server.
  const timezone = org.timezone;
  const now = input.now ?? new Date();
  const parsed = parseWhen(input.requestedFor, now, timezone);
  if (!parsed) return { status: "unparsed_time" };

  const slot: CalendarSlot = {
    start: parsed.start.toISOString(),
    end: parsed.end.toISOString(),
  };

  const driver = driverFor(mode, timezone);
  const credentials =
    mode === "google" ? ((await getCalendarCredentials(orgId)) ?? undefined) : undefined;
  const hours = readOpeningHours(org.settings);

  const alternatives = async (from: Date): Promise<CalendarSlot[]> => {
    const horizon = new Date(from.getTime() + ALTERNATIVE_SEARCH_DAYS * 86_400_000);
    const busy = await driver.busyBetween(
      { start: from.toISOString(), end: horizon.toISOString() },
      credentials
    );
    return freeSlots({
      hours,
      busy: busy.ok ? busy.busy : [],
      from,
      timezone,
      daysAhead: ALTERNATIVE_SEARCH_DAYS,
    });
  };

  // Shut then? Say so, and offer the next times the business IS open.
  if (hours && !isOpenFor(hours, slot, timezone)) {
    return {
      status: "closed",
      hours: describeDay(hours, parsed.start, timezone),
      alternatives: await alternatives(parsed.start),
      timezone,
    };
  }

  const availability = await driver.checkAvailability(slot, credentials);
  if (!availability.ok) return { status: "error", error: availability.error };
  if (!availability.available) {
    // Real alternatives from the real calendar, inside opening hours — not
    // the "+1h, +2h" guess the first version offered.
    const found = await alternatives(parsed.start);
    return {
      status: "unavailable",
      alternatives: found.length ? found : (availability.alternatives ?? []),
      timezone,
    };
  }

  const created = await driver.createEvent(
    { summary: input.summary, slot, description: input.description },
    credentials
  );
  if (!created.ok) return { status: "error", error: created.error };

  return {
    status: "booked",
    scheduledFor: parsed.start,
    timezone,
    eventId: created.eventId,
    htmlLink: created.htmlLink,
  };
}
