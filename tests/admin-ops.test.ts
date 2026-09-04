import { describe, expect, it } from "vitest";
import { buildCostAlerts } from "@/modules/admin/ops";

describe("buildCostAlerts", () => {
  it("keeps only orgs over the threshold, sorted worst-first", () => {
    const alerts = buildCostAlerts([
      // growth INR ≈ ₹2,499? — whatever the real price, $40 of AI cost on any
      // sub-$100 plan is over 35%; $0.10 on the same plan is not.
      { orgId: "a", orgName: "Hot", plan: "growth", currency: "INR", costMicroUsd30d: 40_000_000 },
      { orgId: "b", orgName: "Cold", plan: "growth", currency: "INR", costMicroUsd30d: 100_000 },
    ]);
    expect(alerts.map((a) => a.orgId)).toEqual(["a"]);
    expect(alerts[0].pctOfPlan).toBeGreaterThan(35);
  });

  it("never alerts on unpriced (free/unknown) plans and survives junk currency", () => {
    const alerts = buildCostAlerts([
      { orgId: "c", orgName: "Free", plan: "free", currency: "INR", costMicroUsd30d: 99_000_000 },
      { orgId: "d", orgName: "Junk", plan: "growth", currency: "XXX", costMicroUsd30d: 40_000_000 },
    ]);
    expect(alerts.find((a) => a.orgId === "c")).toBeUndefined();
    // Junk currency falls back to INR pricing rather than crashing.
    expect(alerts.find((a) => a.orgId === "d")).toBeDefined();
  });
});
