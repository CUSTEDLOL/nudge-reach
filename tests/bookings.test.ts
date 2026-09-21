import { describe, expect, it } from "vitest";
import { allowedActions, asBookingStatus, bookingBucket } from "@/modules/bookings";

const NOW = new Date("2026-09-17T09:00:00Z");
const later = new Date("2026-09-18T10:30:00Z");
const earlier = new Date("2026-09-16T10:30:00Z");

describe("bookings — where a booking shows and what you can do", () => {
  it("buckets by status and time", () => {
    expect(bookingBucket({ status: "pending", scheduledFor: null }, NOW)).toBe("pending");
    expect(bookingBucket({ status: "confirmed", scheduledFor: later }, NOW)).toBe("upcoming");
    expect(bookingBucket({ status: "confirmed", scheduledFor: earlier }, NOW)).toBe("past");
    expect(bookingBucket({ status: "confirmed", scheduledFor: null }, NOW)).toBe("upcoming");
    for (const status of ["completed", "no_show", "cancelled", "declined"]) {
      expect(bookingBucket({ status, scheduledFor: later }, NOW)).toBe("past");
    }
  });

  it("offers only the actions that make sense", () => {
    expect(allowedActions({ status: "pending", scheduledFor: null }, NOW)).toEqual(["confirm", "cancel"]);
    expect(allowedActions({ status: "confirmed", scheduledFor: later }, NOW)).toEqual(["cancel"]);
    expect(allowedActions({ status: "confirmed", scheduledFor: earlier }, NOW)).toEqual(["complete", "no_show", "cancel"]);
    expect(allowedActions({ status: "cancelled", scheduledFor: earlier }, NOW)).toEqual([]);
    expect(allowedActions({ status: "completed", scheduledFor: earlier }, NOW)).toEqual([]);
  });

  it("treats an unknown status as pending rather than crashing", () => {
    expect(asBookingStatus("weird")).toBe("pending");
  });
});
