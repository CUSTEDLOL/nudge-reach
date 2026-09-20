import { beforeEach, describe, it, expect, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    contact: { count: vi.fn() },
    membership: { count: vi.fn() },
    invite: { count: vi.fn() },
    automation: { count: vi.fn() },
    message: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import {
  applyFeatureOverrides,
  checkAiFrontDesk,
  checkAutomationLimit,
  checkMessageLimit,
  checkWhatsappNumbers,
  evaluateLimit,
  sanitizeFeatureOverrides,
} from "@/modules/billing/limits";
import { getPlan, PLANS, planPrice, selfServePlans } from "@/modules/billing/plans";

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
  it("sells four tiers plus Enterprise, with the retired ones last", () => {
    expect(PLANS.map((p) => p.id)).toEqual([
      "entry",
      "starter",
      "growth",
      "pro",
      "enterprise",
      "free",
      "front_desk",
    ]);
    expect(PLANS.map((p) => planPrice(p, "INR"))).toEqual([
      1499, 4999, 9999, 19999, 0, 0, 14999,
    ]);
  });

  it("promises included AI credits on every sold tier (founder-set 2026-09-15)", () => {
    expect(selfServePlans().map((p) => p.includedCredits)).toEqual([200, 1000, 2500, 5000]);
    // Enterprise credits are agreed per deal, never a grid number.
    expect(getPlan("enterprise").includedCredits).toBeNull();
  });

  it("gives the agent's real actions to Growth and up, never to Starter", () => {
    expect(PLANS.filter((p) => p.limits.aiFrontDesk).map((p) => p.id)).toEqual([
      "growth",
      "pro",
      "enterprise",
      "front_desk",
    ]);
  });

  it("maps the legacy 'scale' id to Pro", () => {
    expect(getPlan("scale").id).toBe("pro");
  });

  it("falls back to Free for unknown plan ids", () => {
    expect(getPlan("banana").id).toBe("free");
  });

  it("every sold tier raises every limit vs the tier below (or unlimits it)", () => {
    const sold = selfServePlans();
    for (let i = 1; i < sold.length; i++) {
      const prev = sold[i - 1].limits;
      const next = sold[i].limits;
      for (const key of [
        "contacts",
        "teamMembers",
        "messagesPerMonth",
        "whatsappNumbers",
      ] as const) {
        const p = prev[key];
        const n = next[key];
        if (n === null) continue; // unlimited beats anything
        expect(p).not.toBeNull();
        expect(n).toBeGreaterThanOrEqual(p!);
      }
      // Price, at least, always goes up.
      expect(planPrice(sold[i], "INR")).toBeGreaterThan(planPrice(sold[i - 1], "INR"));
    }
  });
});

describe("feature overrides (founder panel bespoke deals)", () => {
  it("returns the plan untouched when there are no overrides", () => {
    const plan = getPlan("growth");
    expect(applyFeatureOverrides(plan, {})).toBe(plan);
    expect(applyFeatureOverrides(plan, null)).toBe(plan);
    expect(applyFeatureOverrides(plan, "junk")).toBe(plan);
  });

  it("merges known boolean flags and numeric counts over the plan", () => {
    const plan = getPlan("starter");
    expect(plan.limits.byoLlm).toBe(false);
    const merged = applyFeatureOverrides(plan, { byoLlm: true, contacts: 5000 });
    expect(merged.limits.byoLlm).toBe(true);
    expect(merged.limits.contacts).toBe(5000);
    expect(merged.limits.publicApi).toBe(plan.limits.publicApi);
    expect(merged.id).toBe("starter");
  });

  it("ignores unknown keys and wrong types so a bad blob can't widen access", () => {
    const out = sanitizeFeatureOverrides({
      voiceAgent: "yes",
      contacts: -1,
      messagesPerMonth: null,
      teamMembers: 3.5,
      somethingElse: true,
      __proto__: { publicApi: true },
    });
    expect(out).toEqual({ messagesPerMonth: null, teamMembers: 3.5 });
  });

  it("a null count means unlimited", () => {
    const merged = applyFeatureOverrides(getPlan("free"), { contacts: null });
    expect(merged.limits.contacts).toBeNull();
  });
});

describe("acquisition trial effective limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.org.findUnique.mockResolvedValue({
      plan: "free",
      featureOverrides: {},
      subscriptionStatus: "inactive",
      acquisitionTrial: { id: "trial_1", convertedAt: null },
    });
    prisma.automation.count.mockResolvedValue(0);
    prisma.message.count.mockResolvedValue(0);
  });

  it("blocks WhatsApp, campaigns, automations and real AI Front Desk actions", async () => {
    const results = await Promise.all([
      checkWhatsappNumbers("org_1", 0),
      checkMessageLimit("org_1", 1),
      checkAutomationLimit("org_1"),
      checkAiFrontDesk("org_1"),
    ]);

    expect(results.map((result) => result.allowed)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("uses the purchased plan after payment activates the subscription", async () => {
    prisma.org.findUnique.mockResolvedValue({
      plan: "growth",
      featureOverrides: {},
      subscriptionStatus: "active",
      acquisitionTrial: { id: "trial_1", convertedAt: null },
    });

    await expect(checkAiFrontDesk("org_1")).resolves.toMatchObject({
      allowed: true,
    });
  });
});
