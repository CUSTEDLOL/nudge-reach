import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credit ledger pure core (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 2): FIFO-by-expiry allocation with a one-call overdraft, the metering
 * class of an org, the remaining-replies estimate, and the org-scoped balance.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { creditGrant: { aggregate: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  allocateFifo,
  creditBalance,
  estimateRemainingReplies,
  meteringFor,
} from "@/modules/billing/credits";
import { MICRO_USD_PER_CREDIT, priceCall } from "@/modules/billing/credit-rates";

// Soonest-expiring first, exactly as the debit query orders them.
const grants = [
  { id: "g1", remainingMicroUsd: 3_000 },
  { id: "g2", remainingMicroUsd: 5_000 },
  { id: "g3", remainingMicroUsd: 10_000 },
];

describe("allocateFifo", () => {
  it("spends the soonest-expiring grant first", () => {
    expect(allocateFifo(grants, 2_000)).toEqual({
      allocations: [{ grantId: "g1", microUsd: 2_000 }],
    });
  });

  it("skips nothing expired (caller filters) and splits across grants", () => {
    // 3,000 exhausts g1, 4,000 comes from g2, g3 is untouched.
    expect(allocateFifo(grants, 7_000)).toEqual({
      allocations: [
        { grantId: "g1", microUsd: 3_000 },
        { grantId: "g2", microUsd: 4_000 },
      ],
    });
    // An already-drained grant contributes nothing and is not listed.
    expect(
      allocateFifo([{ id: "empty", remainingMicroUsd: 0 }, ...grants], 1_000)
    ).toEqual({ allocations: [{ grantId: "g1", microUsd: 1_000 }] });
  });

  it("overdraws onto the latest-expiring grant when short", () => {
    expect(allocateFifo(grants, 20_000)).toEqual({
      allocations: [
        { grantId: "g1", microUsd: 3_000 },
        { grantId: "g2", microUsd: 5_000 },
        { grantId: "g3", microUsd: 10_000 },
      ],
      overdraftOn: { grantId: "g3", microUsd: 2_000 },
    });
  });

  it("overdraft anchor works with a 0-amount grant", () => {
    // Enterprise without an override: the period's grant is issued at 0 so
    // the first (racing) call lands entirely as overdraft on it.
    expect(allocateFifo([{ id: "g0", remainingMicroUsd: 0 }], 7_000)).toEqual({
      allocations: [],
      overdraftOn: { grantId: "g0", microUsd: 7_000 },
    });
    // A grant already overdrawn is skipped, never "refilled" by a negative take.
    expect(
      allocateFifo(
        [
          { id: "neg", remainingMicroUsd: -500 },
          { id: "g", remainingMicroUsd: 1_000 },
        ],
        1_000
      )
    ).toEqual({ allocations: [{ grantId: "g", microUsd: 1_000 }] });
  });

  it("refuses to allocate against no grants (nothing to anchor the debit)", () => {
    expect(() => allocateFifo([], 1)).toThrow(/no grant/i);
    expect(allocateFifo([], 0)).toEqual({ allocations: [] });
  });
});

describe("meteringFor", () => {
  const base = { featureOverrides: {}, includedCreditsOverride: null, trialEndsAt: null };

  it("legacy front_desk → unmetered", () => {
    expect(meteringFor({ ...base, plan: "front_desk" })).toEqual({ kind: "unmetered" });
  });

  it("free → metered 0", () => {
    expect(meteringFor({ ...base, plan: "free" })).toEqual({
      kind: "metered",
      includedCredits: 0,
    });
  });

  it("enterprise without override → metered 0", () => {
    expect(meteringFor({ ...base, plan: "enterprise" })).toEqual({
      kind: "metered",
      includedCredits: 0,
    });
  });

  it("enterprise with override → override", () => {
    expect(
      meteringFor({ ...base, plan: "enterprise", includedCreditsOverride: 12_000 })
    ).toEqual({ kind: "metered", includedCredits: 12_000 });
  });

  it("starter → 1,000", () => {
    expect(meteringFor({ ...base, plan: "starter" })).toEqual({
      kind: "metered",
      includedCredits: 1_000,
    });
  });

  it("featureOverrides never widen credits", () => {
    const widened = { includedCredits: 999_999, contactOnly: false, legacy: false };
    expect(meteringFor({ ...base, plan: "starter", featureOverrides: widened })).toEqual({
      kind: "metered",
      includedCredits: 1_000,
    });
    // Nor can they turn a metered plan unmetered, or an unmetered one metered.
    expect(
      meteringFor({ ...base, plan: "free", featureOverrides: { includedCredits: null } })
    ).toEqual({ kind: "metered", includedCredits: 0 });
    expect(meteringFor({ ...base, plan: "front_desk", featureOverrides: widened })).toEqual({
      kind: "unmetered",
    });
    // The override column is the only per-org credit knob, and only for Enterprise.
    expect(
      meteringFor({ ...base, plan: "starter", includedCreditsOverride: 12_000 })
    ).toEqual({ kind: "metered", includedCredits: 1_000 });
  });

  it("a live trial is metered against the trial grant only (no included credits)", () => {
    const now = new Date("2026-09-15T00:00:00Z");
    const live = new Date("2026-09-20T00:00:00Z");
    const over = new Date("2026-09-10T00:00:00Z");
    expect(meteringFor({ ...base, plan: "growth", trialEndsAt: live }, now)).toEqual({
      kind: "metered",
      includedCredits: 0,
    });
    // An ended trial the cron has not yet cleared behaves like no trial.
    expect(meteringFor({ ...base, plan: "growth", trialEndsAt: over }, now)).toEqual({
      kind: "metered",
      includedCredits: 2_500,
    });
  });
});

describe("estimateRemainingReplies", () => {
  it("uses recent average, falls back to rate-card reply price", () => {
    // 10 credits at 2 credits a reply → 5 replies.
    expect(estimateRemainingReplies(10 * MICRO_USD_PER_CREDIT, 2 * MICRO_USD_PER_CREDIT)).toBe(5);
    // Partial replies do not count; a drained or overdrawn balance is 0.
    expect(estimateRemainingReplies(9_999, 5_000)).toBe(1);
    expect(estimateRemainingReplies(0, 5_000)).toBe(0);
    expect(estimateRemainingReplies(-7_000, 5_000)).toBe(0);
    // No history: a 2,000-in / 300-out reply on the default runtime model.
    const fallback = priceCall("claude-sonnet-5", { inputTokens: 2_000, outputTokens: 300 });
    expect(fallback).toBe(7_000);
    expect(estimateRemainingReplies(70_000, null)).toBe(10);
    // A degenerate average (no spend recorded yet) also falls back.
    expect(estimateRemainingReplies(70_000, 0)).toBe(10);
  });
});

describe("creditBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sums only unexpired grants for the org", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: 12_345 } });
    const now = new Date("2026-09-15T12:00:00Z");
    await expect(creditBalance("o1", now)).resolves.toBe(12_345);
    expect(prisma.creditGrant.aggregate).toHaveBeenCalledWith({
      _sum: { remainingMicroUsd: true },
      where: { orgId: "o1", expiresAt: { gt: now } },
    });
  });

  it("is 0 when the org has no live grants", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: null } });
    await expect(creditBalance("o1")).resolves.toBe(0);
  });
});
