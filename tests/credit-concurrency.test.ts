import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Real-Postgres integration test for the credit ledger's debit path
 * (docs/superpowers/plans/2026-09-15-credit-ledger.md, Task 9): concurrent
 * debits serialise under `SELECT … FOR UPDATE`, the unique aiUsageId makes a
 * re-debit a no-op, and grants are spent soonest-expiring first.
 *
 * Runs only when TEST_DATABASE_URL is set; otherwise the whole file is
 * skipped. The target must be a THROWAWAY database that already has the
 * schema — this test runs no migrations and never reads DATABASE_URL:
 *
 *   DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npm run db:push
 *   TEST_DATABASE_URL=postgresql://… npx vitest run tests/credit-concurrency.test.ts
 *
 * Never point TEST_DATABASE_URL at production or at the DATABASE_URL in
 * .env.local: the test writes rows and deletes the orgs it created.
 */

const { db } = await vi.hoisted(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return { db: undefined };
  const { PrismaClient } = await import("@prisma/client");
  return {
    db: new PrismaClient({
      datasourceUrl: url,
      // 20 interactive transactions queue first for a pool connection, then
      // for the row lock; Prisma's defaults (2 s / 5 s) are tight on a small pool.
      transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    }),
  };
});
// The module under test reads `prisma` from @/lib/db; point it at the test
// client. The app's default client (DATABASE_URL) is never constructed.
vi.mock("@/lib/db", () => ({ prisma: db }));

import { priceCall } from "@/modules/billing/credit-rates";
import { type Allocation, debitAiUsage, MICRO_USD_PER_CREDIT } from "@/modules/billing/credits";

const CREDIT = MICRO_USD_PER_CREDIT; // 5,000 micro-USD
// Haiku input is 1,000,000 micro-USD per MTok, so 1 input token = 1 micro-USD
// and `credits × 5,000` input tokens price to exactly `credits` credits.
const MODEL = "claude-haiku-4-5";
const usageOf = (credits: number) => ({ inputTokens: credits * CREDIT, outputTokens: 0 });

describe.skipIf(!process.env.TEST_DATABASE_URL)("credit ledger debits on real Postgres", () => {
  // Only dereferenced inside this block, which is skipped when `db` is undefined.
  const prisma = db as PrismaClient;
  const run = `credit-concurrency-${Date.now()}`;
  const orgIds: string[] = [];
  const inAnHour = new Date(Date.now() + 60 * 60 * 1000);

  async function seedOrg(label: string): Promise<string> {
    const org = await prisma.org.create({
      data: { name: `${run} ${label}`, ownerUserId: `${run}-${label}` },
    });
    orgIds.push(org.id);
    return org.id;
  }

  async function seedGrant(orgId: string, credits: number, expiresAt: Date, sourceKey: string) {
    const micro = credits * CREDIT;
    return prisma.creditGrant.create({
      data: { orgId, kind: "founder", sourceKey, amountMicroUsd: micro, remainingMicroUsd: micro, expiresAt },
    });
  }

  /** Platform, non-synthetic usage rows: the anchors every metered debit needs. */
  async function seedUsage(orgId: string, count: number): Promise<string[]> {
    const rows = await prisma.aiUsage.createManyAndReturn({
      data: Array.from({ length: count }, () => ({
        orgId,
        purpose: "agent_reply",
        model: MODEL,
        inputTokens: CREDIT,
        outputTokens: 0,
        costMicroUsd: CREDIT,
      })),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const debit = (orgId: string, aiUsageId: string, credits: number) =>
    debitAiUsage({
      orgId,
      aiUsageId,
      purpose: "agent_reply",
      model: MODEL,
      usage: usageOf(credits),
      simulated: false,
      absorbed: false,
    });

  /** The reconciliation identity: issued − metered debits === remaining, per org. */
  async function ledger(orgId: string) {
    const grants = await prisma.creditGrant.aggregate({
      _sum: { amountMicroUsd: true, remainingMicroUsd: true },
      where: { orgId },
    });
    const debits = await prisma.creditDebit.aggregate({
      _sum: { amountMicroUsd: true },
      where: { orgId, simulated: false, absorbed: false },
    });
    const l = {
      issued: grants._sum.amountMicroUsd ?? 0,
      remaining: grants._sum.remainingMicroUsd ?? 0,
      debited: debits._sum.amountMicroUsd ?? 0,
    };
    expect(l.issued - l.debited).toBe(l.remaining);
    return l;
  }

  let orgA: string;
  let grantA: string;
  let usageA: string[];

  beforeAll(async () => {
    orgA = await seedOrg("a");
    grantA = (await seedGrant(orgA, 10, inAnHour, "ten")).id;
    usageA = await seedUsage(orgA, 20);
  });

  afterAll(async () => {
    // Every CreditGrant, CreditDebit and AiUsage row cascades from its Org.
    await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.$disconnect();
  });

  it("20 concurrent 1-credit debits serialise under FOR UPDATE", async () => {
    expect(priceCall(MODEL, usageOf(1))).toBe(CREDIT);

    await Promise.all(usageA.map((id) => debit(orgA, id, 1)));

    // 10 credits covered, 10 overdrawn onto the same grant (plan decision 6).
    const grant = await prisma.creditGrant.findUniqueOrThrow({ where: { id: grantA } });
    expect(grant.remainingMicroUsd).toBe(-50_000);

    const debits = await prisma.creditDebit.findMany({ where: { orgId: orgA } });
    expect(debits).toHaveLength(20);
    // Each transaction re-read the decremented row after the lock released:
    // exactly the first 10 found credit to allocate, the rest were pure overdraft.
    const allocated = debits.filter((d) => (d.allocations as Allocation[]).length > 0);
    expect(allocated).toHaveLength(10);
    for (const d of allocated) {
      expect(d.allocations).toEqual([{ grantId: grantA, microUsd: CREDIT }]);
    }

    expect(await ledger(orgA)).toEqual({ issued: 50_000, debited: 100_000, remaining: -50_000 });
  });

  it("re-debiting the same 20 AiUsage ids changes nothing", async () => {
    await Promise.all(usageA.map((id) => debit(orgA, id, 1)));

    const grant = await prisma.creditGrant.findUniqueOrThrow({ where: { id: grantA } });
    expect(grant.remainingMicroUsd).toBe(-50_000);
    expect(await prisma.creditDebit.count({ where: { orgId: orgA } })).toBe(20);
    expect(await ledger(orgA)).toEqual({ issued: 50_000, debited: 100_000, remaining: -50_000 });
  });

  it("FIFO by expiry across two grants", async () => {
    // A fresh org: orgA's only grant is already overdrawn, so a remainder
    // there would be an overdraft (never stored in allocations), not a
    // second allocation. The later-expiring grant is issued FIRST so the
    // order below can only come from expiresAt, not from insertion order.
    const orgB = await seedOrg("b");
    const later = await seedGrant(orgB, 10, inAnHour, "later");
    const sooner = await seedGrant(orgB, 3, new Date(Date.now() + 30 * 60 * 1000), "sooner");
    const [usageId] = await seedUsage(orgB, 1);

    await debit(orgB, usageId, 5);

    const grants = await prisma.creditGrant.findMany({ where: { orgId: orgB } });
    expect(grants.find((g) => g.id === sooner.id)?.remainingMicroUsd).toBe(0);
    expect(grants.find((g) => g.id === later.id)?.remainingMicroUsd).toBe(8 * CREDIT);

    const row = await prisma.creditDebit.findUniqueOrThrow({ where: { aiUsageId: usageId } });
    expect(row.amountMicroUsd).toBe(5 * CREDIT);
    expect(row.allocations).toEqual([
      { grantId: sooner.id, microUsd: 3 * CREDIT },
      { grantId: later.id, microUsd: 2 * CREDIT },
    ]);

    expect(await ledger(orgB)).toEqual({ issued: 65_000, debited: 25_000, remaining: 40_000 });
  });
});
