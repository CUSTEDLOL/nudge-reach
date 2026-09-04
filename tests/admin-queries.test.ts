import { beforeEach, describe, expect, it, vi } from "vitest";

/** Overview aggregation math on mocked prisma groupBy shapes. */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    conversation: { groupBy: vi.fn() },
    conversationMessage: { findMany: vi.fn(), groupBy: vi.fn() },
    aiUsage: { groupBy: vi.fn() },
    bookingRequest: { count: vi.fn() },
    paymentRequest: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { orgsList, overviewStats } from "@/modules/admin/queries";

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

describe("orgsList", () => {
  const makeOrg = (id: string) => ({
    id,
    name: `Org ${id}`,
    plan: "growth",
    simulated: true,
    vertical: "clinic",
    createdAt: new Date(),
    memberships: [{ email: `${id}@x.com` }],
    _count: { contacts: 3, whatsappAccounts: 1, memberships: 2 },
  });

  beforeEach(() => {
    prisma.aiUsage.groupBy.mockResolvedValue([
      { orgId: "o1", _sum: { costMicroUsd: 2_000_000 } },
    ]);
    prisma.conversation.groupBy.mockResolvedValue([
      { orgId: "o1", _max: { lastInboundAt: new Date("2026-09-01") } },
    ]);
  });

  it("returns a page with merged cost + last-inbound and a next cursor", async () => {
    prisma.org.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) => makeOrg(`o${i + 1}`))
    );
    const page = await orgsList({});
    expect(page.rows).toHaveLength(50);
    expect(page.nextCursor).toBe("o50");
    expect(page.rows[0].aiCostMicroUsd30d).toBe(2_000_000);
    expect(page.rows[0].lastInboundAt).toEqual(new Date("2026-09-01"));
    expect(page.rows[1].aiCostMicroUsd30d).toBe(0);
  });

  it("passes search and cursor into the query and ends pagination honestly", async () => {
    prisma.org.findMany.mockResolvedValue([makeOrg("o1")]);
    const page = await orgsList({ search: "spice", cursor: "o99" });
    expect(page.nextCursor).toBeNull();
    const args = prisma.org.findMany.mock.calls.at(-1)![0];
    expect(args.cursor).toEqual({ id: "o99" });
    expect(args.skip).toBe(1);
    expect(JSON.stringify(args.where)).toContain("spice");
  });
});
