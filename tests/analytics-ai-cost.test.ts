import { describe, expect, it } from "vitest";
import { aiCostAlert, formatMicroUsd } from "@/modules/analytics/compute";
import { approxMicroUsd } from "@/modules/billing/money";
import { PLAN_COST_ALERT_PCT } from "@/modules/billing/plans";

describe("formatMicroUsd", () => {
  it("formats dollars, sub-cent and zero honestly", () => {
    expect(formatMicroUsd(3_420_000)).toBe("$3.42");
    expect(formatMicroUsd(5_000)).toBe("<$0.01");
    expect(formatMicroUsd(0)).toBe("$0");
  });
});

describe("approxMicroUsd", () => {
  it("converts plan prices to comparable micro-USD", () => {
    expect(approxMicroUsd(1, "USD")).toBe(1_000_000);
    // ₹14,999 ≈ $180 — same ballpark as the USD anchor.
    const inr = approxMicroUsd(14_999, "INR");
    expect(inr).toBeGreaterThan(150_000_000);
    expect(inr).toBeLessThan(220_000_000);
  });
});

describe("aiCostAlert", () => {
  const plan = approxMicroUsd(20, "USD"); // $20 plan

  it("flags an org whose AI cost exceeds the threshold", () => {
    const res = aiCostAlert(8_000_000, plan, PLAN_COST_ALERT_PCT); // $8 on $20 = 40%
    expect(res).not.toBeNull();
    expect(res!.over).toBe(true);
    expect(Math.round(res!.pct)).toBe(40);
  });

  it("does not flag under the threshold", () => {
    const res = aiCostAlert(4_000_000, plan, PLAN_COST_ALERT_PCT); // 20%
    expect(res!.over).toBe(false);
  });

  it("returns null for an unpriced plan instead of pretending", () => {
    expect(aiCostAlert(1_000_000, 0, PLAN_COST_ALERT_PCT)).toBeNull();
  });
});
