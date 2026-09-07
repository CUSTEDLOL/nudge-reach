import { describe, expect, it } from "vitest";
import { dailySeries } from "@/modules/admin/usage";

describe("dailySeries", () => {
  const now = new Date("2026-09-07T12:00:00");
  it("zero-fills the window oldest → newest and drops items outside it", () => {
    const s = dailySeries(
      [
        { at: new Date("2026-09-07T01:00:00") },
        { at: new Date("2026-09-06T23:00:00") },
        { at: new Date("2026-09-06T08:00:00") },
        { at: new Date("2026-08-01T08:00:00") },
      ],
      3,
      now
    );
    expect(s.map((d) => d.count)).toEqual([0, 2, 1]);
    expect(s[2].label).toMatch(/7 Sept?/);
  });

  it("sums weights when given (cost series)", () => {
    const s = dailySeries([{ at: now, weight: 250 }, { at: now, weight: 750 }], 1, now);
    expect(s).toEqual([{ label: s[0].label, count: 1000 }]);
  });
});
