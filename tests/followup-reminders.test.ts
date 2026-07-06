import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase-8 regressions for the reminder tick:
 * - runtime flagship gate: an org that downgraded off AI Front Desk is skipped
 *   even if its FollowUpConfig is still enabled (findings #5/#7)
 * - the T-24h query excludes the <2h window (finding #3 — no double-fire)
 */

const { findConfig, findOrg, findBooking, updateBooking, sendTemplate } =
  vi.hoisted(() => ({
    findConfig: vi.fn(),
    findOrg: vi.fn(),
    findBooking: vi.fn().mockResolvedValue([]),
    updateBooking: vi.fn().mockResolvedValue({}),
    sendTemplate: vi.fn().mockResolvedValue({ ok: true }),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    followUpConfig: { findMany: findConfig },
    org: { findMany: findOrg },
    bookingRequest: { findMany: findBooking, update: updateBooking },
  },
}));
vi.mock("@/modules/followup/send", () => ({ sendApprovedTemplate: sendTemplate }));

import { tickBookingReminders } from "@/modules/followup/reminders";

const cfg = {
  orgId: "o1",
  bookingReminders: true,
  noShowRebook: true,
  postServiceReview: true,
};

beforeEach(() => {
  findBooking.mockClear();
  findBooking.mockResolvedValue([]);
});

describe("tickBookingReminders — flagship gate + windowing", () => {
  it("skips an org that is no longer on the AI Front Desk plan", async () => {
    findConfig.mockResolvedValue([cfg]);
    findOrg.mockResolvedValue([{ id: "o1", plan: "free" }]); // downgraded
    const r = await tickBookingReminders(new Date("2026-07-06T10:00:00Z"));
    expect(findBooking).not.toHaveBeenCalled(); // never queries the org's bookings
    expect(r).toEqual({ reminders: 0, reviews: 0, rebooks: 0 });
  });

  it("processes a flagship org, and the T-24h query starts strictly after +2h", async () => {
    findConfig.mockResolvedValue([cfg]);
    findOrg.mockResolvedValue([{ id: "o1", plan: "front_desk" }]);
    const now = new Date("2026-07-06T10:00:00Z");
    await tickBookingReminders(now);
    expect(findBooking).toHaveBeenCalled();
    // first bookingRequest.findMany is the T-24h query — its lower bound is now+2h
    const firstWhere = findBooking.mock.calls[0][0].where;
    expect(firstWhere.scheduledFor.gt.getTime()).toBe(now.getTime() + 2 * 3_600_000);
    expect(firstWhere.scheduledFor.lte.getTime()).toBe(
      now.getTime() + 24 * 3_600_000
    );
  });
});
