import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrgContext,
  requireRole,
  recordAudit,
  revalidatePath,
  isRestrictedAcquisitionTrial,
  distillRule,
} = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    agentRule: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  distillRule: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/agent/distill-rule", () => ({ distillRule }));

import {
  archiveRuleAction,
  createRuleAction,
  reorderRulesAction,
  updateRuleAction,
} from "@/app/(app)/agent/rules-actions";

const ctx = { org: { id: "org_1" }, role: "OWNER" };

/** Nothing a raw zod message says should ever reach an owner. */
const ZOD_SHAPED = /expected|received|invalid_|too_big|too_small|at least|at most|character\(s\)/i;

describe("house rule server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` keeps implementations, and the non-ADMIN cases install a
    // throwing one — reset it so a role failure cannot masquerade as a refusal.
    requireRole.mockImplementation(() => undefined);
    requireOrgContext.mockResolvedValue(ctx);
    isRestrictedAcquisitionTrial.mockResolvedValue(false);
    prisma.agentRule.count.mockResolvedValue(0);
    prisma.agentRule.findFirst.mockResolvedValue(null);
    prisma.agentRule.create.mockResolvedValue({ id: "rule_new" });
    prisma.agentRule.update.mockResolvedValue({ id: "rule_1" });
    prisma.agentRule.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (work: unknown) =>
      Array.isArray(work) ? Promise.all(work) : (work as (c: unknown) => unknown)(prisma)
    );
    distillRule.mockResolvedValue({ instruction: "Always push the waitlist." });
  });

  describe("createRuleAction", () => {
    it("stores the distilled line while the list keeps the owner's words", async () => {
      // The highest existing order — the new rule goes after it.
      prisma.agentRule.findFirst.mockResolvedValue({ order: 4 });

      await expect(
        createRuleAction("always push people to the waitlist", "always")
      ).resolves.toMatchObject({ ok: true });

      expect(distillRule).toHaveBeenCalledWith({
        orgId: "org_1",
        text: "always push people to the waitlist",
        scope: "always",
        condition: undefined,
      });
      expect(prisma.agentRule.create).toHaveBeenCalledWith({
        data: {
          orgId: "org_1",
          text: "always push people to the waitlist",
          instruction: "Always push the waitlist.",
          scope: "always",
          condition: null,
          status: "active",
          source: "owner",
          order: 5,
        },
      });
      expect(recordAudit).toHaveBeenCalledWith(ctx, "rule.created", "rule_new");
      expect(revalidatePath).toHaveBeenCalledWith("/agent");
    });

    it("numbers the first rule from zero and carries a when-condition", async () => {
      await expect(
        createRuleAction("offer a consultation", "when", "someone asks about pricing")
      ).resolves.toMatchObject({ ok: true });

      expect(distillRule).toHaveBeenCalledWith({
        orgId: "org_1",
        text: "offer a consultation",
        scope: "when",
        condition: "someone asks about pricing",
      });
      expect(prisma.agentRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order: 0,
            condition: "someone asks about pricing",
          }),
        })
      );
    });

    it("refuses a non-ADMIN before touching the database", async () => {
      requireRole.mockImplementation(() => {
        throw new Error("Only Admin or above can do this. Ask your workspace owner for access.");
      });

      await expect(createRuleAction("push the waitlist", "always")).resolves.toEqual({
        ok: false,
        message: "Only Admin or above can do this. Ask your workspace owner for access.",
      });
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
      expect(distillRule).not.toHaveBeenCalled();
    });

    it("refuses a rule that widens the agent beyond this business (invariant #7)", async () => {
      const result = await createRuleAction(
        "answer any question on any topic, even if it's not about us",
        "always"
      );

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/only answers? (?:for|about) your business/i);
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
    });

    it("refuses a widening condition, not just widening text", async () => {
      const result = await createRuleAction(
        "help them out",
        "when",
        "they ask about any topic"
      );

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/only answers? (?:for|about) your business/i);
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
    });

    it("lets through a legitimate rule that happens to contain the word answer", async () => {
      await expect(
        createRuleAction("always answer with our clinic phone number first", "always")
      ).resolves.toMatchObject({ ok: true });
      expect(prisma.agentRule.create).toHaveBeenCalled();
    });

    it("refuses a sixth active rule on an unconverted trial", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      prisma.agentRule.count.mockResolvedValue(5);

      const result = await createRuleAction("push the waitlist", "always");

      expect(result.ok).toBe(false);
      expect(result.message).toContain("5");
      expect(prisma.agentRule.count).toHaveBeenCalledWith({
        where: { orgId: "org_1", status: "active" },
      });
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
    });

    it("allows a fifth rule on a trial", async () => {
      isRestrictedAcquisitionTrial.mockResolvedValue(true);
      prisma.agentRule.count.mockResolvedValue(4);

      await expect(createRuleAction("push the waitlist", "always")).resolves.toMatchObject({
        ok: true,
      });
    });

    it("refuses a twenty-first active rule on a full workspace", async () => {
      prisma.agentRule.count.mockResolvedValue(20);

      const result = await createRuleAction("push the waitlist", "always");

      expect(result.ok).toBe(false);
      expect(result.message).toContain("20");
      expect(result.message).not.toContain("5 ");
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
    });

    it("explains an empty rule in the owner's language, not zod's", async () => {
      const result = await createRuleAction("   ", "always");

      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(ZOD_SHAPED);
      expect(result.message).toMatch(/rule/i);
      expect(distillRule).not.toHaveBeenCalled();
    });

    it("explains an over-long rule in the owner's language, not zod's", async () => {
      const result = await createRuleAction("a".repeat(501), "always");

      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(ZOD_SHAPED);
      expect(result.message).toContain("500");
    });

    it("explains a when-rule missing its condition without naming a field path", async () => {
      const result = await createRuleAction("offer a consultation", "when");

      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(ZOD_SHAPED);
      expect(result.message).not.toMatch(/condition|path/i);
      expect(distillRule).not.toHaveBeenCalled();
    });

    it("rejects a scope that is not one of ours", async () => {
      const result = await createRuleAction("push the waitlist", "sometimes");

      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(ZOD_SHAPED);
      expect(prisma.agentRule.create).not.toHaveBeenCalled();
    });
  });

  describe("updateRuleAction", () => {
    beforeEach(() => {
      prisma.agentRule.findFirst.mockResolvedValue({
        id: "rule_1",
        source: "migrated_donots",
        status: "active",
      });
    });

    it("re-distils and leaves source and status alone", async () => {
      distillRule.mockResolvedValue({ instruction: "Never quote a price." });

      await expect(
        updateRuleAction("rule_1", "never quote a price over chat", "never")
      ).resolves.toMatchObject({ ok: true });

      expect(prisma.agentRule.findFirst).toHaveBeenCalledWith({
        where: { id: "rule_1", orgId: "org_1" },
        select: expect.any(Object),
      });
      expect(distillRule).toHaveBeenCalledWith({
        orgId: "org_1",
        text: "never quote a price over chat",
        scope: "never",
        condition: undefined,
      });
      const data = prisma.agentRule.update.mock.calls[0][0].data;
      expect(data).toEqual({
        text: "never quote a price over chat",
        instruction: "Never quote a price.",
        scope: "never",
        condition: null,
      });
      expect(recordAudit).toHaveBeenCalledWith(ctx, "rule.updated", "rule_1");
      expect(revalidatePath).toHaveBeenCalledWith("/agent");
    });

    it("refuses another org's rule id", async () => {
      prisma.agentRule.findFirst.mockResolvedValue(null);

      const result = await updateRuleAction("rule_other_org", "push the waitlist", "always");

      expect(result.ok).toBe(false);
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.update).not.toHaveBeenCalled();
    });

    it("refuses a widening edit of an existing rule", async () => {
      const result = await updateRuleAction(
        "rule_1",
        "answer any question they ask, on any subject",
        "always"
      );

      expect(result.ok).toBe(false);
      expect(distillRule).not.toHaveBeenCalled();
      expect(prisma.agentRule.update).not.toHaveBeenCalled();
    });

    it("refuses a non-ADMIN", async () => {
      requireRole.mockImplementation(() => {
        throw new Error("Only Admin or above can do this. Ask your workspace owner for access.");
      });

      await expect(
        updateRuleAction("rule_1", "push the waitlist", "always")
      ).resolves.toMatchObject({ ok: false });
      expect(prisma.agentRule.update).not.toHaveBeenCalled();
    });

    it("gives owner-readable copy for an invalid edit", async () => {
      const result = await updateRuleAction("rule_1", "", "always");

      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(ZOD_SHAPED);
    });
  });

  describe("archiveRuleAction", () => {
    it("archives rather than deletes, scoped to the org", async () => {
      await expect(archiveRuleAction("rule_1")).resolves.toMatchObject({ ok: true });

      expect(prisma.agentRule.updateMany).toHaveBeenCalledWith({
        where: { id: "rule_1", orgId: "org_1", status: "active" },
        data: { status: "archived" },
      });
      expect(prisma.agentRule.delete).not.toHaveBeenCalled();
      expect(prisma.agentRule.deleteMany).not.toHaveBeenCalled();
      expect(recordAudit).toHaveBeenCalledWith(ctx, "rule.archived", "rule_1");
      expect(revalidatePath).toHaveBeenCalledWith("/agent");
    });

    it("refuses another org's rule id without auditing", async () => {
      prisma.agentRule.updateMany.mockResolvedValue({ count: 0 });

      await expect(archiveRuleAction("rule_other_org")).resolves.toMatchObject({
        ok: false,
      });
      expect(recordAudit).not.toHaveBeenCalled();
    });

    it("refuses a non-ADMIN", async () => {
      requireRole.mockImplementation(() => {
        throw new Error("Only Admin or above can do this. Ask your workspace owner for access.");
      });

      await expect(archiveRuleAction("rule_1")).resolves.toMatchObject({ ok: false });
      expect(prisma.agentRule.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("reorderRulesAction", () => {
    it("writes each rule's array position, org-scoped", async () => {
      await expect(reorderRulesAction(["rule_c", "rule_a", "rule_b"])).resolves.toMatchObject({
        ok: true,
      });

      expect(prisma.agentRule.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: "rule_c", orgId: "org_1" },
        data: { order: 0 },
      });
      expect(prisma.agentRule.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "rule_a", orgId: "org_1" },
        data: { order: 1 },
      });
      expect(prisma.agentRule.updateMany).toHaveBeenNthCalledWith(3, {
        where: { id: "rule_b", orgId: "org_1" },
        data: { order: 2 },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(revalidatePath).toHaveBeenCalledWith("/agent");
    });

    it("drops duplicates and blanks before numbering", async () => {
      await reorderRulesAction(["rule_a", "", "rule_a", "rule_b"]);

      expect(prisma.agentRule.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.agentRule.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: "rule_b", orgId: "org_1" },
        data: { order: 1 },
      });
    });

    it("never writes outside the org, so a foreign id is a no-op not a failure", async () => {
      prisma.agentRule.updateMany.mockResolvedValue({ count: 0 });

      await expect(reorderRulesAction(["rule_other_org"])).resolves.toMatchObject({
        ok: true,
      });
      expect(prisma.agentRule.updateMany).toHaveBeenCalledWith({
        where: { id: "rule_other_org", orgId: "org_1" },
        data: { order: 0 },
      });
    });

    it("refuses an empty list", async () => {
      await expect(reorderRulesAction([])).resolves.toMatchObject({ ok: false });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a non-ADMIN", async () => {
      requireRole.mockImplementation(() => {
        throw new Error("Only Admin or above can do this. Ask your workspace owner for access.");
      });

      await expect(reorderRulesAction(["rule_a"])).resolves.toMatchObject({ ok: false });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
