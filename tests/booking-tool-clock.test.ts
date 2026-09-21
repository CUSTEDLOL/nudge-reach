import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two promises the booking tool makes to the customer, both of which were
 * false on 2026-09-17: the time it confirms is on the business's clock, and
 * "you'll get a reminder" is said only when Follow-ups will actually send one.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    bookingRequest: { create: vi.fn().mockResolvedValue({ id: "b1", status: "confirmed" }) },
    contact: { update: vi.fn().mockResolvedValue({}) },
    note: { create: vi.fn().mockResolvedValue({}) },
    conversation: { update: vi.fn().mockResolvedValue({}) },
    followUpConfig: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/crm/events", () => ({ crmBookingCreated: vi.fn() }));
vi.mock("@/modules/automation/triggers", () => ({ fireBookingCreated: vi.fn() }));

const { bookAppointment } = vi.hoisted(() => ({ bookAppointment: vi.fn() }));
vi.mock("@/modules/calendar", () => ({ bookAppointment }));

import { captureBookingTool } from "@/modules/agent/tools/capture-booking";

const ctx = {
  orgId: "org1",
  contactId: "c1",
  conversationId: "cv1",
  contactName: "GOAT BAKRA",
  contactPhone: "+919810000000",
};

// 4:00 PM IST on Fri 18 Sep 2026.
const FOUR_PM_IST = new Date("2026-09-18T10:30:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  bookAppointment.mockResolvedValue({
    status: "booked",
    scheduledFor: FOUR_PM_IST,
    timezone: "Asia/Kolkata",
    eventId: "evt1",
  });
});

describe("capture_booking_request — what it tells the customer", () => {
  it("confirms the time on the business's clock, not the server's", async () => {
    prisma.followUpConfig.findUnique.mockResolvedValue(null);
    const r = await captureBookingTool.parseAndRun(ctx, {
      name: "GOAT BAKRA",
      requested_for: "Friday 18 September at 4 PM",
    });
    expect(r.isError).toBeUndefined();
    expect(r.result).toMatch(/4:00 pm/i);
    expect(r.result).not.toMatch(/10:30/);
    // The staff note carries the same clock.
    const note = prisma.note.create.mock.calls[0][0].data.body as string;
    expect(note).toMatch(/4:00 pm/i);
  });

  it("does not promise a reminder when Follow-ups is off", async () => {
    prisma.followUpConfig.findUnique.mockResolvedValue(null);
    const r = await captureBookingTool.parseAndRun(ctx, { name: "A", requested_for: "4pm" });
    expect(r.result).toMatch(/Do not mention a reminder/);
    expect(r.result).not.toMatch(/they'll get a reminder/);
  });

  it("promises a reminder only when Follow-ups will send one", async () => {
    prisma.followUpConfig.findUnique.mockResolvedValue({ enabled: true, bookingReminders: true });
    const r = await captureBookingTool.parseAndRun(ctx, { name: "A", requested_for: "4pm" });
    expect(r.result).toMatch(/they'll get a reminder/);
  });

  it("offers alternatives on the business's clock when the slot is taken", async () => {
    bookAppointment.mockResolvedValue({
      status: "unavailable",
      timezone: "Asia/Kolkata",
      alternatives: [
        { start: "2026-09-18T11:30:00Z", end: "2026-09-18T12:30:00Z" }, // 5 PM IST
        { start: "2026-09-18T12:30:00Z", end: "2026-09-18T13:30:00Z" }, // 6 PM IST
      ],
    });
    const r = await captureBookingTool.parseAndRun(ctx, { name: "A", requested_for: "4pm" });
    expect(r.result).toMatch(/5:00 pm.*6:00 pm/i);
    expect(prisma.bookingRequest.create).not.toHaveBeenCalled();
  });
});
