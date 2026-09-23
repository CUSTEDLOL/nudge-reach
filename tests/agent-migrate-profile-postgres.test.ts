import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real-Postgres integration test for the legacy-profile migration.
 *
 * `migrateProfileToRules` used to read, decide and write with nothing
 * serialising it: two first loads of /agent for one org — two tabs, or two
 * lambda instances, since the in-process `attempted` memo is per-instance —
 * both saw an empty rule table, both planned the identical rows, and both
 * wrote them. Every rule duplicated, `order` colliding from 0, up to twice the
 * cap live. A mocked Prisma cannot show that: the interleaving only exists in
 * the database, and this repo has shipped two bugs green because Prisma was
 * mocked (a void-returning `pg_advisory_xact_lock` read through `$queryRaw`,
 * and an `updateMany` the mock did not define).
 *
 * Runs only when TEST_DATABASE_URL is set; otherwise the whole file is
 * skipped. The target must be a THROWAWAY database that already has the
 * schema — this test runs no migrations and never reads DATABASE_URL:
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nudge_test \
 *     -p 55434:5432 postgres:16-alpine
 *   DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npm run db:push
 *   TEST_DATABASE_URL=postgresql://… npx vitest run tests/agent-migrate-profile-postgres.test.ts
 *
 * Never point TEST_DATABASE_URL at production or at the DATABASE_URL in
 * .env.local: the test writes rows, and deletes the orgs it created.
 */

const { db, isRestrictedAcquisitionTrial } = await vi.hoisted(async () => {
  const shared = { isRestrictedAcquisitionTrial: vi.fn() };
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return { db: undefined, ...shared };
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: url }), ...shared };
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));

/**
 * The real store, with one switch to make its write throw. Only the failure is
 * injected — the rollback it triggers is a real Postgres rollback of real
 * rows, which is the whole point of testing this here.
 */
const failTheFactWrite = { on: false };
vi.mock("@/modules/knowledge/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/knowledge/store")>();
  return {
    ...actual,
    storeKnowledgeFacts: (...args: Parameters<typeof actual.storeKnowledgeFacts>) => {
      if (failTheFactWrite.on) throw new Error("the fact write blew up");
      return actual.storeKnowledgeFacts(...args);
    },
  };
});

import { migrateProfileToRules } from "@/modules/agent/migrate-profile";
import { MAX_ACTIVE_RULES } from "@/modules/agent/rules";
import { TRIAL_KNOWLEDGE_LIMITS } from "@/modules/trial/knowledge";

/** Three instructions and two facts, in the shape an owner actually types. */
const DO_NOTS = "Never quote a final price without a consultation. Never discuss competitors.";
const BUSINESS_INFO = [
  "We are open Mon-Sat 10-7.",
  "Always ask for the customer's city before quoting.",
  "Consultation costs ₹500, adjusted against the procedure.",
].join("\n");

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "the legacy profile migration on real Postgres",
  () => {
    // Only dereferenced inside this block, which is skipped when `db` is undefined.
    const prisma = db as PrismaClient;
    const run = `migrate-profile-${Date.now()}`;
    const orgIds: string[] = [];

    beforeEach(() => {
      vi.clearAllMocks();
      isRestrictedAcquisitionTrial.mockResolvedValue(false);
      failTheFactWrite.on = false;
    });

    /** A throwaway org with the two legacy boxes filled in. */
    async function seedOrg(
      label: string,
      boxes: { businessInfo?: string; doNots?: string } = {}
    ): Promise<string> {
      const org = await prisma.org.create({
        data: { name: `${run} ${label}`, ownerUserId: `${run}-${label}` },
      });
      orgIds.push(org.id);
      await prisma.agentProfile.create({
        data: {
          orgId: org.id,
          businessName: `${run} ${label}`,
          businessInfo: boxes.businessInfo ?? BUSINESS_INFO,
          doNots: boxes.doNots ?? DO_NOTS,
        },
      });
      return org.id;
    }

    afterAll(async () => {
      if (!db) return;
      // Deleting the org cascades to its AgentRule and KnowledgeEntry rows.
      if (orgIds.length) await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.$disconnect();
    });

    it("writes each legacy line exactly once when six loads race", async () => {
      const orgId = await seedOrg("concurrent");

      const results = await Promise.all(
        Array.from({ length: 6 }, () => migrateProfileToRules(orgId))
      );

      // Exactly one run did the work; the other five lost the guard re-read
      // inside the lock and wrote nothing.
      expect(results.filter((r) => r.rules > 0 || r.facts > 0)).toHaveLength(1);

      const rules = await prisma.agentRule.findMany({
        where: { orgId },
        select: { text: true, status: true, order: true },
        orderBy: { order: "asc" },
      });
      expect(rules.map((r) => r.text)).toEqual([
        "Never quote a final price without a consultation.",
        "Never discuss competitors.",
        "Always ask for the customer's city before quoting.",
      ]);
      expect(rules.every((r) => r.status === "active")).toBe(true);
      // `order` is a position, so a duplicated run would collide two rows on 0.
      expect(new Set(rules.map((r) => r.order)).size).toBe(rules.length);

      const facts = await prisma.knowledgeEntry.findMany({
        where: { orgId },
        select: { fact: true, status: true },
      });
      expect(facts.map((f) => f.fact).sort()).toEqual([
        "Consultation costs ₹500, adjusted against the procedure.",
        "We are open Mon-Sat 10-7.",
      ]);
      expect(facts.every((f) => f.status === "draft")).toBe(true);
    });

    it("never lets a race push an org past its active-rule cap", async () => {
      // 19 of the 20 full-plan slots taken, and three lines arriving: one can
      // go live, two must be archived — however many runs collide.
      const orgId = await seedOrg("cap", {
        businessInfo: "",
        doNots: "Never do A. Never do B. Never do C.",
      });
      await prisma.agentRule.createMany({
        data: Array.from({ length: MAX_ACTIVE_RULES.full - 1 }, (_, i) => ({
          orgId,
          text: `Always mention seeded rule ${i}`,
          instruction: `Always mention seeded rule ${i}.`,
          scope: "always",
          status: "active",
          source: "owner",
          order: i,
        })),
      });

      await Promise.all(Array.from({ length: 6 }, () => migrateProfileToRules(orgId)));

      expect(await prisma.agentRule.count({ where: { orgId, status: "active" } })).toBe(
        MAX_ACTIVE_RULES.full
      );
      expect(await prisma.agentRule.count({ where: { orgId, status: "archived" } })).toBe(2);
    });

    /**
     * The rule write and the fact write used to be two round-trips. If the
     * rules committed and the facts threw, the `migrated_` guard was set for
     * good — `migrateProfileOnce` swallowed the error, every later run returned
     * NOTHING, the fact-shaped lines were never written, and the founder panel
     * reported "Nothing to migrate — already done".
     */
    it("rolls the rules back when the fact write fails, and migrates cleanly on the retry", async () => {
      const orgId = await seedOrg("atomic");
      failTheFactWrite.on = true;

      await expect(migrateProfileToRules(orgId)).rejects.toThrow("the fact write blew up");

      // Nothing at all: no rules, so no `migrated_` guard row to poison the
      // next run either.
      expect(await prisma.agentRule.count({ where: { orgId } })).toBe(0);
      expect(await prisma.knowledgeEntry.count({ where: { orgId } })).toBe(0);

      failTheFactWrite.on = false;
      expect(await migrateProfileToRules(orgId)).toEqual({
        rules: 3,
        archived: 0,
        facts: 2,
        factsArchived: 0,
      });
      expect(await prisma.agentRule.count({ where: { orgId } })).toBe(3);
      expect(await prisma.knowledgeEntry.count({ where: { orgId } })).toBe(2);
    });

    /**
     * A trial workspace two facts short of its cap, migrating a six-line
     * fact-shaped blob. `selectNewFacts` used to truncate to what fit and
     * discard the rest with no signal at all, so this wrote 2, threw away 4,
     * and the founder panel read "2 draft facts awaiting review." An over-cap
     * RULE has been written `archived` since 4a69dae; an over-cap fact now is
     * too, and the count says so.
     */
    it("archives the fact lines past a trial's cap instead of dropping them", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      const lines = [
        "Consultation costs ₹500, adjusted against the procedure.",
        "We are at 2nd floor, Orchid Plaza, Koramangala.",
        "Parking is behind the building.",
        "The clinic has two surgeons and four consultants.",
        "50% advance is required for procedures.",
        "Grafts are charged at ₹40 each.",
      ];
      const orgId = await seedOrg("fact-cap", {
        businessInfo: lines.join("\n"),
        doNots: "Never discuss competitors.",
      });
      const free = 2;
      await prisma.knowledgeEntry.createMany({
        data: Array.from({ length: TRIAL_KNOWLEDGE_LIMITS.facts - free }, (_, i) => ({
          orgId,
          category: "other",
          fact: `Seeded fact ${i}`,
          source: "manual",
          status: "active",
        })),
      });

      expect(await migrateProfileToRules(orgId)).toEqual({
        rules: 1,
        archived: 0,
        facts: free,
        factsArchived: lines.length - free,
      });

      // The cap still holds — archived rows are not counted by it.
      expect(
        await prisma.knowledgeEntry.count({
          where: { orgId, status: { in: ["active", "draft"] } },
        })
      ).toBe(TRIAL_KNOWLEDGE_LIMITS.facts);
      // And not one line is lost: the two that fit are drafts, the four that
      // did not are archived, and together they are the owner's whole blob.
      const written = await prisma.knowledgeEntry.findMany({
        where: { orgId, source: "manual" },
        select: { fact: true, status: true },
        orderBy: { createdAt: "asc" },
      });
      expect(written.filter((f) => f.status === "draft").map((f) => f.fact)).toEqual(
        lines.slice(0, free)
      );
      expect(written.filter((f) => f.status === "archived").map((f) => f.fact).sort()).toEqual(
        lines.slice(free).sort()
      );
    });

    it("is still a no-op on a later run, once the lock is long gone", async () => {
      const orgId = await seedOrg("rerun");

      await migrateProfileToRules(orgId);
      expect(await migrateProfileToRules(orgId)).toEqual({
        rules: 0,
        archived: 0,
        facts: 0,
        factsArchived: 0,
      });

      expect(await prisma.agentRule.count({ where: { orgId } })).toBe(3);
      expect(await prisma.knowledgeEntry.count({ where: { orgId } })).toBe(2);
    });
  }
);
