import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    contactEvent: { groupBy: vi.fn(), findMany: vi.fn() },
    org: { groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  eventsOverview,
  eventsWhere,
  parseEventsDays,
  pivotByDay,
} from "@/modules/admin/events";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.contactEvent.groupBy.mockResolvedValue([{ type: "payment_paid", _count: 2 }]);
  prisma.contactEvent.findMany
    .mockResolvedValueOnce([
      { type: "payment_paid", createdAt: new Date("2026-09-10T08:00:00Z") },
    ])
    .mockResolvedValueOnce([
      { type: "payment_paid", createdAt: new Date("2026-09-10T08:00:00Z"), org: { id: "org-1", name: "Glow" } },
    ]);
  prisma.org.groupBy.mockResolvedValue([{ vertical: "clinic", _count: 1 }]);
});

describe("pivotByDay", () => {
  const now = new Date("2026-09-05T12:00:00Z");
  const day = (offset: number) =>
    new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);

  it("frames every day in range and stacks counts per type", () => {
    const rows = pivotByDay(3, now, [
      { type: "opted_out", createdAt: day(0) },
      { type: "payment_paid", createdAt: day(0) },
      { type: "payment_paid", createdAt: day(0) },
      { type: "lead_stage_changed", createdAt: day(2) },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0].counts).toEqual({ lead_stage_changed: 1 }); // oldest first
    expect(rows[1].counts).toEqual({});
    expect(rows[2].counts).toEqual({ opted_out: 1, payment_paid: 2 });
  });

  it("ignores events outside the framed range instead of crashing", () => {
    const rows = pivotByDay(2, now, [{ type: "x", createdAt: day(30) }]);
    expect(rows.every((r) => Object.keys(r.counts).length === 0)).toBe(true);
  });
});

describe("event demand filters", () => {
  const now = new Date("2026-09-10T10:00:00Z");
  const since = new Date("2026-09-03T10:00:00Z");

  it("accepts only approved date ranges", () => {
    expect(parseEventsDays("7")).toBe(7);
    expect(parseEventsDays(["90", "7"])).toBe(90);
    expect(parseEventsDays("999")).toBe(30);
    expect(parseEventsDays(undefined)).toBe(30);
  });

  it("builds optional type, organization, and vertical filters", () => {
    expect(eventsWhere({ type: "payment_paid", orgId: " org-1 ", vertical: "clinic" }, since)).toEqual({
      createdAt: { gte: since },
      type: "payment_paid",
      orgId: "org-1",
      org: { vertical: "clinic" },
    });
  });

  it("uses the same filter for totals, series, and recent rows without reading props or messages", async () => {
    const filter = { days: 7, type: "payment_paid", orgId: "org-1", vertical: "clinic" };
    await eventsOverview(filter, now);
    const expectedWhere = eventsWhere(filter, since);
    expect(prisma.contactEvent.groupBy.mock.calls[0][0].where).toEqual(expectedWhere);
    expect(prisma.contactEvent.findMany.mock.calls[0][0].where).toEqual(expectedWhere);
    expect(prisma.contactEvent.findMany.mock.calls[1][0].where).toEqual(expectedWhere);
    const serialized = JSON.stringify(prisma.contactEvent.findMany.mock.calls);
    expect(serialized).not.toContain("props");
    expect(serialized).not.toContain("body");
    expect(serialized).not.toContain("conversation");
  });
});
