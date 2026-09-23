import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real-Postgres integration test for concierge grounding. The unit tests for
 * this path run against an in-memory fake, and this repo has shipped bugs green
 * because Prisma was mocked — the claim that a second client setup creates
 * nothing rests on `storeKnowledgeFacts`'s dedupe and on the rule dedupe both
 * seeing real rows through real queries, which only a database can show.
 *
 * Runs only when TEST_DATABASE_URL is set; otherwise the whole file is
 * skipped. The target must be a THROWAWAY database that already has the
 * schema — this test runs no migrations and never reads DATABASE_URL:
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nudge_test \
 *     -p 55433:5432 postgres:16-alpine
 *   DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npm run db:push
 *   TEST_DATABASE_URL=postgresql://… npx vitest run tests/concierge-grounding-postgres.test.ts
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

import { installClientGrounding } from "@/modules/concierge";

const KB = {
  hours: "Mon–Sat 10am to 8pm\nClosed Sunday",
  location: "2nd floor, 14 MG Road, Bengaluru",
  services: "Hair transplant\nPRP therapy",
  prices: "Consult ₹500\nPRP from ₹8,000",
  policies: "Reschedule 24 hours ahead",
  faqs: "Walk-ins welcome before 6pm",
};
const DO_NOTS = "Do not quote surgery prices over chat\nNever promise a result";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "concierge grounding on real Postgres",
  () => {
    // Only dereferenced inside this block, which is skipped when `db` is undefined.
    const prisma = db as PrismaClient;
    const run = `concierge-${Date.now()}`;
    const orgIds: string[] = [];

    beforeEach(() => {
      vi.clearAllMocks();
      isRestrictedAcquisitionTrial.mockResolvedValue(false);
    });

    async function seedOrg(label: string): Promise<string> {
      const org = await prisma.org.create({
        data: { name: `${run} ${label}`, ownerUserId: `${run}-${label}` },
      });
      orgIds.push(org.id);
      return org.id;
    }

    afterAll(async () => {
      if (!db) return;
      // Deleting the org cascades to its KnowledgeEntry and AgentRule rows.
      if (orgIds.length) await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.$disconnect();
    });

    it("writes active facts under their own categories and active never rules", async () => {
      const orgId = await seedOrg("first-run");

      expect(await installClientGrounding(orgId, KB, DO_NOTS)).toEqual({
        facts: 9,
        rules: 2,
        rulesRejected: 0,
      });

      const facts = await prisma.knowledgeEntry.findMany({
        where: { orgId },
        select: { category: true, fact: true, status: true, source: true },
        orderBy: { createdAt: "asc" },
      });
      expect(facts).toHaveLength(9);
      expect(facts.every((f) => f.status === "active" && f.source === "concierge")).toBe(true);
      expect(facts.filter((f) => f.category === "pricing").map((f) => f.fact)).toEqual([
        "Consult ₹500",
        "PRP from ₹8,000",
      ]);
      expect(facts.some((f) => f.category === "other")).toBe(false);

      const rules = await prisma.agentRule.findMany({
        where: { orgId },
        select: { text: true, scope: true, status: true, source: true },
        orderBy: { order: "asc" },
      });
      expect(rules).toEqual([
        {
          text: "Do not quote surgery prices over chat",
          scope: "never",
          status: "active",
          source: "concierge",
        },
        { text: "Never promise a result", scope: "never", status: "active", source: "concierge" },
      ]);
    });

    it("creates nothing on a second run — setup is safe to re-run", async () => {
      const orgId = await seedOrg("second-run");
      await installClientGrounding(orgId, KB, DO_NOTS);

      expect(await installClientGrounding(orgId, KB, DO_NOTS)).toEqual({
        facts: 0,
        rules: 0,
        rulesRejected: 0,
      });

      expect(await prisma.knowledgeEntry.count({ where: { orgId } })).toBe(9);
      expect(await prisma.agentRule.count({ where: { orgId } })).toBe(2);
    });

    it("adds only what changed when the operator edits one field and re-runs", async () => {
      const orgId = await seedOrg("edited-run");
      await installClientGrounding(orgId, KB, DO_NOTS);

      const result = await installClientGrounding(
        orgId,
        { ...KB, prices: "Consult ₹500\nPRP from ₹8,000\nGraft ₹40 each" },
        `${DO_NOTS}\nDo not share another patient's photos`
      );

      expect(result).toEqual({ facts: 1, rules: 1, rulesRejected: 0 });
      expect(await prisma.knowledgeEntry.count({ where: { orgId } })).toBe(10);
      expect(await prisma.agentRule.count({ where: { orgId } })).toBe(3);
    });

    it("the go-live gate reads green off these rows, not off the legacy blob", async () => {
      const orgId = await seedOrg("gate");
      await installClientGrounding(orgId, KB, DO_NOTS);

      const [facts, rules] = await Promise.all([
        prisma.knowledgeEntry.count({ where: { orgId, status: "active" } }),
        prisma.agentRule.count({ where: { orgId, status: "active" } }),
      ]);
      expect(facts > 0 || rules > 0).toBe(true);
      // And nothing wrote the columns the gate used to read.
      expect(await prisma.agentProfile.findUnique({ where: { orgId } })).toBeNull();
    });
  }
);
