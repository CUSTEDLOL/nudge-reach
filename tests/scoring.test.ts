import { describe, it, expect } from "vitest";
import {
  computeLeadScore,
  computeChurnRisk,
  type ScoringFeatures,
} from "@/modules/scoring";

/**
 * E6: the scoring rules are the product spec. Pure + deterministic — same
 * features, same score, always — with monotonicity pinned so a weight tweak
 * can never make bad behavior raise a score.
 */

const BASE: ScoringFeatures = {
  daysSinceLastInbound: null,
  inboundLast30d: 0,
  clickedCampaign: false,
  readCampaign: false,
  bookingsCompleted: 0,
  bookingsNoShow: 0,
  bookingsUpcoming: 0,
  paymentsPaid: 0,
  leadStage: "NEW",
  optedOut: false,
};

describe("computeLeadScore", () => {
  it("is deterministic and bounded 0–100", () => {
    const hot: ScoringFeatures = {
      ...BASE,
      daysSinceLastInbound: 1,
      inboundLast30d: 12,
      clickedCampaign: true,
      bookingsCompleted: 3,
      bookingsUpcoming: 1,
      paymentsPaid: 4,
      leadStage: "WON",
    };
    const a = computeLeadScore(hot);
    const b = computeLeadScore(hot);
    expect(a).toEqual(b);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(computeLeadScore({ ...BASE, leadStage: "LOST", bookingsNoShow: 5, daysSinceLastInbound: 90 }).score).toBeGreaterThanOrEqual(0);
  });

  it("every reason is a human-readable string, and a hot lead has several", () => {
    const { reasons } = computeLeadScore({
      ...BASE,
      daysSinceLastInbound: 1,
      paymentsPaid: 2,
      bookingsCompleted: 1,
    });
    expect(reasons.length).toBeGreaterThanOrEqual(3);
    for (const r of reasons) expect(r).toMatch(/[a-z]/);
  });

  it("monotonicity: more no-shows never raises the score", () => {
    let prev = Infinity;
    for (let noShows = 0; noShows <= 4; noShows++) {
      const { score } = computeLeadScore({ ...BASE, daysSinceLastInbound: 3, bookingsNoShow: noShows });
      expect(score).toBeLessThanOrEqual(prev);
      prev = score;
    }
  });

  it("monotonicity: going quieter never raises the score", () => {
    const days = [1, 5, 20, 45, 90];
    let prev = Infinity;
    for (const d of days) {
      const { score } = computeLeadScore({ ...BASE, daysSinceLastInbound: d });
      expect(score).toBeLessThanOrEqual(prev);
      prev = score;
    }
  });

  it("payments and completed bookings raise the score", () => {
    const plain = computeLeadScore(BASE).score;
    expect(computeLeadScore({ ...BASE, paymentsPaid: 1 }).score).toBeGreaterThan(plain);
    expect(computeLeadScore({ ...BASE, bookingsCompleted: 1 }).score).toBeGreaterThan(plain);
  });

  it("an opt-out caps the score at 5 no matter how good the history is", () => {
    const { score, reasons } = computeLeadScore({
      ...BASE,
      optedOut: true,
      paymentsPaid: 10,
      bookingsCompleted: 10,
      leadStage: "WON",
      daysSinceLastInbound: 1,
    });
    expect(score).toBeLessThanOrEqual(5);
    expect(reasons).toEqual(["opted out of messages"]);
  });
});

describe("computeChurnRisk", () => {
  const d = (daysAgo: number, now: Date) => new Date(now.getTime() - daysAgo * 24 * 3600_000);

  it("needs at least two activity events", () => {
    const now = new Date();
    expect(computeChurnRisk([d(5, now)], now)).toBeNull();
    expect(computeChurnRisk([], now)).toBeNull();
  });

  it("a regular customer inside their cadence is low risk", () => {
    const now = new Date();
    // Monthly visitor, last seen 20 days ago (median gap 30d).
    expect(computeChurnRisk([d(80, now), d(50, now), d(20, now)], now)).toBe("low");
  });

  it("a regular customer gone quiet for 2x their cadence is high risk", () => {
    const now = new Date();
    // Monthly visitor, silent for 70 days.
    expect(computeChurnRisk([d(130, now), d(100, now), d(70, now)], now)).toBe("high");
  });

  it("moderately overdue is medium risk", () => {
    const now = new Date();
    // Median gap 30d, silent for 45.
    expect(computeChurnRisk([d(105, now), d(75, now), d(45, now)], now)).toBe("medium");
  });
});
