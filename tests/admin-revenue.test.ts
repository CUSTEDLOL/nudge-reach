import { describe, expect, it } from "vitest";
import { aggregateMrr } from "@/modules/admin/revenue";

/** MRR is book value per currency — list price × active orgs, no FX. */
describe("aggregateMrr", () => {
  it("sums list prices per currency and plan, ordered by plan tier", () => {
    const { rows, byCurrency } = aggregateMrr([
      { plan: "front_desk", currency: "INR" },
      { plan: "front_desk", currency: "INR" },
      { plan: "starter", currency: "INR" },
      { plan: "front_desk", currency: "SGD" },
    ]);
    expect(rows.map((r) => `${r.currency}:${r.plan}:${r.orgs}:${r.monthly}`)).toEqual([
      "INR:starter:1:4499",
      "INR:front_desk:2:29998",
      "SGD:front_desk:1:599",
    ]);
    expect(byCurrency).toEqual([
      { currency: "INR", monthly: 34497, orgs: 3 },
      { currency: "SGD", monthly: 599, orgs: 1 },
    ]);
  });

  it("counts retired and contact-only orgs at zero, and maps legacy ids", () => {
    const { rows } = aggregateMrr([
      { plan: "free", currency: "USD" },
      { plan: "enterprise", currency: "USD" },
      { plan: "scale", currency: "USD" }, // legacy id for pro
    ]);
    expect(rows.find((r) => r.plan === "free")?.monthly).toBe(0);
    expect(rows.find((r) => r.plan === "enterprise")?.monthly).toBe(0);
    expect(rows.find((r) => r.plan === "pro")?.monthly).toBe(179);
  });

  it("is empty with no active subscriptions", () => {
    expect(aggregateMrr([])).toEqual({ rows: [], byCurrency: [] });
  });
});
