import { describe, it, expect } from "vitest";
import {
  getPlan,
  selfServePlans,
  PLAN_PRICES,
  type PlanId,
} from "@/modules/billing/plans";

/**
 * Feature-flag matrix. Each gated capability hangs off one of these booleans,
 * and this test is the contract. Re-tiered 2026-09-11: AI replies are on every
 * paid plan, Growth adds the real actions, Pro adds voice and BYO key. `free`
 * and `front_desk` are legacy — kept so existing workspaces keep what they had.
 */
const MATRIX: Record<
  | "publicApi" | "webWidget" | "leadScoring" | "customActions"
  | "byoLlm" | "multiNumber" | "voiceAgent" | "aiFrontDesk",
  Record<PlanId, boolean>
> = {
  publicApi: {
    entry: false, free: false, starter: false, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  webWidget: {
    entry: false, free: false, starter: true, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  leadScoring: {
    entry: false, free: false, starter: false, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  customActions: {
    entry: false, free: false, starter: false, growth: false, pro: true, front_desk: true, enterprise: true,
  },
  byoLlm: {
    entry: false, free: false, starter: false, growth: false, pro: true, front_desk: true, enterprise: true,
  },
  multiNumber: {
    entry: false, free: false, starter: false, growth: true, pro: true, front_desk: true, enterprise: true,
  },
  voiceAgent: {
    entry: false, free: false, starter: false, growth: false, pro: true, front_desk: true, enterprise: true,
  },
  aiFrontDesk: {
    entry: false, free: false, starter: false, growth: true, pro: true, front_desk: true, enterprise: true,
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
  it("resolves, is unlimited on all numeric caps, and has the real actions", () => {
    const p = getPlan("enterprise");
    expect(p.id).toBe("enterprise");
    expect(p.limits.contacts).toBeNull();
    expect(p.limits.teamMembers).toBeNull();
    expect(p.limits.automations).toBeNull();
    expect(p.limits.messagesPerMonth).toBeNull();
    expect(p.limits.whatsappNumbers).toBeNull();
    expect(p.limits.aiFrontDesk).toBe(true);
  });

  it("is priced 0 (contact-us) in all 10 currencies", () => {
    expect(Object.values(PLAN_PRICES.enterprise)).toHaveLength(10);
    for (const price of Object.values(PLAN_PRICES.enterprise)) {
      expect(price).toBe(0);
    }
  });

  it("is excluded from the self-serve billing grid, as are the legacy tiers", () => {
    const ids = selfServePlans().map((p) => p.id);
    expect(ids).not.toContain("enterprise");
    expect(ids).toEqual(["entry", "starter", "growth", "pro"]);
  });

  it("keeps the retired tiers resolvable so existing workspaces don't break", () => {
    for (const id of ["free", "front_desk"] as const) {
      const plan = getPlan(id);
      expect(plan.id).toBe(id);
      expect(plan.legacy).toBe(true);
    }
    // The retired flagship keeps every capability it was sold with.
    expect(getPlan("front_desk").limits.voiceAgent).toBe(true);
    expect(getPlan("front_desk").limits.teamMembers).toBeNull();
  });

  it("keeps the legacy 'scale' → pro mapping intact", () => {
    expect(getPlan("scale").id).toBe("pro");
  });
});
