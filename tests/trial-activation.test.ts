import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRole,
  transaction,
  trialFindUnique,
  knowledgeCount,
  agentProfileUpsert,
  orgUpdateMany,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  transaction: vi.fn(),
  trialFindUnique: vi.fn(),
  knowledgeCount: vi.fn(),
  agentProfileUpsert: vi.fn(),
  orgUpdateMany: vi.fn(),
}));

vi.mock("@/modules/orgs/auth", () => ({ requireRole }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: transaction } }));

import { activateTrialAgentIfGrounded } from "@/modules/trial/activation";

const ctx = {
  role: "OWNER",
  org: {
    id: "org_1",
    name: "Northstar Services",
    vertical: "services",
  },
};

describe("activateTrialAgentIfGrounded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trialFindUnique.mockResolvedValue({
      id: "trial_1",
      convertedAt: null,
      org: { subscriptionStatus: "inactive" },
    });
    knowledgeCount.mockResolvedValue(1);
    agentProfileUpsert.mockResolvedValue({});
    orgUpdateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (work: (tx: unknown) => unknown) =>
      work({
        acquisitionTrial: { findUnique: trialFindUnique },
        knowledgeEntry: { count: knowledgeCount },
        agentProfile: { upsert: agentProfileUpsert },
        org: { updateMany: orgUpdateMany },
      }),
    );
  });

  it("admin-gates and activates a grounded restricted trial in one transaction", async () => {
    await expect(
      activateTrialAgentIfGrounded(ctx as never),
    ).resolves.toEqual({ status: "activated" });

    expect(requireRole).toHaveBeenCalledWith(ctx, "ADMIN");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(trialFindUnique).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      select: {
        id: true,
        convertedAt: true,
        org: { select: { subscriptionStatus: true } },
      },
    });
    expect(knowledgeCount).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: "active" },
    });
    expect(agentProfileUpsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        enabled: true,
        vertical: "services",
        businessName: "Northstar Services",
      },
      update: { enabled: true },
    });
    expect(orgUpdateMany).toHaveBeenCalledWith({
      where: { id: "org_1", onboardedAt: null },
      data: { onboardedAt: expect.any(Date) },
    });
  });

  it("does not activate without an approved org-scoped fact", async () => {
    knowledgeCount.mockResolvedValue(0);

    await expect(
      activateTrialAgentIfGrounded(ctx as never),
    ).resolves.toEqual({ status: "no_knowledge" });

    expect(agentProfileUpsert).not.toHaveBeenCalled();
    expect(orgUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    [
      "converted",
      {
        id: "trial_1",
        convertedAt: new Date("2026-09-22T00:00:00.000Z"),
        org: { subscriptionStatus: "inactive" },
      },
    ],
    [
      "paid",
      {
        id: "trial_1",
        convertedAt: null,
        org: { subscriptionStatus: "active" },
      },
    ],
  ])("returns not_restricted for a %s workspace", async (_case, trial) => {
    trialFindUnique.mockResolvedValue(trial);

    await expect(
      activateTrialAgentIfGrounded(ctx as never),
    ).resolves.toEqual({ status: "not_restricted" });

    expect(knowledgeCount).not.toHaveBeenCalled();
    expect(agentProfileUpsert).not.toHaveBeenCalled();
    expect(orgUpdateMany).not.toHaveBeenCalled();
  });

  it("uses the neutral vertical fallback and preserves onboarding time on retries", async () => {
    const context = {
      ...ctx,
      org: { ...ctx.org, vertical: null },
    };

    await activateTrialAgentIfGrounded(context as never);
    await activateTrialAgentIfGrounded(context as never);

    expect(agentProfileUpsert).toHaveBeenCalledTimes(2);
    expect(agentProfileUpsert).toHaveBeenLastCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        enabled: true,
        vertical: "other",
        businessName: "Northstar Services",
      },
      update: { enabled: true },
    });
    expect(orgUpdateMany).toHaveBeenCalledTimes(2);
    for (const [input] of orgUpdateMany.mock.calls) {
      expect(input.where).toEqual({ id: "org_1", onboardedAt: null });
    }
  });

  it("rejects non-admin callers before opening a transaction", async () => {
    requireRole.mockImplementation(() => {
      throw new Error("Only an admin or above can do this.");
    });

    await expect(
      activateTrialAgentIfGrounded(ctx as never),
    ).rejects.toThrow(/admin/i);
    expect(transaction).not.toHaveBeenCalled();
  });
});
