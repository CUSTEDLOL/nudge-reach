import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  contactCount: vi.fn(async () => 0),
  conversationCount: vi.fn(async (args: { where: { status?: unknown } }) => {
    if (args.where.status === "handoff") return 2;
    if (args.where.status) return 7;
    return 9;
  }),
  conversationAggregate: vi.fn(async () => ({ _sum: { unreadCount: 6 } })),
  conversationFindMany: vi.fn(async () => []),
  campaignCount: vi.fn(async () => 0),
  campaignFindMany: vi.fn(async () => []),
  messageGroupBy: vi.fn(async () => []),
  automationCount: vi.fn(async () => 0),
  whatsappAccountCount: vi.fn(async () => 0),
  knowledgeEntryCount: vi.fn(async () => 1),
  ownerQuestionCount: vi.fn(async () => 3),
  bookingRequestCount: vi.fn(
    async (args: { where: { status?: string } }) =>
      args.where.status === "confirmed" ? 4 : 5
  ),
  paymentRequestAggregate: vi.fn(async () => ({
    _count: { _all: 6 },
    _sum: { amountMinor: 70_000 },
  })),
  recovery: vi.fn(async () => ({
    enabled: true,
    bookingsThisMonth: 11,
    followUpsThisMonth: 12,
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    contact: { count: db.contactCount },
    conversation: {
      count: db.conversationCount,
      aggregate: db.conversationAggregate,
      findMany: db.conversationFindMany,
    },
    campaign: { count: db.campaignCount, findMany: db.campaignFindMany },
    message: { groupBy: db.messageGroupBy },
    automation: { count: db.automationCount },
    whatsappAccount: { count: db.whatsappAccountCount },
    knowledgeEntry: { count: db.knowledgeEntryCount },
    ownerQuestion: { count: db.ownerQuestionCount },
    bookingRequest: { count: db.bookingRequestCount },
    paymentRequest: { aggregate: db.paymentRequestAggregate },
  },
}));

vi.mock("@/modules/orgs/mode", () => ({
  orgSendMode: vi.fn(async () => "simulation"),
}));

vi.mock("@/modules/followup/metrics", () => ({
  getRecoveryMetrics: db.recovery,
}));

import { getDashboardData } from "@/modules/dashboard/queries";

describe("getDashboardData operational snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every attention and operations count inside the caller org", async () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    const data = await getDashboardData("org-a", "Asia/Kolkata", now);

    expect(data).toMatchObject({
      handoffCount: 2,
      ownerQuestionCount: 3,
      unreadMessageCount: 6,
      bookingsToday: 4,
      pendingBookingCount: 5,
      pendingPaymentCount: 6,
      pendingPaymentAmountMinor: 70_000,
      recovery: {
        enabled: true,
        bookingsThisMonth: 11,
        followUpsThisMonth: 12,
      },
    });
    expect(db.ownerQuestionCount).toHaveBeenCalledWith({
      where: { orgId: "org-a", status: "pending" },
    });
    expect(db.bookingRequestCount).toHaveBeenCalledWith({
      where: {
        orgId: "org-a",
        status: "confirmed",
        scheduledFor: {
          gte: new Date("2026-09-05T18:30:00.000Z"),
          lt: new Date("2026-09-06T18:30:00.000Z"),
        },
      },
    });
    expect(db.bookingRequestCount).toHaveBeenCalledWith({
      where: { orgId: "org-a", status: "pending" },
    });
    expect(db.paymentRequestAggregate).toHaveBeenCalledWith({
      where: { orgId: "org-a", status: "created" },
      _count: { _all: true },
      _sum: { amountMinor: true },
    });
    expect(db.recovery).toHaveBeenCalledWith("org-a", now);
  });
});
