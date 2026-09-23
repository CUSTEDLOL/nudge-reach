"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordContactEvent } from "@/modules/contacts/events";
import { parseOpeningHours } from "@/modules/calendar/hours";
import { settingsWithOpeningHours } from "@/modules/calendar/hours-store";
import {
  ACTION_TARGET,
  allowedActions,
  isBookingAction,
} from "@/modules/bookings";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Confirm / cancel / no-show / done. Org-scoped (a booking id from another
 * workspace is "not found"), and only transitions the rules allow — the
 * same rules that decide which buttons the list shows.
 */
export async function setBookingStatusAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const bookingId = String(formData.get("bookingId") ?? "");
    const action = String(formData.get("action") ?? "");
    if (!isBookingAction(action)) return { ok: false, message: "Unknown action." };

    const booking = await prisma.bookingRequest.findFirst({
      where: { id: bookingId, orgId: org.id },
      select: { id: true, status: true, scheduledFor: true, contactId: true },
    });
    if (!booking) return { ok: false, message: "Booking not found." };
    if (!allowedActions(booking, new Date()).includes(action)) {
      return { ok: false, message: "That booking can't be changed that way any more." };
    }

    const status = ACTION_TARGET[action];
    await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { status },
    });
    recordContactEvent(org.id, "booking_status", {
      contactId: booking.contactId,
      props: { status, bookingRequestId: booking.id, source: "bookings_page" },
    });

    revalidatePath("/bookings");
    revalidatePath("/dashboard");
    const said: Record<typeof status, string> = {
      confirmed: "Confirmed.",
      cancelled: "Cancelled.",
      no_show: "Marked as a no-show.",
      completed: "Marked done.",
      pending: "Updated.",
      declined: "Declined.",
    };
    return { ok: true, message: said[status] };
  } catch {
    return { ok: false, message: "Couldn't update the booking — try again." };
  }
}

/**
 * When the business is open to take appointments. It lived on the retired
 * /agent/setup page, where it read as part of the AI's persona; it is nothing
 * of the sort — it is booking configuration, and `modules/calendar` is its only
 * consumer (an empty 3 am slot is not a bookable slot).
 *
 * The storage is deliberately unchanged by the move: the same `openingHours`
 * key inside `Org.settings`, written through the same two helpers, so every
 * org's existing schedule keeps working with no migration.
 *
 * Org-wide setting, so ADMIN+ server-side — the UI disabling the switch for an
 * AGENT is not enforcement.
 */
export async function saveOpeningHoursAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    // "" clears the hours (no restriction); anything else must parse into a
    // schedule where every day closes after it opens, or nothing is written —
    // a half-valid save would silently narrow what the AI can book.
    const raw = String(formData.get("openingHours") ?? "").trim();
    let hours: ReturnType<typeof parseOpeningHours> = null;
    if (raw) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return { ok: false, message: "Opening hours look wrong — check each day closes after it opens." };
      }
      hours = parseOpeningHours(json);
      if (!hours) {
        return { ok: false, message: "Opening hours look wrong — check each day closes after it opens." };
      }
    }

    await prisma.org.update({
      where: { id: ctx.org.id },
      data: { settings: settingsWithOpeningHours(ctx.org.settings, hours) },
    });

    revalidatePath("/bookings");
    return {
      ok: true,
      message: hours
        ? "Saved. Your AI only books inside these hours."
        : "Saved. Any free calendar slot can now be booked.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save your opening hours.",
    };
  }
}
