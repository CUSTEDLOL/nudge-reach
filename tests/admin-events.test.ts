import { describe, expect, it } from "vitest";
import { pivotByDay } from "@/modules/admin/events";

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
