import { beforeEach, describe, expect, it, vi } from "vitest";

/** Overview aggregation math on mocked prisma groupBy shapes. */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    conversationMessage: { findMany: vi.fn(), groupBy: vi.fn() },
    aiUsage: { groupBy: vi.fn() },
    bookingRequest: { count: vi.fn() },
    paymentRequest: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { overviewStats } from "@/modules/admin/queries";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.count.mockResolvedValue(12);
  prisma.org.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
    by[0] === "plan"
      ? [
          { plan: "free", _count: 8 },
          { plan: "growth", _count: 3 },
          { plan: "enterprise", _count: 1 },
        ]
      : [
          { simulated: true, _count: 10 },
          { simulated: false, _count: 2 },
        ]
  );
  prisma.org.findMany.mockResolvedValue([
    { createdAt: new Date() },
    { createdAt: new Date() },
  ]);
  prisma.conversationMessage.findMany.mockResolvedValue([
    { conversation: { orgId: "a" } },
    { conversation: { orgId: "a" } },
    { conversation: { orgId: "b" } },
  ]);
  prisma.conversationMessage.groupBy.mockResolvedValue([
    { direction: "inbound", _count: 40 },
    { direction: "outbound", _count: 55 },
  ]);
  prisma.aiUsage.groupBy.mockResolvedValue([
    { byok: false, _sum: { costMicroUsd: 3_000_000 } },
    { byok: true, _sum: { costMicroUsd: 1_000_000 } },
  ]);
  prisma.bookingRequest.count.mockResolvedValue(7);
  prisma.paymentRequest.count.mockResolvedValue(4);
});

describe("overviewStats", () => {
  it("aggregates plan, mode, activity, cost and volume correctly", async () => {
    const s = await overviewStats(30);
    expect(s.orgsTotal).toBe(12);
    expect(s.orgsByPlan[0]).toEqual({ plan: "free", count: 8 });
    expect(s.liveOrgs).toBe(2);
    expect(s.testOrgs).toBe(10);
    expect(s.signupsInRange).toBe(2);
    expect(s.signupsByDay).toHaveLength(30);
    expect(s.signupsByDay.at(-1)?.count).toBe(2); // both signups today
    expect(s.activeOrgs).toBe(2); // distinct orgs a + b
    expect(s.messagesInbound).toBe(40);
    expect(s.messagesOutbound).toBe(55);
    expect(s.aiCostMicroUsd).toBe(4_000_000);
    expect(s.aiCostByokMicroUsd).toBe(1_000_000);
    expect(s.bookings).toBe(7);
    expect(s.paymentsPaid).toBe(4);
  });

  it("never selects message bodies (privacy rule)", async () => {
    await overviewStats(7);
    for (const call of prisma.conversationMessage.findMany.mock.calls) {
      const select = call[0]?.select ?? {};
      expect(select).not.toHaveProperty("body");
    }
  });
});
