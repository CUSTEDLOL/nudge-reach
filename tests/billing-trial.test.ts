import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { TRIAL_DAYS, trialDaysLeft, trialEndDate } from "@/modules/billing/trial";

describe("AI Front Desk trial", () => {
  const start = new Date("2026-08-25T10:00:00Z");

  it("runs for the documented number of days", () => {
    const end = trialEndDate(start);
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(TRIAL_DAYS);
  });

  it("counts down in whole days and never goes negative", () => {
    const end = trialEndDate(start);
    expect(trialDaysLeft(end, start)).toBe(TRIAL_DAYS);
    expect(trialDaysLeft(end, new Date(end.getTime() - 3_600_000))).toBe(1);
    expect(trialDaysLeft(end, new Date(end.getTime() + 3_600_000))).toBe(0);
  });

  it("is null for orgs that never had one", () => {
    expect(trialDaysLeft(null)).toBeNull();
  });
});
