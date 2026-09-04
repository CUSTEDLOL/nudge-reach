import { describe, it, expect } from "vitest";
import {
  getPlan,
  selfServePlans,
  PLAN_PRICES,
  type PlanId,
} from "@/modules/billing/plans";

/**
 * E0 feature-flag matrix (head plan F4,
 * docs/plans/2026-09-04-enterprise-track.md). Each later enterprise
 * workstream gates on one of these booleans — this test is the contract.
 */
const MATRIX: Record<
  "publicApi" | "webWidget" | "leadScoring" | "customActions" | "byoLlm" | "multiNumber" | "voiceAgent",
  Record<PlanId, boolean>
> = {
  publicApi: {
    free: false, starter: false, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  webWidget: {
    free: false, starter: true, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  leadScoring: {
    free: false, starter: false, growth: false, pro: true, front_desk: true, enterprise: true,
  },
  customActions: {
    free: false, starter: false, growth: false, pro: false, front_desk: true, enterprise: true,
  },
  byoLlm: {
    free: false, starter: false, growth: false, pro: false, front_desk: true, enterprise: true,
  },
  multiNumber: {
    free: false, starter: false, growth: false, pro: false, front_desk: true, enterprise: true,
  },
  voiceAgent: {
    free: false, starter: false, growth: false, pro: false, front_desk: true, enterprise: true,
  },
};

describe("enterprise feature-flag matrix (F4)", () => {
  for (const [flag, byPlan] of Object.entries(MATRIX)) {
    it(`${flag} matches the F4 matrix on every tier`, () => {
      for (const [planId, expected] of Object.entries(byPlan)) {
        const plan = getPlan(planId);
        expect(plan.id, `getPlan("${planId}") should resolve`).toBe(planId);
        expect(
          plan.limits[flag as keyof typeof plan.limits],
          `${planId}.${flag}`
        ).toBe(expected);
      }
    });
  }
});

describe("enterprise tier", () => {
  it("resolves, is unlimited on all numeric caps, and has aiFrontDesk", () => {
    const p = getPlan("enterprise");
    expect(p.id).toBe("enterprise");
    expect(p.limits.contacts).toBeNull();
    expect(p.limits.teamMembers).toBeNull();
    expect(p.limits.automations).toBeNull();
    expect(p.limits.messagesPerMonth).toBeNull();
    expect(p.limits.aiFrontDesk).toBe(true);
  });

  it("is priced 0 (contact-us) in all 10 currencies", () => {
    expect(Object.values(PLAN_PRICES.enterprise)).toHaveLength(10);
    for (const price of Object.values(PLAN_PRICES.enterprise)) {
      expect(price).toBe(0);
    }
  });

  it("is excluded from the self-serve billing grid", () => {
    const ids = selfServePlans().map((p) => p.id);
    expect(ids).not.toContain("enterprise");
    // The self-serve grid keeps the existing five tiers untouched.
    expect(ids).toEqual(["free", "starter", "growth", "pro", "front_desk"]);
  });

  it("keeps the legacy 'scale' → pro mapping intact", () => {
    expect(getPlan("scale").id).toBe("pro");
  });
});
