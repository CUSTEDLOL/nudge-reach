import { describe, it, expect } from "vitest";
import { evaluateLimit } from "@/modules/billing/limits";
import { getPlan, PLANS, planPrice } from "@/modules/billing/plans";

describe("evaluateLimit", () => {
  it("allows when under the cap", () => {
    expect(evaluateLimit(10, 1, 250, "contacts", "Free").allowed).toBe(true);
    expect(evaluateLimit(249, 1, 250, "contacts", "Free").allowed).toBe(true);
  });

  it("blocks when the addition would pass the cap", () => {
    const r = evaluateLimit(250, 1, 250, "contacts", "Free");
    expect(r.allowed).toBe(false);
    expect(r.message).toContain("Free");
    expect(r.message).toContain("Upgrade");
  });

  it("blocks bulk additions that overshoot, and says how many fit", () => {
    const r = evaluateLimit(240, 20, 250, "contacts", "Free");
    expect(r.allowed).toBe(false);
    expect(r.message).toContain("10"); // remaining
  });

  it("null limit means unlimited", () => {
    expect(evaluateLimit(1_000_000, 500, null, "messages", "Pro").allowed).toBe(
      true
    );
  });

  it("exact fit is allowed (limit is inclusive)", () => {
    expect(evaluateLimit(240, 10, 250, "contacts", "Free").allowed).toBe(true);
  });
});

describe("plans", () => {
  it("has the four sellable tiers in order", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "starter", "growth", "pro"]);
    expect(PLANS.map((p) => planPrice(p, "INR"))).toEqual([0, 999, 2499, 5999]);
  });

  it("maps the legacy 'scale' id to Pro", () => {
    expect(getPlan("scale").id).toBe("pro");
  });

  it("falls back to Free for unknown plan ids", () => {
    expect(getPlan("banana").id).toBe("free");
  });

  it("every paid tier raises every limit vs the tier below (or unlimits it)", () => {
    for (let i = 1; i < PLANS.length; i++) {
      const prev = PLANS[i - 1].limits;
      const next = PLANS[i].limits;
      for (const key of ["contacts", "teamMembers", "messagesPerMonth"] as const) {
        const p = prev[key];
        const n = next[key];
        if (n === null) continue; // unlimited beats anything
        expect(p).not.toBeNull();
        expect(n).toBeGreaterThan(p!);
      }
    }
  });
});
