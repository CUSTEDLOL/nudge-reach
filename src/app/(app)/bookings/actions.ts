"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { recordContactEvent } from "@/modules/contacts/events";
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
