import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

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
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/app/(app)/agent/training-actions", () => ({
  importWebsiteAction: vi.fn(),
  importGbpAction: vi.fn(),
  importFileAction: vi.fn(),
  approveDraftAction: vi.fn(),
  discardDraftAction: vi.fn(),
  approveAllDraftsAction: vi.fn(),
}));
vi.mock("@/app/(app)/agent/questionnaire/actions", () => ({
  submitQuestionnaireAction: vi.fn(),
}));

import { completeTrialSetupAction } from "@/app/(app)/trial/setup/actions";
import { TrialSetup, trialSetupStage } from "@/app/(app)/trial/setup/trial-setup";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const workspace: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  expiresAt: "2026-09-27T10:00:00.000Z",
  repliesUsed: 0,
  replyLimit: 15,
  repliesRemaining: 15,
  setupComplete: false,
  knowledgeSource: null,
  knowledgeReady: false,
  knowledgeCount: 0,
  firstReplyAt: null,
  exploreViewed: false,
  tourStep: "welcome",
  tourCompleted: false,
  tourDismissed: false,
  demoBooked: false,
  converted: false,
};

const ctx = {
  role: "OWNER",
  org: { id: "org_1", name: "Aster Clinic", vertical: "clinic" },
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
        vertical: "clinic",
        businessName: "Aster Clinic",
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
      message: "Approve at least one clinic fact before opening your trial.",
    });
    expect(agentProfileUpsert).not.toHaveBeenCalled();
    expect(orgUpdate).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not complete converted or non-trial workspaces", async () => {
    trialFindUnique.mockResolvedValue(null);

    await expect(completeTrialSetupAction()).resolves.toMatchObject({ ok: false });
    expect(knowledgeCount).not.toHaveBeenCalled();
    expect(agentProfileUpsert).not.toHaveBeenCalled();
  });
});

describe("three-screen trial setup", () => {
  const questions = [
    { id: "business_summary", prompt: "Describe your clinic", placeholder: "We help…" },
  ];

  it("offers exactly one of four starting sources", () => {
    const html = renderToStaticMarkup(
      createElement(TrialSetup, { workspace, drafts: [], questions }),
    );

    expect(html).toContain("Teach Nudge about your clinic");
    for (const label of [
      "Website",
      "Google Business Profile",
      "File",
      "Answer 5 questions",
    ]) {
      expect(html).toContain(label);
    }
    expect(html.match(/data-source-card=/g)).toHaveLength(4);
    expect(trialSetupStage(workspace, 0)).toBe("source");
  });

  it("moves imported drafts through one approval screen", () => {
    const importing = { ...workspace, knowledgeSource: "website" as const };
    const html = renderToStaticMarkup(
      createElement(TrialSetup, {
        workspace: importing,
        drafts: [{ id: "draft_1", category: "hours", fact: "Open Monday to Saturday", condition: null }],
        questions,
      }),
    );

    expect(html).toContain("Review what Nudge found");
    expect(html).toContain("Open Monday to Saturday");
    expect(html).toContain("Approve all and continue");
    expect(trialSetupStage(importing, 1)).toBe("review");
  });

  it("ends with one clear handoff into the workspace", () => {
    const ready = { ...workspace, knowledgeSource: "interview" as const, knowledgeReady: true, knowledgeCount: 5 };
    const html = renderToStaticMarkup(
      createElement(ToastProvider, null, createElement(TrialSetup, { workspace: ready, drafts: [], questions })),
    );

    expect(html).toContain("Ready to test");
    expect(html).toContain("5 approved facts");
    expect(html).toContain("Open my trial");
    expect(trialSetupStage(ready, 0)).toBe("ready");
  });
});
