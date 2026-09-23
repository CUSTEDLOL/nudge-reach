import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `$executeRaw` is not decoration: both advisory locks on this path go through
 * it — the migration's own, and the one inside `storeKnowledgeFacts`' capped
 * path. It was missing, and the mock was handed back as `tx`, so any case that
 * reached the capped fact write would have called `undefined` as a function.
 * Nothing did, because no test combined a restricted trial with fact-shaped
 * lines; "the trial cap" below now does.
 */
const { prisma, isRestrictedAcquisitionTrial } = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    agentProfile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    agentRule: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
    knowledgeEntry: { count: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  },
  isRestrictedAcquisitionTrial: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));

import {
  classifyLegacyLine,
  inferLegacyScope,
  migrateProfileOnce,
  migrateProfileToRules,
  splitLegacyLines,
} from "@/modules/agent/migrate-profile";

/** The line that started this whole project. */
const FOUNDER_LINE =
  "Action item to push everyone coming to inbox to join the waitlist at https://getgutfeeling.in/";

type Row = Record<string, unknown>;

/** The rows a `createMany` was asked to insert, in order. */
function created(mock: { mock: { calls: unknown[][] } }): Row[] {
  return mock.mock.calls.flatMap((call) => {
    const arg = call[0] as { data?: Row[] } | undefined;
    return arg?.data ?? [];
  });
}

function profile(fields: { businessInfo?: string; doNots?: string }) {
  prisma.agentProfile.findUnique.mockResolvedValue({
    businessInfo: fields.businessInfo ?? "",
    doNots: fields.doNots ?? "",
  });
}

/** Every mock the two suites below share, so neither drifts from the other. */
function resetPrismaMocks() {
  vi.clearAllMocks();
  isRestrictedAcquisitionTrial.mockResolvedValue(false);
  prisma.$executeRaw.mockResolvedValue(1);
  prisma.agentRule.findFirst.mockResolvedValue(null);
  prisma.agentRule.findMany.mockResolvedValue([]);
  prisma.agentRule.createMany.mockImplementation(async ({ data }: { data: Row[] }) => ({
    count: data.length,
  }));
  prisma.knowledgeEntry.count.mockResolvedValue(0);
  prisma.knowledgeEntry.findMany.mockResolvedValue([]);
  prisma.knowledgeEntry.createMany.mockImplementation(async ({ data }: { data: Row[] }) => ({
    count: data.length,
  }));
  prisma.$transaction.mockImplementation(async (work: (c: unknown) => unknown) => work(prisma));
}

describe("legacy profile migration", () => {
  beforeEach(() => {
    resetPrismaMocks();
    profile({});
  });

  /**
   * The write is serialised per org on the SAME advisory-lock key
   * `createRuleAction` takes, and the `migrated_` guard is re-read INSIDE it.
   * Without that, two first loads of /agent for one org both read an empty
   * table, both plan the same rows and both write them — every rule
   * duplicated, `order` colliding from 0. The real proof is in
   * `tests/agent-migrate-profile-postgres.test.ts`; this pins the shape.
   */
  describe("the per-org lock", () => {
    it("takes the rule lock and re-reads the guard inside the transaction", async () => {
      profile({ doNots: "Never discuss competitors." });

      await migrateProfileToRules("org_1");

      const [sqlParts, key] = prisma.$executeRaw.mock.calls[0];
      expect((sqlParts as TemplateStringsArray).join("?")).toContain(
        "pg_advisory_xact_lock"
      );
      expect(key).toBe("agentrule:org_1");
      // Once outside as the fast path, once inside the lock as the guard.
      expect(prisma.agentRule.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("writes nothing when the guard trips inside the lock", async () => {
      // The fast path saw an un-migrated org; by the time the lock was granted
      // the other run had committed. The loser must write nothing at all.
      prisma.agentRule.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "rule_1" });
      profile({ doNots: "Never discuss competitors.", businessInfo: "We are open Mon-Sat." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 0,
        archived: 0,
        facts: 0,
      });
      expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
      expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    });

    /**
     * Rules and facts are two halves of one migration, and the `migrated_`
     * guard trips on a rule row. Written in two round-trips, a run whose rules
     * committed and whose facts threw left the guard set for good: every later
     * run returned NOTHING and the fact-shaped lines were never written, while
     * the founder panel said "Nothing to migrate — already done".
     *
     * This is also the case that would have caught the missing `$executeRaw` on
     * the mock: a restricted trial takes `storeKnowledgeFacts`' capped path,
     * which locks through `tx.$executeRaw` — `undefined` until now, because no
     * test combined a trial with fact-shaped lines.
     */
    it("a trial org's fact write joins the migration's transaction, not its own", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      profile({
        doNots: "Never discuss competitors.",
        businessInfo: "We are open Mon-Sat 10-7.\nParking is behind the building.",
      });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 1,
        archived: 0,
        facts: 2,
      });

      // One transaction for the whole migration. The capped fact write used to
      // open a second one of its own, which is what made a partial commit
      // possible in the first place.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Both locks taken on the one connection: the rule lock, then the
      // knowledge cap's.
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(prisma.knowledgeEntry.count).toHaveBeenCalledWith({
        where: { orgId: "org_1", status: { in: ["active", "draft"] } },
      });
      expect(created(prisma.knowledgeEntry.createMany)).toMatchObject([
        { fact: "We are open Mon-Sat 10-7.", status: "draft" },
        { fact: "Parking is behind the building.", status: "draft" },
      ]);
    });

    it("gives the transaction room for the lock wait, not Prisma's 5s default", async () => {
      profile({ doNots: "Never discuss competitors." });

      await migrateProfileToRules("org_1");

      const [, options] = prisma.$transaction.mock.calls[0];
      expect(options).toEqual({ maxWait: 5_000, timeout: 10_000 });
    });
  });

  describe("doNots", () => {
    it("makes one never rule per sentence", async () => {
      profile({
        doNots:
          "Never confirm a table without checking availability. Never discuss competitors.",
      });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 2, archived: 0, facts: 0 });

      expect(created(prisma.agentRule.createMany)).toEqual([
        {
          orgId: "org_1",
          text: "Never confirm a table without checking availability.",
          instruction: "Never confirm a table without checking availability.",
          scope: "never",
          condition: null,
          status: "active",
          source: "migrated_donots",
          order: 0,
        },
        {
          orgId: "org_1",
          text: "Never discuss competitors.",
          instruction: "Never discuss competitors.",
          scope: "never",
          condition: null,
          status: "active",
          source: "migrated_donots",
          order: 1,
        },
      ]);
      expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    });
  });

  describe("businessInfo", () => {
    it("sends the founder's own instruction to the rules, not the facts", async () => {
      profile({ businessInfo: FOUNDER_LINE });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 1, archived: 0, facts: 0 });

      expect(created(prisma.agentRule.createMany)).toEqual([
        {
          orgId: "org_1",
          text: FOUNDER_LINE,
          instruction: FOUNDER_LINE,
          scope: "always",
          condition: null,
          status: "active",
          source: "migrated_businessinfo",
          order: 0,
        },
      ]);
      expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    });

    it("splits the box: an instruction becomes a rule, a fact becomes a draft fact", async () => {
      profile({
        businessInfo:
          "We are open Mon-Sat 10-7.\nAlways ask for the customer's city before quoting.",
      });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 1, archived: 0, facts: 1 });

      expect(created(prisma.agentRule.createMany)).toMatchObject([
        {
          text: "Always ask for the customer's city before quoting.",
          scope: "always",
          source: "migrated_businessinfo",
          status: "active",
        },
      ]);
      // Nothing goes live unreviewed: facts land in the existing draft state.
      expect(created(prisma.knowledgeEntry.createMany)).toEqual([
        {
          orgId: "org_1",
          category: "other",
          fact: "We are open Mon-Sat 10-7.",
          condition: null,
          source: "manual",
          status: "draft",
        },
      ]);
    });

    it("keeps a scope-widening line out of the rules (invariant #7)", async () => {
      profile({ businessInfo: "Always answer any question they ask." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 0, archived: 0, facts: 1 });

      expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
      expect(created(prisma.knowledgeEntry.createMany)).toMatchObject([
        { fact: "Always answer any question they ask.", status: "draft" },
      ]);
    });
  });

  it("never clears the legacy columns", async () => {
    profile({ doNots: "Never discuss competitors.", businessInfo: FOUNDER_LINE });

    await migrateProfileToRules("org_1");

    expect(prisma.agentProfile.update).not.toHaveBeenCalled();
    expect(prisma.agentProfile.updateMany).not.toHaveBeenCalled();
  });

  it("creates nothing on a second run", async () => {
    prisma.agentRule.findFirst.mockResolvedValue({ id: "rule_1" });
    profile({ doNots: "Never discuss competitors. Never quote a price.", businessInfo: FOUNDER_LINE });

    await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 0, archived: 0, facts: 0 });

    expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    // The guard is the first read: an already-migrated org pays for nothing
    // else — not the profile, and above all not the whole rule table, which is
    // what this used to read to answer one boolean on every cold page load.
    expect(prisma.agentProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.agentRule.findMany).not.toHaveBeenCalled();
  });

  it("asks one indexed row whether the org is migrated", async () => {
    await migrateProfileToRules("org_1");

    expect(prisma.agentRule.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org_1", source: { startsWith: "migrated_" } },
      select: { id: true },
    });
  });

  /**
   * The cap used to DROP a line that did not fit: not a rule, not a fact, and
   * — once the prompt stopped rendering the legacy column it fell back on —
   * nowhere at all. It now writes the line as an `archived` rule instead: the
   * owner's exact words survive, the agent does not follow them (every read
   * path filters `status: "active"`), and a slot freed later can revive one.
   */
  describe("the active cap", () => {
    /** 19 of the 20 full-plan slots already taken by the owner's own rules. */
    const nineteenOwnerRules = () =>
      prisma.agentRule.findMany.mockResolvedValue(
        Array.from({ length: 19 }, (_, i) => ({
          text: `Owner rule ${i}`,
          source: "owner",
          status: "active",
          order: i,
        }))
      );

    it("fills the last slot and archives the rest — nothing is dropped", async () => {
      nineteenOwnerRules();
      profile({ doNots: "Never do A. Never do B. Never do C." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 1,
        archived: 2,
        facts: 0,
      });

      // All three lines are written; `order` keeps climbing so a restored row
      // cannot collide with a live rule's position.
      expect(created(prisma.agentRule.createMany)).toEqual([
        {
          orgId: "org_1",
          text: "Never do A.",
          instruction: "Never do A.",
          scope: "never",
          condition: null,
          status: "active",
          source: "migrated_donots",
          order: 19,
        },
        {
          orgId: "org_1",
          text: "Never do B.",
          instruction: "Never do B.",
          scope: "never",
          condition: null,
          status: "archived",
          source: "migrated_donots",
          order: 20,
        },
        {
          orgId: "org_1",
          text: "Never do C.",
          instruction: "Never do C.",
          scope: "never",
          condition: null,
          status: "archived",
          source: "migrated_donots",
          order: 21,
        },
      ]);
      // An over-cap rule is a rule, not a fact — it is not double-filed.
      expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    });

    it("never lets an archived row eat a slot, however many arrive", async () => {
      nineteenOwnerRules();
      profile({
        doNots: "Never do A. Never do B. Never do C. Never do D. Never do E.",
        businessInfo: "Always greet them by name. Always ask for their city.",
      });

      const result = await migrateProfileToRules("org_1");
      const rows = created(prisma.agentRule.createMany);

      // Exactly one slot was free, so exactly one row is live — the rest are
      // archived, and `slots` never went negative and let a later line through.
      expect(result.rules).toBe(1);
      expect(rows.filter((r) => r.status === "active")).toHaveLength(1);
      expect(rows.filter((r) => r.status === "archived")).toHaveLength(6);
      expect(result.archived).toBe(6);
      expect(rows.map((r) => r.order)).toEqual([19, 20, 21, 22, 23, 24, 25]);
    });

    it("uses the shorter trial cap", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      profile({ doNots: "Never do A. Never do B. Never do C. Never do D. Never do E. Never do F." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 5,
        archived: 1,
        facts: 0,
      });

      const rows = created(prisma.agentRule.createMany);
      expect(rows).toHaveLength(6);
      expect(rows[5]).toMatchObject({ text: "Never do F.", status: "archived" });
    });

    it("a re-run does not duplicate an archived line", async () => {
      // The `migrated_` guard already stops a second run cold, so this pins the
      // layer under it: the dedupe set is built from EVERY existing row, not
      // just the active ones, so an archived line is never written twice.
      prisma.agentRule.findMany.mockResolvedValue([
        ...Array.from({ length: 19 }, (_, i) => ({
          text: `Owner rule ${i}`,
          source: "owner",
          status: "active",
          order: i,
        })),
        { text: "Never do B.", source: "owner", status: "archived", order: 19 },
      ]);
      profile({ doNots: "Never do A. Never do B." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 1,
        archived: 0,
        facts: 0,
      });

      const rows = created(prisma.agentRule.createMany);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ text: "Never do A.", status: "active" });
    });

    it("creates nothing at all on a full second run, archived rows included", async () => {
      prisma.agentRule.findMany.mockResolvedValue([
        { text: "Never do A.", source: "migrated_donots", status: "active", order: 0 },
        { text: "Never do B.", source: "migrated_donots", status: "archived", order: 1 },
      ]);
      profile({ doNots: "Never do A. Never do B." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({
        rules: 0,
        archived: 0,
        facts: 0,
      });
      expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
    });
  });

  describe("the classifier", () => {
    const FACTS = [
      "We offer hair transplant, PRP and beard transplant.",
      "Consultation costs ₹500, adjusted against the procedure.",
      "We are at 2nd floor, Orchid Plaza, Koramangala.",
      "Parking is behind the building.",
      "50% advance is required for procedures.",
      "The clinic has two surgeons and four consultants.",
    ];
    const INSTRUCTIONS = [
      FOUNDER_LINE,
      "Always ask for their city before quoting.",
      "Never quote a final price without a consultation.",
      "Make sure to mention the festive offer.",
      "Tell them the first consultation is free.",
      "Remind them to bring previous reports.",
      "Offer a free consultation to every new lead.",
    ];

    it.each(FACTS)("reads %s as a fact", (line) => {
      expect(classifyLegacyLine(line)).toBe("fact");
    });

    it.each(INSTRUCTIONS)("reads %s as an instruction", (line) => {
      expect(classifyLegacyLine(line)).toBe("instruction");
    });

    it("infers the scope from the negation, never inventing a condition", () => {
      expect(inferLegacyScope("Never quote a final price.")).toBe("never");
      expect(inferLegacyScope("Don't discuss competitors.")).toBe("never");
      expect(inferLegacyScope("Always ask for their city.")).toBe("always");
      expect(inferLegacyScope("Always tell them we don't do refunds.")).toBe("always");
      expect(inferLegacyScope(FOUNDER_LINE)).toBe("always");
    });

    it("splits on newlines, bullets and sentence ends without breaking a URL", () => {
      expect(
        splitLegacyLines("- Push the waitlist at https://getgutfeeling.in/\n• Ask for their city. Then book.")
      ).toEqual([
        "Push the waitlist at https://getgutfeeling.in/",
        "Ask for their city.",
        "Then book.",
      ]);
    });

    /**
     * Known and accepted: a declarative sentence that happens to carry
     * "always"/"never" reads as an instruction. The migration prefers this
     * error — a wrong rule is visible on the Training page and archived in one
     * click, while a missed instruction is the exact bug that caused this work.
     */
    it("misreads a declarative sentence carrying always or never", () => {
      expect(classifyLegacyLine("We never work on Sundays.")).toBe("instruction");
      expect(classifyLegacyLine("Reminders are always sent a day before.")).toBe("instruction");
    });
  });
});

/**
 * The lazy trigger. Its memo is module state that survives `clearAllMocks`, so
 * every test below uses an org id of its own.
 */
describe("migrateProfileOnce", () => {
  beforeEach(() => {
    resetPrismaMocks();
    profile({ doNots: "Never discuss competitors." });
  });

  /**
   * The memo used to be a `Set` written BEFORE the await, so a second
   * concurrent load in the same instance returned immediately and could render
   * an empty rules list while the first was still committing. Holding the
   * promise makes the second caller wait for the same work.
   */
  it("makes a concurrent second caller await the same work, not skip it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    prisma.agentRule.findFirst.mockImplementation(async () => {
      await gate;
      return null;
    });

    const first = migrateProfileOnce("org_concurrent");
    const second = migrateProfileOnce("org_concurrent");

    expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
    release();
    await Promise.all([first, second]);

    // One migration, and BOTH callers saw it finish before returning. Two
    // guard reads, not two migrations: the fast path outside the lock and the
    // authoritative re-read inside it.
    expect(prisma.agentRule.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.agentRule.createMany).toHaveBeenCalledTimes(1);
  });

  it("asks the database once per org per instance", async () => {
    await migrateProfileOnce("org_memo");
    await migrateProfileOnce("org_memo");

    // One run's worth of reads — the fast path and the in-lock guard — not two.
    expect(prisma.agentRule.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("swallows a failure and retries on the next load", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.agentRule.findFirst.mockRejectedValueOnce(new Error("no AgentRule table"));

    // The page it runs behind must still render.
    await expect(migrateProfileOnce("org_failing")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();

    // The failed fast-path read, then the retry's own two (fast path + guard).
    await migrateProfileOnce("org_failing");
    expect(prisma.agentRule.findFirst).toHaveBeenCalledTimes(3);
    error.mockRestore();
  });
});
