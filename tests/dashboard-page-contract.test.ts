import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Today page hierarchy", () => {
  it("composes the approved single vertical decision flow", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    const orderedComponents = [
      "<AttentionQueueSection",
      "<OperationsSummary",
      "<FrontDeskSummary",
      "<BusinessPulse",
      "<SetupProgress",
      "<RecentActivity",
    ];
    const positions = orderedComponents.map((name) => source.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps direct Prisma calls out of the route", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("prisma.");
  });

  it("uses a loading state shaped like the vertical Today hierarchy", () => {
    const source = readFileSync("src/app/(app)/dashboard/loading.tsx", "utf8");
    expect(source).toContain('aria-label="Loading Today workspace"');
    expect(source).not.toContain("Array.from({ length: 8 })");
    expect(source).toContain("grid-cols-1");
  });
});
