import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, isRestrictedAcquisitionTrial } = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    agentProfile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    agentRule: { findMany: vi.fn(), createMany: vi.fn() },
    knowledgeEntry: { findMany: vi.fn(), createMany: vi.fn() },
  },
  isRestrictedAcquisitionTrial: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));

import {
  classifyLegacyLine,
  inferLegacyScope,
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

describe("legacy profile migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRestrictedAcquisitionTrial.mockResolvedValue(false);
    prisma.agentRule.findMany.mockResolvedValue([]);
    prisma.agentRule.createMany.mockImplementation(async ({ data }: { data: Row[] }) => ({
      count: data.length,
    }));
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    prisma.knowledgeEntry.createMany.mockImplementation(async ({ data }: { data: Row[] }) => ({
      count: data.length,
    }));
    prisma.$transaction.mockImplementation(async (work: (c: unknown) => unknown) => work(prisma));
    profile({});
  });

  describe("doNots", () => {
    it("makes one never rule per sentence", async () => {
      profile({
        doNots:
          "Never confirm a table without checking availability. Never discuss competitors.",
      });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 2, facts: 0 });

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

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 1, facts: 0 });

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

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 1, facts: 1 });

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

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 0, facts: 1 });

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
    prisma.agentRule.findMany.mockResolvedValue([
      { text: "Never discuss competitors.", source: "migrated_donots", status: "active", order: 0 },
    ]);
    profile({ doNots: "Never discuss competitors. Never quote a price.", businessInfo: FOUNDER_LINE });

    await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 0, facts: 0 });

    expect(prisma.agentRule.createMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    // The guard is the first read: an already-migrated org pays for nothing else.
    expect(prisma.agentProfile.findUnique).not.toHaveBeenCalled();
  });

  describe("the active cap", () => {
    it("stops at the limit and reports only what it created", async () => {
      // 19 of the 20 full-plan slots are already taken by the owner's own rules.
      prisma.agentRule.findMany.mockResolvedValue(
        Array.from({ length: 19 }, (_, i) => ({
          text: `Owner rule ${i}`,
          source: "owner",
          status: "active",
          order: i,
        }))
      );
      profile({ doNots: "Never do A. Never do B. Never do C." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 1, facts: 0 });

      const rows = created(prisma.agentRule.createMany);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ text: "Never do A.", order: 19 });
    });

    it("uses the shorter trial cap", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      profile({ doNots: "Never do A. Never do B. Never do C. Never do D. Never do E. Never do F." });

      await expect(migrateProfileToRules("org_1")).resolves.toEqual({ rules: 5, facts: 0 });
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
