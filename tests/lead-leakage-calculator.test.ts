import { describe, expect, it } from "vitest";

import {
  calculateLeadLeakage,
  normalizeLeadLeakageInputs,
} from "@/modules/marketing/lead-leakage";

describe("normalizeLeadLeakageInputs", () => {
  it("clamps percentages to 0–100 and counts and values at zero", () => {
    expect(
      normalizeLeadLeakageInputs({
        monthlyLeads: -20,
        missedReplyPercent: -5,
        missingFollowupPercent: 125,
        conversionPercent: 140,
        averageSaleValue: -1_000,
      }),
    ).toEqual({
      monthlyLeads: 0,
      missedReplyPercent: 0,
      missingFollowupPercent: 100,
      conversionPercent: 100,
      averageSaleValue: 0,
    });
  });

  it("replaces every non-finite input with zero", () => {
    const normalized = normalizeLeadLeakageInputs({
      monthlyLeads: Number.POSITIVE_INFINITY,
      missedReplyPercent: Number.NaN,
      missingFollowupPercent: Number.NEGATIVE_INFINITY,
      conversionPercent: Number.POSITIVE_INFINITY,
      averageSaleValue: Number.NaN,
    });

    expect(normalized).toEqual({
      monthlyLeads: 0,
      missedReplyPercent: 0,
      missingFollowupPercent: 0,
      conversionPercent: 0,
      averageSaleValue: 0,
    });
    expect(Object.values(normalized).every(Number.isFinite)).toBe(true);
  });
});

describe("calculateLeadLeakage", () => {
  it("calculates lead and revenue risk with the documented formulas", () => {
    expect(
      calculateLeadLeakage({
        monthlyLeads: 240,
        missedReplyPercent: 25,
        missingFollowupPercent: 20,
        conversionPercent: 10,
        averageSaleValue: 5_000,
      }),
    ).toEqual({
      missedReplyLeads: 60,
      repliedLeads: 180,
      missingFollowupLeads: 36,
      leadsAtRisk: 96,
      customersAtRisk: 9.6,
      monthlyRevenueAtRisk: 48_000,
      annualRevenueAtRisk: 576_000,
      calculationCapped: false,
    });
  });

  it("rounds lead and customer outputs to two decimals and money to whole units", () => {
    expect(
      calculateLeadLeakage({
        monthlyLeads: 101,
        missedReplyPercent: 12.5,
        missingFollowupPercent: 33,
        conversionPercent: 7.5,
        averageSaleValue: 999.99,
      }),
    ).toEqual({
      missedReplyLeads: 12.63,
      repliedLeads: 88.38,
      missingFollowupLeads: 29.16,
      leadsAtRisk: 41.79,
      customersAtRisk: 3.13,
      monthlyRevenueAtRisk: 3_134,
      annualRevenueAtRisk: 37_609,
      calculationCapped: false,
    });
  });

  it("rounds decimal lead counts using their numeric scale", () => {
    expect(
      calculateLeadLeakage({
        monthlyLeads: 10.075,
        missedReplyPercent: 100,
        missingFollowupPercent: 0,
        conversionPercent: 0,
        averageSaleValue: 0,
      }).missedReplyLeads,
    ).toBe(10.08);
  });

  it("uses normalized values before calculating and never returns non-finite results", () => {
    const result = calculateLeadLeakage({
      monthlyLeads: Number.POSITIVE_INFINITY,
      missedReplyPercent: Number.NaN,
      missingFollowupPercent: 200,
      conversionPercent: Number.NEGATIVE_INFINITY,
      averageSaleValue: -500,
    });

    expect(result).toEqual({
      missedReplyLeads: 0,
      repliedLeads: 0,
      missingFollowupLeads: 0,
      leadsAtRisk: 0,
      customersAtRisk: 0,
      monthlyRevenueAtRisk: 0,
      annualRevenueAtRisk: 0,
      calculationCapped: false,
    });
    const numericResults = Object.values(result).filter(
      (value): value is number => typeof value === "number",
    );
    expect(numericResults.every(Number.isFinite)).toBe(true);
  });

  it("discloses capped estimates when finite inputs exceed arithmetic range", () => {
    const result = calculateLeadLeakage({
      monthlyLeads: Number.MAX_VALUE,
      missedReplyPercent: 100,
      missingFollowupPercent: 100,
      conversionPercent: 100,
      averageSaleValue: Number.MAX_VALUE,
    });

    expect(result.calculationCapped).toBe(true);
    const numericResults = Object.values(result).filter(
      (value): value is number => typeof value === "number",
    );
    expect(numericResults.every(Number.isFinite)).toBe(true);
  });

  it("applies clamped percentages to the formulas", () => {
    expect(
      calculateLeadLeakage({
        monthlyLeads: 100,
        missedReplyPercent: -10,
        missingFollowupPercent: 150,
        conversionPercent: 120,
        averageSaleValue: 10,
      }),
    ).toEqual({
      missedReplyLeads: 0,
      repliedLeads: 100,
      missingFollowupLeads: 100,
      leadsAtRisk: 100,
      customersAtRisk: 100,
      monthlyRevenueAtRisk: 1_000,
      annualRevenueAtRisk: 12_000,
      calculationCapped: false,
    });
  });
});
