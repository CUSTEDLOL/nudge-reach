/**
 * E6 lead scoring + churn risk (docs/plans/2026-09-04-enterprise-track.md §E6).
 * Deterministic, explainable, cheap: hand-weighted rules over real behavior —
 * NO model calls, no ML deps (house rule: prefer deterministic code over
 * runtime AI). Every score carries human-readable reasons; the number is
 * never a mystery. Weights are the product spec — change them here, and the
 * monotonicity tests keep them honest.
 */

export interface ScoringFeatures {
  /** Days since the contact last wrote to us (null = never). */
  daysSinceLastInbound: number | null;
  /** Inbound messages in the last 30 days. */
  inboundLast30d: number;
  /** Campaign engagement (best status reached across campaign sends). */
  clickedCampaign: boolean;
  readCampaign: boolean;
  /** Booking outcomes (all time). */
  bookingsCompleted: number;
  bookingsNoShow: number;
  bookingsUpcoming: number;
  /** Payments actually paid (all time). */
  paymentsPaid: number;
  leadStage: "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
  optedOut: boolean;
}

export interface LeadScore {
  score: number;
  reasons: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeLeadScore(f: ScoringFeatures): LeadScore {
  const reasons: string[] = [];
  let score = 20; // neutral base — a brand-new contact is a mild prospect

  // Recency — the strongest signal we have.
  if (f.daysSinceLastInbound !== null) {
    if (f.daysSinceLastInbound <= 2) {
      score += 25;
      reasons.push("replied in the last 2 days");
    } else if (f.daysSinceLastInbound <= 7) {
      score += 15;
      reasons.push("active this week");
    } else if (f.daysSinceLastInbound <= 30) {
      score += 5;
      reasons.push("active this month");
    } else if (f.daysSinceLastInbound > 60) {
      score -= 10;
      reasons.push("quiet for 2+ months");
    }
  }

  // Frequency.
  if (f.inboundLast30d >= 10) {
    score += 10;
    reasons.push("messages often");
  } else if (f.inboundLast30d >= 3) {
    score += 5;
    reasons.push("engaged in chat");
  }

  // Campaign engagement.
  if (f.clickedCampaign) {
    score += 10;
    reasons.push("clicked a campaign");
  } else if (f.readCampaign) {
    score += 5;
    reasons.push("reads campaigns");
  }

  // Bookings — kept appointments up, no-shows down.
  if (f.bookingsCompleted >= 1) {
    score += 15;
    reasons.push(
      f.bookingsCompleted === 1 ? "completed a booking" : `completed ${f.bookingsCompleted} bookings`
    );
  }
  if (f.bookingsUpcoming >= 1) {
    score += 10;
    reasons.push("has an upcoming booking");
  }
  if (f.bookingsNoShow >= 1) {
    score -= Math.min(20, f.bookingsNoShow * 10);
    reasons.push(f.bookingsNoShow === 1 ? "missed a booking" : `missed ${f.bookingsNoShow} bookings`);
  }

  // Revenue — the strongest positive label.
  if (f.paymentsPaid >= 1) {
    score += 20;
    reasons.push(f.paymentsPaid === 1 ? "has paid before" : `paid ${f.paymentsPaid} times`);
  }

  // Pipeline stage.
  if (f.leadStage === "WON") {
    score += 10;
    reasons.push("won customer");
  } else if (f.leadStage === "QUALIFIED") {
    score += 5;
    reasons.push("qualified lead");
  } else if (f.leadStage === "LOST") {
    score -= 25;
    reasons.push("marked lost");
  }

  // Opt-out overrides everything — you cannot market to them (invariant 2).
  if (f.optedOut) {
    return { score: Math.min(clamp(score), 5), reasons: ["opted out of messages"] };
  }
  return { score: clamp(score), reasons };
}

export type ChurnRisk = "low" | "medium" | "high";

/**
 * Churn risk for REPEAT customers only (2+ revenue/booking events): compare
 * the current quiet spell to the contact's own historical cadence. Returns
 * null for contacts without enough history to judge.
 */
export function computeChurnRisk(
  activityDates: Date[],
  now: Date = new Date()
): ChurnRisk | null {
  const sorted = [...activityDates].sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].getTime() - sorted[i - 1].getTime());
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 0) return null;

  const sinceLast = now.getTime() - sorted[sorted.length - 1].getTime();
  if (sinceLast > 2 * median) return "high";
  if (sinceLast > 1.25 * median) return "medium";
  return "low";
}
