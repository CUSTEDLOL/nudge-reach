import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrgContext,
  requireRole,
  isRestrictedAcquisitionTrial,
  answerOwnerQuestion,
  distillAnswer,
  storeKnowledgeFacts,
  revalidatePath,
  ingestFile,
  ingestGbp,
  ingestWebsite,
  withTrialKnowledgeImport,
  activateTrialAgentIfGrounded,
} = vi.hoisted(() => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    knowledgeEntry: {
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  answerOwnerQuestion: vi.fn(),
  distillAnswer: vi.fn(),
  storeKnowledgeFacts: vi.fn(),
  revalidatePath: vi.fn(),
  ingestFile: vi.fn(),
  ingestGbp: vi.fn(),
  ingestWebsite: vi.fn(),
  withTrialKnowledgeImport: vi.fn(),
  activateTrialAgentIfGrounded: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/modules/knowledge/questions", () => ({
  answerOwnerQuestion,
  dismissOwnerQuestion: vi.fn(),
}));
vi.mock("@/modules/knowledge/distill", () => ({ distillAnswer }));
vi.mock("@/modules/knowledge/store", () => ({ storeKnowledgeFacts }));
vi.mock("@/modules/knowledge/ingest", () => ({
  FILE_MEDIA_TYPES: ["application/pdf"],
  MAX_FILE_BYTES: 4 * 1024 * 1024,
  ingestFile,
  ingestGbp,
  ingestWebsite,
}));
vi.mock("@/modules/trial/knowledge", () => ({
  TRIAL_INGEST_BUDGET: { maxSubpages: 1, maxChunksPerPage: 2, maxDrafts: 25 },
  TRIAL_KNOWLEDGE_LIMITS: { webImports: 1, fileImports: 3, facts: 50 },
  withTrialKnowledgeImport,
}));
vi.mock("@/modules/trial/capabilities", () => ({
  isRestrictedAcquisitionTrial,
}));
vi.mock("@/modules/trial/activation", () => ({
  activateTrialAgentIfGrounded,
}));

import {
  addFactAction,
  approveAllDraftsAction,
  approveDraftAction,
  answerQuestionAction,
  importFileAction,
  importGbpAction,
  importWebsiteAction,
  structureExistingInfoAction,
} from "@/app/(app)/agent/training-actions";

const ctx = {
  org: { id: "org_1" },
  role: "OWNER",
};

describe("restricted trial model-backed training actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue(ctx);
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    prisma.agentProfile.findUnique.mockResolvedValue({
      businessInfo: "We are open Monday to Saturday.",
    });
    answerOwnerQuestion.mockResolvedValue({ facts: 1, followUpsSent: 0 });
    distillAnswer.mockResolvedValue([
      { category: "hours", fact: "Open Monday to Saturday." },
    ]);
    prisma.knowledgeEntry.create.mockResolvedValue({});
    prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 1 });
    storeKnowledgeFacts.mockResolvedValue({
      created: 1,
      capacityReached: false,
    });
    ingestWebsite.mockResolvedValue({
      pages: 1,
      drafts: 2,
      capacityReached: false,
    });
    ingestFile.mockResolvedValue({ drafts: 2, capacityReached: false });
    ingestGbp.mockResolvedValue({
      name: "Example Business",
      drafts: 2,
      websiteCrawled: false,
      capacityReached: false,
    });
    withTrialKnowledgeImport.mockImplementation(
      async (_orgId, _source, work) => work(),
    );
    activateTrialAgentIfGrounded.mockResolvedValue({ status: "activated" });
  });

  it("blocks owner-question distillation before the model-backed service", async () => {
    await expect(
      answerQuestionAction("question_1", "Yes, until 7pm.")
    ).resolves.toMatchObject({ ok: false, message: expect.stringMatching(/paid/i) });
    expect(answerOwnerQuestion).not.toHaveBeenCalled();
  });

  it("blocks legacy-info structuring before distillation", async () => {
    await expect(structureExistingInfoAction()).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/paid/i),
    });
    expect(prisma.agentProfile.findUnique).not.toHaveBeenCalled();
    expect(distillAnswer).not.toHaveBeenCalled();
  });

  it("stores a restricted trial's manual fact through the shared 50-fact boundary", async () => {
    await expect(
      addFactAction({
        category: "hours",
        fact: "Open Monday to Friday",
      }),
    ).resolves.toEqual({ ok: true, message: "Fact added." });

    expect(storeKnowledgeFacts).toHaveBeenCalledWith(
      "org_1",
      [{ category: "hours", fact: "Open Monday to Friday" }],
      {
        source: "manual",
        status: "active",
        activeDraftCap: 50,
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(activateTrialAgentIfGrounded).toHaveBeenCalledWith(ctx);
  });

  it("returns a clear trial-limit message without revalidating when capacity is full", async () => {
    storeKnowledgeFacts.mockResolvedValue({
      created: 0,
      capacityReached: true,
    });

    await expect(
      addFactAction({ category: "hours", fact: "Open on Saturdays" }),
    ).resolves.toEqual({
      ok: false,
      message: "Your free trial can store up to 50 facts. Archive a fact before adding another.",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(activateTrialAgentIfGrounded).not.toHaveBeenCalled();
  });

  it("preserves paid manual creation without deduping through the trial store", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(false);

    await expect(
      addFactAction({
        category: "hours",
        fact: "Open Monday to Friday",
        condition: "Except public holidays",
      }),
    ).resolves.toEqual({ ok: true, message: "Fact added." });

    expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
      data: {
        orgId: "org_1",
        category: "hours",
        fact: "Open Monday to Friday",
        condition: "Except public holidays",
        source: "manual",
      },
    });
    expect(storeKnowledgeFacts).not.toHaveBeenCalled();
    expect(activateTrialAgentIfGrounded).not.toHaveBeenCalled();
  });

  it("activates after an individual restricted-trial draft is approved", async () => {
    await expect(approveDraftAction("draft_1")).resolves.toEqual({
      ok: true,
      message: "Fact approved.",
    });

    expect(prisma.knowledgeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "draft_1", orgId: "org_1", status: "draft" },
      data: { status: "active" },
    });
    expect(activateTrialAgentIfGrounded).toHaveBeenCalledWith(ctx);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("activates after a non-empty restricted-trial bulk approval", async () => {
    prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 2 });

    await expect(approveAllDraftsAction()).resolves.toEqual({
      ok: true,
      message: "Approved 2 facts.",
    });

    expect(activateTrialAgentIfGrounded).toHaveBeenCalledWith(ctx);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("does not activate a zero-row bulk approval", async () => {
    prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 0 });
    await approveAllDraftsAction();
    expect(activateTrialAgentIfGrounded).not.toHaveBeenCalled();
  });

  it("does not activate a paid approval", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(false);
    prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 1 });

    await approveDraftAction("draft_paid");

    expect(activateTrialAgentIfGrounded).not.toHaveBeenCalled();
  });

  it("passes the shared 50-fact cap into restricted website ingestion", async () => {
    await expect(importWebsiteAction("example.com")).resolves.toMatchObject({
      ok: true,
    });

    expect(ingestWebsite).toHaveBeenCalledWith("org_1", "example.com", {
      maxSubpages: 1,
      maxChunksPerPage: 2,
      maxDrafts: 25,
      activeDraftCap: 50,
    });
    expect(withTrialKnowledgeImport).toHaveBeenCalledWith(
      "org_1",
      "website",
      expect.any(Function),
      expect.any(Function),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(activateTrialAgentIfGrounded).not.toHaveBeenCalled();
  });

  it("explains when a website import is blocked by the 50-fact limit", async () => {
    ingestWebsite.mockResolvedValue({
      pages: 1,
      drafts: 0,
      capacityReached: true,
    });

    await expect(importWebsiteAction("example.com")).resolves.toEqual({
      ok: false,
      message: "Your free trial can store up to 50 facts. Archive a fact before importing more.",
    });
  });

  it("passes the shared 50-fact cap into restricted file ingestion", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF"], "services.pdf", { type: "application/pdf" }),
    );

    await expect(importFileAction(formData)).resolves.toMatchObject({ ok: true });

    expect(ingestFile).toHaveBeenCalledWith(
      "org_1",
      { base64: "JVBERg==", mediaType: "application/pdf" },
      { maxDrafts: 25, activeDraftCap: 50 },
    );
    expect(withTrialKnowledgeImport).toHaveBeenCalledWith(
      "org_1",
      "file",
      expect.any(Function),
      expect.any(Function),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects files over 4 MB before reserving quota or reading bytes", async () => {
    const formData = new FormData();
    const file = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "too-large.pdf",
      { type: "application/pdf" },
    );
    const readFile = vi.spyOn(file, "arrayBuffer");
    formData.set("file", file);

    await expect(importFileAction(formData)).resolves.toEqual({
      ok: false,
      message: "That file is too large — 4 MB max.",
    });
    expect(withTrialKnowledgeImport).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(ingestFile).not.toHaveBeenCalled();
  });

  it("explains when a file import is blocked by the 50-fact limit", async () => {
    ingestFile.mockResolvedValue({ drafts: 0, capacityReached: true });
    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF"], "services.pdf", { type: "application/pdf" }),
    );

    await expect(importFileAction(formData)).resolves.toEqual({
      ok: false,
      message: "Your free trial can store up to 50 facts. Archive a fact before importing more.",
    });
  });

  it("passes the shared 50-fact cap into restricted Google ingestion", async () => {
    await expect(importGbpAction("Example Business Singapore")).resolves.toMatchObject({
      ok: true,
    });

    expect(ingestGbp).toHaveBeenCalledWith(
      "org_1",
      "Example Business Singapore",
      {
        maxSubpages: 1,
        maxChunksPerPage: 2,
        maxDrafts: 25,
        activeDraftCap: 50,
      },
    );
    expect(withTrialKnowledgeImport).toHaveBeenCalledWith(
      "org_1",
      "gbp",
      expect.any(Function),
      expect.any(Function),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("explains when a Google import is blocked by the 50-fact limit", async () => {
    ingestGbp.mockResolvedValue({
      name: "Example Business",
      drafts: 0,
      websiteCrawled: false,
      capacityReached: true,
    });

    await expect(
      importGbpAction("Example Business Singapore"),
    ).resolves.toEqual({
      ok: false,
      message: "Your free trial can store up to 50 facts. Archive a fact before importing more.",
    });
  });

  it("surfaces the shared web-import quota before crawling again", async () => {
    withTrialKnowledgeImport.mockRejectedValue(
      new Error(
        "Your free trial includes one website or Google Business Profile import.",
      ),
    );

    await expect(importWebsiteAction("second.example.com")).resolves.toEqual({
      ok: false,
      message: "Your free trial includes one website or Google Business Profile import.",
    });
    expect(ingestWebsite).not.toHaveBeenCalled();
  });

  it("surfaces the three-file quota before reading a fourth file", async () => {
    withTrialKnowledgeImport.mockRejectedValue(
      new Error("Your free trial includes three file imports."),
    );
    const formData = new FormData();
    const file = new File(["%PDF"], "fourth.pdf", { type: "application/pdf" });
    const readFile = vi.spyOn(file, "arrayBuffer");
    formData.set("file", file);

    await expect(importFileAction(formData)).resolves.toEqual({
      ok: false,
      message: "Your free trial includes three file imports.",
    });
    expect(readFile).not.toHaveBeenCalled();
    expect(ingestFile).not.toHaveBeenCalled();
  });
});
