/**
 * Bookings as the owner sees them. Pure rules, so the page and its actions
 * agree and the rules are tested rather than read off the screen.
 *
 * Status lifecycle (BookingRequest.status):
 *   pending → confirmed → completed
 *                       → no_show
 *   pending | confirmed → cancelled
 *   pending → declined  (legacy; treated like cancelled)
 */

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "declined",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingAction = "confirm" | "cancel" | "no_show" | "complete";

export const ACTION_TARGET: Record<BookingAction, BookingStatus> = {
  confirm: "confirmed",
  cancel: "cancelled",
  no_show: "no_show",
  complete: "completed",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Needs confirming",
  confirmed: "Confirmed",
  completed: "Done",
  no_show: "No-show",
  cancelled: "Cancelled",
  declined: "Declined",
};

export const STATUS_TONE: Record<BookingStatus, "success" | "warning" | "neutral" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "success",
  completed: "neutral",
  no_show: "danger",
  cancelled: "neutral",
  declined: "neutral",
};

export type BookingView = "upcoming" | "pending" | "past";
export const BOOKING_VIEWS: readonly BookingView[] = ["upcoming", "pending", "past"];

export function asBookingStatus(value: string): BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
    ? (value as BookingStatus)
    : "pending";
}

/** Which list a booking belongs on right now. */
export function bookingBucket(
  b: { status: string; scheduledFor: Date | null },
  now: Date
): BookingView {
  const status = asBookingStatus(b.status);
  if (status === "pending") return "pending";
  if (status !== "confirmed") return "past";
  if (b.scheduledFor && b.scheduledFor.getTime() < now.getTime()) return "past";
  return "upcoming";
}

/**
 * What a person may do to a booking. A confirmed booking whose time has
 * passed is either done or a no-show; one still ahead can only be cancelled.
 */
export function allowedActions(
  b: { status: string; scheduledFor: Date | null },
  now: Date
): BookingAction[] {
  const status = asBookingStatus(b.status);
  if (status === "pending") return ["confirm", "cancel"];
  if (status !== "confirmed") return [];
  const past = Boolean(b.scheduledFor && b.scheduledFor.getTime() < now.getTime());
  return past ? ["complete", "no_show", "cancel"] : ["cancel"];
}

export function isBookingAction(value: string): value is BookingAction {
  return value in ACTION_TARGET;
}
