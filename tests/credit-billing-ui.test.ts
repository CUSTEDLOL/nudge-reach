import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the customer sees of the credit ledger (Task 8 of
 * docs/superpowers/plans/2026-09-15-credit-ledger.md). Pages here are server
 * components behind requireOrgContext, and the repo checks them by source
 * (see tests/admin-integrations-page.test.ts), so the data helper and the
 * banner are unit-tested and the page wiring is asserted on its source.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    creditGrant: { aggregate: vi.fn(), findFirst: vi.fn() },
    creditDebit: { aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { CreditBanner } from "@/components/features/credit-banner";
import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credit-rates";
import { CREDITS_EXHAUSTED_MESSAGE, estimateRemainingReplies } from "@/modules/billing/credits";
import { creditSummary, formatCredits } from "@/modules/billing/credit-summary";

const NOW = new Date("2026-09-16T10:00:00Z");
const credits = (n: number) => n * MICRO_USD_PER_CREDIT;
const starter = {
  id: "o1",
  plan: "starter",
  featureOverrides: {},
  includedCreditsOverride: null,
  trialEndsAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: credits(250) } });
  prisma.creditGrant.findFirst.mockImplementation(async (args: { where: { kind: string } }) =>
    args.where.kind === "included"
      ? { amountMicroUsd: credits(1_000), issuedAt: new Date("2026-09-01T00:00:00Z") }
      : { expiresAt: new Date("2027-03-01T00:00:00Z") }
  );
  prisma.creditDebit.aggregate.mockResolvedValue({ _avg: { amountMicroUsd: credits(0.5) } });
});

describe("creditSummary", () => {
  it("averages this org's real agent replies over the last 30 days", async () => {
    await creditSummary(starter, NOW);
    expect(prisma.creditDebit.aggregate).toHaveBeenCalledWith({
      _avg: { amountMicroUsd: true },
      where: {
        orgId: "o1",
        purpose: "agent_reply",
        simulated: false,
        absorbed: false,
        createdAt: { gte: new Date("2026-08-17T10:00:00Z") },
      },
    });
  });

  it("estimate line uses the pure helper", async () => {
    const s = await creditSummary(starter, NOW);
    expect(s.metering).toEqual({ kind: "metered", includedCredits: 1_000 });
    expect(s.balanceMicroUsd).toBe(credits(250));
    expect(s.included).toMatchObject({ amountMicroUsd: credits(1_000) });
    expect(s.purchasedExpiresAt).toEqual(new Date("2027-03-01T00:00:00Z"));
    expect(s.avgReplyMicroUsd).toBe(credits(0.5));
    expect(s.estimatedReplies).toBe(500);
    expect(s.estimatedReplies).toBe(estimateRemainingReplies(credits(250), credits(0.5)));
  });

  it("falls back to the rate-card reply price when there is no history", async () => {
    prisma.creditDebit.aggregate.mockResolvedValue({ _avg: { amountMicroUsd: null } });
    const s = await creditSummary(starter, NOW);
    expect(s.avgReplyMicroUsd).toBeNull();
    expect(s.estimatedReplies).toBe(estimateRemainingReplies(credits(250), null));
  });

  it("only looks at unexpired grants, purchased ones with credits left, soonest-expiring first", async () => {
    await creditSummary(starter, NOW);
    const calls = prisma.creditGrant.findFirst.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual(
      expect.objectContaining({
        where: { orgId: "o1", kind: "included", expiresAt: { gt: NOW } },
        orderBy: { expiresAt: "desc" },
      })
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        where: { orgId: "o1", kind: "purchase", expiresAt: { gt: NOW }, remainingMicroUsd: { gt: 0 } },
        orderBy: { expiresAt: "asc" },
      })
    );
  });

  it("reports a legacy plan as unmetered without touching the ledger", async () => {
    const s = await creditSummary({ ...starter, plan: "front_desk" }, NOW);
    expect(s.metering).toEqual({ kind: "unmetered" });
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
    expect(prisma.creditDebit.aggregate).not.toHaveBeenCalled();
  });

  it("formatCredits shows one decimal in the Indian locale", () => {
    expect(formatCredits(credits(1_234.56))).toBe("1,234.6");
    expect(formatCredits(0)).toBe("0.0");
  });
});

describe("CreditBanner", () => {
  it("renders the exhausted message with a link to billing, no client JS", () => {
    const html = renderToStaticMarkup(h(CreditBanner));
    expect(html).toContain(CREDITS_EXHAUSTED_MESSAGE);
    expect(html).toContain('href="/settings/billing"');
    const source = readFileSync("src/components/features/credit-banner.tsx", "utf8");
    expect(source).not.toContain('"use client"');
  });
});

describe("billing page wiring", () => {
  const page = readFileSync("src/app/(app)/settings/billing/page.tsx", "utf8");

  it("shows the AI credits card, the estimate line and the banner", () => {
    expect(page).toContain("creditSummary(");
    expect(page).toContain("creditsExhausted(");
    expect(page).toContain("<CreditBanner");
    expect(page).toContain('label="AI credits"');
    expect(page).toContain("more AI replies");
    expect(page).toContain("unmetered");
    expect(page).toContain("test mode — usage is illustrative");
  });

  it("offers the three packs, 'Contact us' where a pack is not sold, and hides it for unmetered orgs", () => {
    expect(page).toContain("CREDIT_PACKS.map(");
    expect(page).toContain('kind="credits"');
    expect(page).toContain("packPrice(pack, currency)");
    expect(page).toContain("Contact us");
    // The top-up block sits inside the metered guard.
    const topUp = page.indexOf("CREDIT_PACKS.map(");
    const guard = page.lastIndexOf("{metered && (", topUp);
    expect(guard).toBeGreaterThan(-1);
    expect(page.slice(guard, topUp)).not.toContain("</div>\n      )}");
  });
});

describe("inbox page wiring", () => {
  it("renders the banner when credits are exhausted and keeps its data flow", () => {
    const page = readFileSync("src/app/(app)/inbox/page.tsx", "utf8");
    expect(page).toContain("creditsExhausted(org.id)");
    expect(page).toContain("<CreditBanner");
    expect(page).toContain("listConversationSummaries(");
  });
});
