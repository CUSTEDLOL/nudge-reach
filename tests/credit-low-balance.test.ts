import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Low-balance email (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 8): after a metered debit the OWNER is told once per paid period when
 * the balance is at or under 10% of the period's included credits (or at 0).
 * Unmetered legacy plans and SEND_MODE=simulation never notify; the notice
 * never throws into the debit path.
 */

const { prisma, tx, envState, sendEmail, appOrigin } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    creditGrant: { update: vi.fn() },
    creditDebit: { create: vi.fn() },
  };
  return {
    tx,
    envState: { SEND_MODE: "live" },
    prisma: {
      org: { findUnique: vi.fn(), update: vi.fn() },
      membership: { findFirst: vi.fn() },
      creditGrant: { aggregate: vi.fn(), findFirst: vi.fn() },
      creditDebit: { aggregate: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(),
    },
    sendEmail: vi.fn(),
    appOrigin: vi.fn(() => "https://app.test"),
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/modules/email", () => ({ sendEmail, appOrigin }));

import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credit-rates";
import { settleDebit } from "@/modules/billing/credits";
import {
  isLowBalance,
  lowNoticeDue,
  maybeNotifyLowCredits,
} from "@/modules/billing/credit-alerts";

const NOW = new Date("2026-09-16T10:00:00Z");
const PERIOD_START = new Date("2026-09-01T00:00:00Z");
const PERIOD_END = new Date("2026-10-01T00:00:00Z");
const credits = (n: number) => n * MICRO_USD_PER_CREDIT;

const starter = {
  id: "o1",
  name: "Glow Clinic",
  plan: "starter",
  featureOverrides: {},
  includedCreditsOverride: null,
  trialEndsAt: null,
  creditsLowNotifiedAt: null as Date | null,
};
const includedGrant = { amountMicroUsd: credits(1_000), issuedAt: PERIOD_START, expiresAt: PERIOD_END };

/** The org's balance and included grant as the summary queries see them. */
function seed(balanceMicroUsd: number, included: typeof includedGrant | null = includedGrant) {
  prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: balanceMicroUsd } });
  prisma.creditGrant.findFirst.mockImplementation(async (args: { where: { kind: string } }) =>
    args.where.kind === "included" ? included : null
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  envState.SEND_MODE = "live";
  prisma.org.findUnique.mockResolvedValue(starter);
  prisma.org.update.mockResolvedValue({});
  prisma.membership.findFirst.mockResolvedValue({ email: "owner@x.com" });
  prisma.creditDebit.aggregate.mockResolvedValue({ _avg: { amountMicroUsd: credits(0.5) } });
  prisma.creditDebit.create.mockResolvedValue({});
  sendEmail.mockResolvedValue({ ok: true });
  seed(credits(100));
});

describe("pure threshold rules", () => {
  it("isLowBalance: at or under 10% of included, or at zero", () => {
    expect(isLowBalance(credits(100), credits(1_000))).toBe(true);
    expect(isLowBalance(credits(100.1), credits(1_000))).toBe(false);
    expect(isLowBalance(0, 0)).toBe(true);
    expect(isLowBalance(credits(5), 0)).toBe(false); // trial: only zero counts
  });

  it("lowNoticeDue: never notified, or notified before this period's grant", () => {
    expect(lowNoticeDue(null, null)).toBe(true);
    expect(lowNoticeDue(null, PERIOD_START)).toBe(true);
    expect(lowNoticeDue(new Date("2026-08-20T00:00:00Z"), PERIOD_START)).toBe(true);
    expect(lowNoticeDue(new Date("2026-09-02T00:00:00Z"), PERIOD_START)).toBe(false);
    expect(lowNoticeDue(new Date("2026-09-02T00:00:00Z"), null)).toBe(false);
  });
});

describe("maybeNotifyLowCredits", () => {
  it("notifies the OWNER once per paid period when balance ≤ 10% of included", async () => {
    await maybeNotifyLowCredits("o1", NOW);

    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "o1", role: "OWNER" } })
    );
    expect(sendEmail).toHaveBeenCalledOnce();
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("owner@x.com");
    expect(mail.subject).toMatch(/running low/i);
    expect(mail.text).toContain("100.0");
    expect(mail.text).toContain("1,000");
    expect(mail.text).toMatch(/≈ 200 more AI replies/);
    expect(mail.text).toContain("https://app.test/settings/billing");
    expect(mail.html).toContain("https://app.test/settings/billing");
    expect(prisma.org.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { creditsLowNotifiedAt: NOW },
    });

    // Same period, already told: quiet.
    vi.clearAllMocks();
    prisma.org.findUnique.mockResolvedValue({ ...starter, creditsLowNotifiedAt: NOW });
    seed(credits(50));
    await maybeNotifyLowCredits("o1", new Date("2026-09-20T10:00:00Z"));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.org.update).not.toHaveBeenCalled();

    // A renewal issues a fresh grant after the last notice: due again.
    const later = new Date("2026-10-20T10:00:00Z");
    seed(credits(50), { ...includedGrant, issuedAt: PERIOD_END });
    await maybeNotifyLowCredits("o1", later);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("notifies at ≤ 0 (a trial org with no included grant included)", async () => {
    prisma.org.findUnique.mockResolvedValue({
      ...starter,
      trialEndsAt: new Date("2026-09-30T00:00:00Z"),
    });
    seed(-credits(0.2), null);
    await maybeNotifyLowCredits("o1", NOW);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/used up/i);
    expect(prisma.org.update).toHaveBeenCalledOnce();
  });

  it("does not notify above the threshold", async () => {
    seed(credits(100.1));
    await maybeNotifyLowCredits("o1", NOW);
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.org.update).not.toHaveBeenCalled();
  });

  it("does not notify an unmetered or simulation org", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "front_desk" });
    seed(0);
    await maybeNotifyLowCredits("o1", NOW);
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();

    prisma.org.findUnique.mockResolvedValue(starter);
    envState.SEND_MODE = "simulation";
    await maybeNotifyLowCredits("o1", NOW);
    expect(prisma.org.findUnique).toHaveBeenCalledOnce(); // only the unmetered case above
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.org.update).not.toHaveBeenCalled();
  });

  it("skips cleanly when email is unconfigured (sendEmail no-op) and still stamps", async () => {
    sendEmail.mockResolvedValue({ ok: false, skipped: true });
    await expect(maybeNotifyLowCredits("o1", NOW)).resolves.toBeUndefined();
    expect(prisma.org.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { creditsLowNotifiedAt: NOW },
    });
  });

  it("does not stamp when sendEmail throws, and never throws itself", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockRejectedValue(new Error("resend down"));
    await expect(maybeNotifyLowCredits("o1", NOW)).resolves.toBeUndefined();
    expect(prisma.org.update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits]"),
      expect.objectContaining({ orgId: "o1" }),
      expect.anything()
    );
    error.mockRestore();
  });

  it("swallows a failing lookup with a [credits] log", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.org.findUnique.mockRejectedValue(new Error("db down"));
    await expect(maybeNotifyLowCredits("o1", NOW)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[credits]"),
      expect.objectContaining({ orgId: "o1" }),
      expect.anything()
    );
    error.mockRestore();
  });
});

describe("settleDebit hook", () => {
  const attribution = { orgId: "o1", conversationId: "c1", purpose: "agent_reply" as const };
  const base = {
    attribution,
    model: "claude-haiku-4-5",
    usage: { inputTokens: 4_000, outputTokens: 0 },
    aiUsageId: "u1",
  };

  beforeEach(() => {
    tx.$queryRaw.mockResolvedValue([
      { id: "g1", remainingMicroUsd: credits(1_000), expiresAt: PERIOD_END },
    ]);
    tx.creditDebit.create.mockResolvedValue({});
    tx.creditGrant.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it("triggers the check only after a metered debit", async () => {
    await settleDebit({ ...base, metering: "shadow" });
    await settleDebit({ ...base, attribution: { ...attribution, purpose: "ingest" }, metering: "absorbed" });
    await settleDebit({ ...base, metering: "unmetered" });
    await flush();
    expect(prisma.org.findUnique).not.toHaveBeenCalled();

    await settleDebit({ ...base, metering: "metered" });
    await flush();
    expect(prisma.org.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "o1" },
        select: expect.objectContaining({ creditsLowNotifiedAt: true }),
      })
    );
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("does not run the check when the metered debit failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    await settleDebit({ ...base, metering: "metered" });
    await flush();
    expect(prisma.org.findUnique).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
