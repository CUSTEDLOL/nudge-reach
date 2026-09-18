import { prisma } from "@/lib/db";
import { calendarModeFor, driverFor } from "@/modules/calendar/index";
import { getCalendarAccount, getCalendarCredentials } from "@/modules/calendar/accounts";

/**
 * Nudge writes the event and, until now, never read it back. An owner who
 * moves or deletes an appointment in Google Calendar expects Nudge to follow:
 * no reminder for the old time, no phantom row on the bookings list.
 *
 * Cheap and safe: one events.get per booking, only for real Google
 * connections, and any failure leaves the booking untouched.
 */

export interface SyncedBooking {
  id: string;
  status: string;
  scheduledFor: Date | null;
  calendarEventId: string | null;
}

export type SyncChange = "unchanged" | "moved" | "cancelled" | "skipped";

export async function syncBookingWithCalendar(
  orgId: string,
  booking: SyncedBooking
): Promise<{ change: SyncChange; booking: SyncedBooking }> {
  if (!booking.calendarEventId || booking.status !== "confirmed") {
    return { change: "skipped", booking };
  }
  const account = await getCalendarAccount(orgId);
  if (!account || calendarModeFor(account) !== "google") {
    return { change: "skipped", booking };
  }
  const credentials = await getCalendarCredentials(orgId);
  if (!credentials) return { change: "skipped", booking };

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const state = await driverFor("google", org?.timezone ?? "UTC").getEvent(
    booking.calendarEventId,
    credentials
  );
  if (!state.ok) return { change: "skipped", booking };

  if (state.status === "cancelled" || state.status === "missing") {
    const updated = await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
      select: { id: true, status: true, scheduledFor: true, calendarEventId: true },
    });
    return { change: "cancelled", booking: updated };
  }

  if (state.start) {
    const start = new Date(state.start);
    if (!Number.isNaN(start.getTime()) && start.getTime() !== booking.scheduledFor?.getTime()) {
      const updated = await prisma.bookingRequest.update({
        where: { id: booking.id },
        data: { scheduledFor: start },
        select: { id: true, status: true, scheduledFor: true, calendarEventId: true },
      });
      return { change: "moved", booking: updated };
    }
  }
  return { change: "unchanged", booking };
}

/** Sync a batch, in order, swallowing per-booking failures. */
export async function syncBookingsWithCalendar<T extends SyncedBooking>(
  orgId: string,
  bookings: T[]
): Promise<T[]> {
  const out: T[] = [];
  for (const b of bookings) {
    try {
      const { booking } = await syncBookingWithCalendar(orgId, b);
      out.push({ ...b, ...booking });
    } catch {
      out.push(b);
    }
  }
  return out;
}
