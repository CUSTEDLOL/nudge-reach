import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrgContext,
  orgUpdate,
  membershipUpdate,
  agentProfileUpsert,
  transaction,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  orgUpdate: vi.fn().mockResolvedValue({}),
  membershipUpdate: vi.fn().mockResolvedValue({}),
  agentProfileUpsert: vi.fn().mockResolvedValue({}),
  transaction: vi.fn().mockResolvedValue([]),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/db", () => ({
  prisma: {
    org: { update: orgUpdate },
    membership: { update: membershipUpdate },
    agentProfile: { upsert: agentProfileUpsert },
    $transaction: transaction,
  },
}));
vi.mock("@/modules/orgs/auth", () => {
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrgContext,
    requireRole: (ctx: { role: string }, minimum: string) => {
      if (ORDER[ctx.role] < ORDER[minimum]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});

import {
  completeOnboardingAction,
  saveBusinessProfileAction,
  saveWorkspaceProfileStepAction,
} from "@/app/(app)/onboarding/actions";

function context(role: "OWNER" | "ADMIN" | "AGENT") {
  return {
    role,
    userId: "user-1",
    email: "owner@example.com",
    org: {
      id: "org-1",
      name: "Aster Clinic",
      settings: { avgOrderValueInr: 2500 },
    },
    membership: {
      id: "member-1",
      displayName: "Asha",
      uiPreferences: {},
    },
  };
}

describe("personalized onboarding actions", () => {
  beforeEach(() => {
    requireOrgContext.mockReset();
    orgUpdate.mockClear();
    membershipUpdate.mockClear();
    agentProfileUpsert.mockClear();
    transaction.mockClear();
    revalidatePath.mockClear();
    redirect.mockClear();
  });

  it("refuses organization-wide profile changes from an agent", async () => {
    requireOrgContext.mockResolvedValue(context("AGENT"));

    const result = await saveWorkspaceProfileStepAction({
      role: "front-desk",
      lastCompletedStep: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/admin/i);
    expect(orgUpdate).not.toHaveBeenCalled();
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid answer without writing", async () => {
    requireOrgContext.mockResolvedValue(context("OWNER"));

    const result = await saveWorkspaceProfileStepAction({
      primaryOutcome: "do-everything",
      lastCompletedStep: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/outcome/i);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("does not expose database errors while autosaving", async () => {
    requireOrgContext.mockResolvedValue(context("OWNER"));
    transaction.mockRejectedValueOnce(new Error("database password leaked"));

    const result = await saveWorkspaceProfileStepAction({
      primaryOutcome: "follow-up",
      lastCompletedStep: 2,
    });

    expect(result).toEqual({
      ok: false,
      message: "Couldn't save your answer — please try again.",
    });
  });

  it("writes shared answers and personal shortcuts only to the caller context", async () => {
    requireOrgContext.mockResolvedValue(context("ADMIN"));

    const result = await saveWorkspaceProfileStepAction({
      primaryOutcome: "follow-up",
      lastCompletedStep: 2,
    });

    expect(result.ok).toBe(true);
    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        settings: expect.objectContaining({
          avgOrderValueInr: 2500,
          workspaceProfile: expect.objectContaining({
            primaryOutcome: "follow-up",
            lastCompletedStep: 2,
          }),
        }),
      },
    });
    expect(membershipUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: {
        uiPreferences: {
          sidebarCollapsed: false,
          pinnedShortcuts: ["followups", "inbox", "front-desk"],
        },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("completes with safe defaults and does not activate operational models", async () => {
    requireOrgContext.mockResolvedValue(context("OWNER"));
    const formData = new FormData();
    formData.set("next", "dashboard");

    await expect(completeOnboardingAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        onboardedAt: expect.any(Date),
        settings: expect.any(Object),
      }),
    });
    expect(membershipUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { uiPreferences: expect.any(Object) },
    });
    expect(agentProfileUpsert).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("preserves the actual answered step when onboarding is skipped", async () => {
    const ctx = context("OWNER");
    requireOrgContext.mockResolvedValue({
      ...ctx,
      org: {
        ...ctx.org,
        settings: {
          ...ctx.org.settings,
          workspaceProfile: {
            primaryOutcome: "follow-up",
            lastCompletedStep: 2,
          },
        },
      },
    });

    await expect(completeOnboardingAction(new FormData())).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        settings: expect.objectContaining({
          workspaceProfile: expect.objectContaining({
            primaryOutcome: "follow-up",
            lastCompletedStep: 2,
          }),
        }),
      }),
    });
  });

  it("saves business identity without activating the AI front desk", async () => {
    requireOrgContext.mockResolvedValue(context("OWNER"));
    const formData = new FormData();
    formData.set("businessName", "Aster Clinic");
    formData.set("vertical", "clinic");
    formData.set("country", "IN");

    const result = await saveBusinessProfileAction(formData);

    expect(result.ok).toBe(true);
    expect(agentProfileUpsert).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      create: {
        orgId: "org-1",
        enabled: false,
        vertical: "clinic",
        businessName: "Aster Clinic",
      },
      update: { vertical: "clinic", businessName: "Aster Clinic" },
    });
  });

  it("does not expose database errors while finishing", async () => {
    requireOrgContext.mockResolvedValue(context("OWNER"));
    transaction.mockRejectedValueOnce(new Error("database password leaked"));

    const result = await completeOnboardingAction(new FormData());

    expect(result).toEqual({
      ok: false,
      message: "Couldn't finish setup — please try again.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
