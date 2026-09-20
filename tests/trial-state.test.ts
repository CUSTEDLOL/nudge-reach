import { describe, expect, it } from "vitest";
import {
  TRIAL_DAYS,
  TRIAL_REPLY_LIMIT,
  deriveTrialStatus,
  trialEndsAt,
} from "@/modules/trial/state";

const now = new Date("2026-09-20T00:00:00Z");
const base = {
  orgId: "org_1",
  claimedAt: now,
  startedAt: now,
  expiresAt: new Date("2026-09-27T00:00:00Z"),
  repliesUsed: 0,
  replyLimit: 15,
  convertedAt: null,
  subscriptionStatus: "inactive",
};

describe("acquisition trial state", () => {
  it("uses the approved seven-day and 15-reply contract", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(TRIAL_REPLY_LIMIT).toBe(15);
    expect(trialEndsAt(now).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("distinguishes pending, active, exhausted, expired and converted", () => {
    expect(deriveTrialStatus({ ...base, orgId: null }, now)).toBe("pending");
    expect(deriveTrialStatus(base, now)).toBe("active");
    expect(deriveTrialStatus({ ...base, repliesUsed: 15 }, now)).toBe("exhausted");
    expect(deriveTrialStatus(base, new Date("2026-09-27T00:00:00Z"))).toBe("expired");
    expect(deriveTrialStatus({ ...base, convertedAt: now }, now)).toBe("converted");
    expect(deriveTrialStatus({ ...base, subscriptionStatus: "active" }, now)).toBe("converted");
  });
});
