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
      db: new PrismaClient({
        datasourceUrl: url,
        // Every create is an interactive transaction that queues for the org's
        // advisory lock; Prisma's defaults (2 s / 5 s) are tight on a small pool.
        transactionOptions: { maxWait: 20_000, timeout: 30_000 },
      }),
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

import { createRuleAction } from "@/app/(app)/agent/rules-actions";
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
