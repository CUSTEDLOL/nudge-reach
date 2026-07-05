import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  // lib/billing imports lib/env, which validates process.env at module load.
  process.env.SKIP_ENV_VALIDATION = "1";
});

describe("estimateCampaignCost", () => {
  it("multiplies recipients by the per-message rate", async () => {
    const { estimateCampaignCost } = await import("@/modules/billing");
    const estimate = estimateCampaignCost(100);
    expect(estimate.totalMinorUnits).toBe(
      100 * estimate.ratePerMessageMinorUnits
    );
    expect(estimate.currency).toBe("INR");
    expect(estimate.isEstimate).toBe(true);
  });

  it("formats paise as rupees", async () => {
    const { formatInr } = await import("@/modules/billing");
    expect(formatInr(9900)).toBe("₹99.00");
    expect(formatInr(99)).toBe("₹0.99");
  });
});
