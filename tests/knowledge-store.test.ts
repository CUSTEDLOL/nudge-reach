import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    knowledgeEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      knowledgeEntry: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { storeKnowledgeFacts } from "@/modules/knowledge/store";

const facts = [
  { category: "hours" as const, fact: "Open Monday to Friday" },
  { category: "pricing" as const, fact: "Consultations cost $40" },
  { category: "location" as const, fact: "We are at 12 Market Street" },
];

describe("storeKnowledgeFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (work) => work(tx));
    tx.$executeRaw.mockResolvedValue(1);
    tx.knowledgeEntry.count.mockResolvedValue(48);
    tx.knowledgeEntry.findMany.mockResolvedValue([]);
    tx.knowledgeEntry.createMany.mockResolvedValue({ count: 2 });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    prisma.knowledgeEntry.createMany.mockResolvedValue({ count: 0 });
  });

  it("locks one org and inserts only the remaining active-plus-draft capacity", async () => {
    await expect(
      storeKnowledgeFacts("org_1", facts, {
        source: "import",
        status: "draft",
        activeDraftCap: 50,
      }),
    ).resolves.toEqual({ created: 2, capacityReached: true });

    const [sqlParts, orgId] = tx.$executeRaw.mock.calls[0];
    expect((sqlParts as TemplateStringsArray).join("?")).toContain(
      "pg_advisory_xact_lock",
    );
    expect(orgId).toBe("org_1");
    expect(tx.knowledgeEntry.count).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: { in: ["active", "draft"] } },
    });
    expect(tx.knowledgeEntry.createMany).toHaveBeenCalledWith({
      data: facts.slice(0, 2).map((fact) => ({
        ...fact,
        condition: null,
        orgId: "org_1",
        source: "import",
        status: "draft",
      })),
    });
  });

  it("joins an existing transaction for an atomic capped write", async () => {
    await expect(
      storeKnowledgeFacts(
        "org_1",
        [facts[0]],
        {
          source: "manual",
          status: "active",
          activeDraftCap: 50,
        },
        tx as never,
      ),
    ).resolves.toEqual({ created: 2, capacityReached: true });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("dedupes normalized active and draft facts without treating duplicates as capacity", async () => {
    tx.knowledgeEntry.count.mockResolvedValue(1);
    tx.knowledgeEntry.findMany.mockResolvedValue([
      { fact: "  OPEN   MONDAY TO FRIDAY  " },
    ]);
    tx.knowledgeEntry.createMany.mockResolvedValue({ count: 1 });

    const result = await storeKnowledgeFacts(
      "org_1",
      [
        { category: "hours", fact: "open monday to friday" },
        { category: "pricing", fact: "Consultations cost $40" },
        { category: "pricing", fact: "  consultations   cost $40  " },
      ],
      {
        source: "import",
        status: "draft",
        activeDraftCap: 50,
      },
    );

    expect(result).toEqual({ created: 1, capacityReached: false });
    expect(tx.knowledgeEntry.findMany).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: { in: ["active", "draft"] } },
      select: { fact: true },
    });
    expect(tx.knowledgeEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          orgId: "org_1",
          category: "pricing",
          fact: "Consultations cost $40",
          condition: null,
          source: "import",
          status: "draft",
        },
      ],
    });
  });

  it("keeps uncapped paid storage outside a transaction, dedupes all statuses, and preserves its per-run limit", async () => {
    prisma.knowledgeEntry.findMany.mockResolvedValue([
      { fact: "open monday to friday" },
    ]);
    prisma.knowledgeEntry.createMany.mockResolvedValue({ count: 2 });

    await expect(
      storeKnowledgeFacts("org_paid", facts, {
        source: "import",
        status: "draft",
        maxCreated: 2,
      }),
    ).resolves.toEqual({ created: 2, capacityReached: false });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.knowledgeEntry.findMany).toHaveBeenCalledWith({
      where: { orgId: "org_paid" },
      select: { fact: true },
    });
    expect(prisma.knowledgeEntry.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("reports duplicate-only input separately from an exhausted cap", async () => {
    tx.knowledgeEntry.count.mockResolvedValue(1);
    tx.knowledgeEntry.findMany.mockResolvedValue([
      { fact: "Open Monday to Friday" },
    ]);

    await expect(
      storeKnowledgeFacts(
        "org_1",
        [{ category: "hours", fact: "  open   monday to friday " }],
        {
          source: "manual",
          status: "active",
          activeDraftCap: 50,
        },
      ),
    ).resolves.toEqual({ created: 0, capacityReached: false });

    expect(tx.knowledgeEntry.createMany).not.toHaveBeenCalled();

    tx.knowledgeEntry.count.mockResolvedValue(50);
    await expect(
      storeKnowledgeFacts("org_1", facts, {
        source: "manual",
        status: "active",
        activeDraftCap: 50,
      }),
    ).resolves.toEqual({ created: 0, capacityReached: true });
  });

  it.each([0, -1])("never inserts when maxCreated is %i", async (maxCreated) => {
    await expect(
      storeKnowledgeFacts("org_paid", facts, {
        source: "import",
        status: "draft",
        maxCreated,
      }),
    ).resolves.toEqual({ created: 0, capacityReached: false });

    expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
  });

  it.each([0, -1])(
    "treats a non-positive active-plus-draft cap of %i as exhausted",
    async (activeDraftCap) => {
      tx.knowledgeEntry.count.mockResolvedValue(0);

      await expect(
        storeKnowledgeFacts("org_trial", facts, {
          source: "import",
          status: "draft",
          activeDraftCap,
        }),
      ).resolves.toEqual({ created: 0, capacityReached: true });

      expect(tx.knowledgeEntry.createMany).not.toHaveBeenCalled();
    },
  );

  it("serializes concurrent writers competing for the final trial slot", async () => {
    let used = 49;
    let transactionTail = Promise.resolve();
    prisma.$transaction.mockImplementation((work) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      return previous.then(async () => {
        try {
          return await work(tx);
        } finally {
          release();
        }
      });
    });
    tx.knowledgeEntry.count.mockImplementation(async () => used);
    tx.knowledgeEntry.createMany.mockImplementation(async ({ data }) => {
      used += data.length;
      return { count: data.length };
    });

    const results = await Promise.all([
      storeKnowledgeFacts("org_trial", [facts[0]], {
        source: "manual",
        status: "active",
        activeDraftCap: 50,
      }),
      storeKnowledgeFacts("org_trial", [facts[1]], {
        source: "manual",
        status: "active",
        activeDraftCap: 50,
      }),
    ]);

    expect(results.map((result) => result.created).sort()).toEqual([0, 1]);
    expect(results.every((result) => result.capacityReached)).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.knowledgeEntry.createMany).toHaveBeenCalledOnce();
  });
});

/**
 * pg_advisory_xact_lock() returns void, and Prisma cannot deserialize a void
 * column: $queryRaw fails with "Failed to deserialize column of type 'void'"
 * against real Postgres. Every unit test here mocks the client, so no mock can
 * reproduce it — this shipped and broke website import for every trial, which
 * is the only path that takes this lock. The guard is therefore on the source.
 */
describe("advisory lock never goes through $queryRaw", () => {
  const source = readFileSync("src/modules/knowledge/store.ts", "utf8");

  it("executes the void-returning lock instead of querying it", () => {
    expect(source).toContain("$executeRaw`SELECT pg_advisory_xact_lock");
    // usage, not prose: the comment above the call names $queryRaw on purpose
    expect(source).not.toMatch(/\btx\.\$queryRaw/);
    expect(source).not.toMatch(/Pick<[\s\S]{0,120}?"\$queryRaw"/);
  });

  it("does not alias a void column, which cannot be read back", () => {
    expect(source).not.toMatch(/pg_advisory_xact_lock[^`]*AS\s+\w+/i);
  });
});
