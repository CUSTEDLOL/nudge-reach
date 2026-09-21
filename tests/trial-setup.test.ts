import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrgContext,
  requireRole,
  transaction,
  trialFindUnique,
  knowledgeCount,
  agentProfileUpsert,
  orgUpdate,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
  transaction: vi.fn(),
  trialFindUnique: vi.fn(),
  knowledgeCount: vi.fn(),
  agentProfileUpsert: vi.fn(),
  orgUpdate: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect,
}));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: transaction } }));

import { completeTrialSetupAction } from "@/app/(app)/trial/setup/actions";

const ctx = {
  role: "OWNER",
  org: { id: "org_1", name: "Northstar Services", vertical: "services" },
};

describe("complete trial setup", () => {
  beforeEach(() => {
    requireOrgContext.mockReset();
    requireRole.mockReset();
    transaction.mockReset();
    trialFindUnique.mockReset();
    knowledgeCount.mockReset();
    agentProfileUpsert.mockReset();
    orgUpdate.mockReset();
    revalidatePath.mockReset();
    redirect.mockClear();
    requireOrgContext.mockResolvedValue(ctx);
    trialFindUnique.mockResolvedValue({
      id: "trial_1",
      convertedAt: null,
      org: { subscriptionStatus: "inactive" },
    });
    knowledgeCount.mockResolvedValue(2);
    transaction.mockImplementation(async (work: (tx: unknown) => unknown) =>
      work({
        acquisitionTrial: { findUnique: trialFindUnique },
        knowledgeEntry: { count: knowledgeCount },
        agentProfile: { upsert: agentProfileUpsert },
        org: { update: orgUpdate },
      }),
    );
  });

  it("admin-gates and completes only a grounded acquisition trial", async () => {
    await expect(completeTrialSetupAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(requireRole).toHaveBeenCalledWith(ctx, "ADMIN");
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
    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { onboardedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("does not complete a trial without approved business knowledge", async () => {
    knowledgeCount.mockResolvedValue(0);

    await expect(completeTrialSetupAction()).resolves.toEqual({
      ok: false,
      message: "Approve at least one business fact before opening your trial.",
    });
    expect(agentProfileUpsert).not.toHaveBeenCalled();
    expect(orgUpdate).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("uses the generic business vertical when signup has no vertical", async () => {
    requireOrgContext.mockResolvedValue({
      ...ctx,
      org: { ...ctx.org, vertical: null },
    });

    await expect(completeTrialSetupAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(agentProfileUpsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        enabled: true,
        vertical: "other",
        businessName: "Northstar Services",
      },
      update: { enabled: true },
    });
  });

  it("does not complete converted or non-trial workspaces", async () => {
    trialFindUnique.mockResolvedValue(null);

    await expect(completeTrialSetupAction()).resolves.toMatchObject({ ok: false });
    expect(knowledgeCount).not.toHaveBeenCalled();
    expect(agentProfileUpsert).not.toHaveBeenCalled();
  });
});

describe("legacy trial setup route", () => {
  it("redirects to the continuous Train AI page", () => {
    const source = readFileSync(
      new URL("../src/app/(app)/trial/setup/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('redirect("/agent")');
    expect(source).not.toContain("<TrialSetup");
    expect(source).not.toContain("questionnaireScript");
  });
});
