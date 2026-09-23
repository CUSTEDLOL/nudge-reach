import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real-Postgres integration test for the active-rule cap. `createRuleAction`
 * used to `count()` active rules, compare to the limit, then create — a
 * check-then-act that two interleaved requests (a double-clicked Add button is
 * enough) both passed, leaving the org over its cap. A mocked Prisma cannot
 * prove that guard: the interleaving only exists in the database. This test
 * fires N real concurrent writes and asserts the active count never exceeds
 * the limit.
 *
 * Runs only when TEST_DATABASE_URL is set; otherwise the whole file is
 * skipped. The target must be a THROWAWAY database that already has the
 * schema — this test runs no migrations and never reads DATABASE_URL:
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nudge_test \
 *     -p 55433:5432 postgres:16-alpine
 *   DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npm run db:push
 *   TEST_DATABASE_URL=postgresql://… npx vitest run tests/rule-cap-concurrency.test.ts
 *
 * Never point TEST_DATABASE_URL at production or at the DATABASE_URL in
 * .env.local: the test writes rows, and deletes the orgs it created.
 */

const { db, ctx, recordAudit, revalidatePath, isRestrictedAcquisitionTrial, distillRule } =
  await vi.hoisted(async () => {
    const url = process.env.TEST_DATABASE_URL;
    const shared = {
      // `org.id` is filled in once the throwaway org exists.
      ctx: { org: { id: "" }, role: "OWNER" as const },
      recordAudit: vi.fn(),
      revalidatePath: vi.fn(),
      isRestrictedAcquisitionTrial: vi.fn(),
      distillRule: vi.fn(),
    };
    if (!url) return { db: undefined, ...shared };
    const { PrismaClient } = await import("@prisma/client");
    return {
      // No client-level `transactionOptions`. They used to be raised to
      // 20 s / 30 s here so this file would pass, which meant the test ran
      // looser than production did — the exact inversion a test is supposed to
      // prevent. `createRuleAction` now passes its own per-call options, which
      // take precedence over a client default anyway, so this client is
      // deliberately left on Prisma's defaults: what the test exercises is what
      // ships.
      db: new PrismaClient({ datasourceUrl: url }),
      ...shared,
    };
  });

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext: async () => ctx,
  requireRole: () => undefined,
}));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/agent/distill-rule", () => ({ distillRule }));

import { createRuleAction, restoreRuleAction } from "@/app/(app)/agent/rules-actions";
import { MAX_ACTIVE_RULES } from "@/modules/agent/rules";

const LIMIT = MAX_ACTIVE_RULES.full; // 20

describe.skipIf(!process.env.TEST_DATABASE_URL)("the active-rule cap on real Postgres", () => {
  // Only dereferenced inside this block, which is skipped when `db` is undefined.
  const prisma = db as PrismaClient;
  const run = `rule-cap-${Date.now()}`;
  const orgIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    isRestrictedAcquisitionTrial.mockResolvedValue(false);
    distillRule.mockImplementation(async (input: { text: string }) => ({
      instruction: input.text,
    }));
  });

  /** A throwaway org, remembered so afterAll can delete it (rules cascade). */
  async function seedOrg(label: string): Promise<string> {
    const org = await prisma.org.create({
      data: { name: `${run} ${label}`, ownerUserId: `${run}-${label}` },
    });
    orgIds.push(org.id);
    ctx.org.id = org.id;
    return org.id;
  }

  async function seedActiveRules(orgId: string, count: number) {
    if (count === 0) return;
    await prisma.agentRule.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        orgId,
        text: `always mention seeded rule ${i}`,
        instruction: `Always mention seeded rule ${i}.`,
        scope: "always",
        status: "active",
        source: "owner",
        order: i,
      })),
    });
  }

  const activeCount = (orgId: string) =>
    prisma.agentRule.count({ where: { orgId, status: "active" } });

  /** N concurrent creates, exactly what a double-clicked button produces. */
  const fireConcurrently = (n: number) =>
    Promise.all(
      Array.from({ length: n }, (_, i) =>
        createRuleAction(`always push people to the waitlist number ${i}`, "always")
      )
    );

  afterAll(async () => {
    if (!db) return;
    // Deleting the org cascades to its AgentRule rows (onDelete: Cascade).
    if (orgIds.length) await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.$disconnect();
  });

  it("lets exactly one of eight concurrent creates through the last free slot", async () => {
    const orgId = await seedOrg("last-slot");
    await seedActiveRules(orgId, LIMIT - 1);

    const results = await fireConcurrently(8);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await activeCount(orgId)).toBe(LIMIT);
    for (const refused of results.filter((r) => !r.ok)) {
      expect(refused.message).toBe(
        `You can have ${LIMIT} active rules at a time — the AI follows a short list far more reliably than a long one. Archive one to make room.`
      );
    }
  }, 120_000);

  it("never exceeds the cap when 25 creates race from an empty workspace", async () => {
    const orgId = await seedOrg("from-empty");

    const results = await fireConcurrently(25);

    expect(await activeCount(orgId)).toBe(LIMIT);
    expect(results.filter((r) => r.ok)).toHaveLength(LIMIT);
    expect(results.filter((r) => !r.ok)).toHaveLength(25 - LIMIT);
  }, 120_000);

  it("holds the trial's shorter cap under the same race", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    const orgId = await seedOrg("trial");

    await fireConcurrently(12);

    expect(await activeCount(orgId)).toBe(MAX_ACTIVE_RULES.trial);
  }, 120_000);

  /**
   * The lock, held past the waiter's whole transaction budget.
   *
   * Worth knowing, and only visible against a real database: Prisma's `timeout`
   * does not cancel a statement already blocked in Postgres. The waiter sits on
   * `pg_advisory_xact_lock` for as long as the holder holds it, and discovers
   * its transaction has expired on the NEXT statement — so `P2028` arrives once
   * the lock is finally granted, not on the stroke of the timeout. Which is why
   * the hold below runs on a timer rather than waiting for the action: waiting
   * for each other is a deadlock, and the first draft of this test hung.
   *
   * What the owner must get out of it is a true, readable sentence — not the
   * raw "Transaction API error: Transaction already closed", and emphatically
   * not the at-cap sentence, since this workspace has all 20 slots free.
   *
   * The holder needs a budget of its own: on Prisma's 5 s default it would
   * release the lock before the waiter's 10 s ran out and the create would
   * simply succeed.
   */
  it("answers a write that waits out the lock with a sentence, not a Prisma code", async () => {
    const orgId = await seedOrg("contended");
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });

    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`agentrule:${orgId}`}, 0))`;
        locked();
        // Comfortably past the 10 s the action allows itself.
        await new Promise((resolve) => setTimeout(resolve, 13_000));
      },
      { maxWait: 20_000, timeout: 60_000 }
    );
    await lockTaken;

    const result = await createRuleAction("always push people to the waitlist", "always");
    await holder;

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Your rules were being saved by someone else just then, so this one didn't go through. Try again in a moment."
    );
    expect(result.message).not.toContain("P2028");
    expect(result.message).not.toContain("active rules at a time");
    // The expired transaction wrote nothing on its way out.
    expect(await activeCount(orgId)).toBe(0);
  }, 120_000);

  /**
   * Restoring is the other write that moves the active count UP, so the cap has
   * to hold across it too — and across a restore racing an Add, which is the
   * only pair in the product that contends for slots from two different
   * buttons. `migrateProfileToRules` archives every legacy line past the cap,
   * so an org with a full list and a stack of archived rules is the ordinary
   * state here, not a contrived one.
   */
  describe("restoring an archived rule", () => {
    async function seedArchivedRules(orgId: string, count: number, from: number) {
      await prisma.agentRule.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          orgId,
          text: `never mention archived rule ${from + i}`,
          instruction: `Never mention archived rule ${from + i}.`,
          scope: "never",
          status: "archived",
          source: "migrated_donots",
          order: from + i,
        })),
      });
      return prisma.agentRule.findMany({
        where: { orgId, status: "archived" },
        select: { id: true },
      });
    }

    it("really flips the row, and the AI's own read then carries it", async () => {
      const orgId = await seedOrg("restore-flips");
      const [archived] = await seedArchivedRules(orgId, 1, 0);

      await expect(restoreRuleAction(archived.id)).resolves.toMatchObject({ ok: true });

      const row = await prisma.agentRule.findUnique({ where: { id: archived.id } });
      expect(row?.status).toBe("active");
      expect(await activeCount(orgId)).toBe(1);
    }, 120_000);

    it("refuses every concurrent restore once the list is already full", async () => {
      const orgId = await seedOrg("restore-full");
      await seedActiveRules(orgId, LIMIT);
      const archived = await seedArchivedRules(orgId, 6, LIMIT);

      const results = await Promise.all(
        archived.map((rule) => restoreRuleAction(rule.id))
      );

      expect(results.filter((r) => r.ok)).toHaveLength(0);
      expect(await activeCount(orgId)).toBe(LIMIT);
      for (const refused of results) {
        expect(refused.message).toBe(
          `You can have ${LIMIT} active rules at a time — the AI follows a short list far more reliably than a long one. Archive one to make room.`
        );
      }
    }, 120_000);

    it("lets exactly one of eight concurrent restores through the last free slot", async () => {
      const orgId = await seedOrg("restore-last-slot");
      await seedActiveRules(orgId, LIMIT - 1);
      const archived = await seedArchivedRules(orgId, 8, LIMIT);

      const results = await Promise.all(
        archived.map((rule) => restoreRuleAction(rule.id))
      );

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await activeCount(orgId)).toBe(LIMIT);
    }, 120_000);

    it("holds the cap when a restore and an Add race for the same last slot", async () => {
      const orgId = await seedOrg("restore-vs-create");
      await seedActiveRules(orgId, LIMIT - 1);
      const [archived] = await seedArchivedRules(orgId, 1, LIMIT);

      const results = await Promise.all([
        restoreRuleAction(archived.id),
        createRuleAction("always push people to the waitlist", "always"),
        restoreRuleAction(archived.id),
        createRuleAction("always send the booking link first", "always"),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await activeCount(orgId)).toBe(LIMIT);
    }, 120_000);

    it("holds the trial's shorter cap on restore too", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      const orgId = await seedOrg("restore-trial");
      await seedActiveRules(orgId, MAX_ACTIVE_RULES.trial);
      const archived = await seedArchivedRules(orgId, 4, MAX_ACTIVE_RULES.trial);

      await Promise.all(archived.map((rule) => restoreRuleAction(rule.id)));

      expect(await activeCount(orgId)).toBe(MAX_ACTIVE_RULES.trial);
    }, 120_000);
  });

  it("gives every created rule its own order, so none collide", async () => {
    const orgId = await seedOrg("ordering");

    await fireConcurrently(10);

    const rows = await prisma.agentRule.findMany({
      where: { orgId },
      select: { order: true },
    });
    expect(new Set(rows.map((r) => r.order)).size).toBe(rows.length);
  }, 120_000);
});
