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
  withTrialKnowledgeSource,
} = vi.hoisted(() => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    knowledgeEntry: { create: vi.fn(), createMany: vi.fn() },
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
  withTrialKnowledgeSource: vi.fn(),
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
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  ingestFile,
  ingestGbp,
  ingestWebsite,
}));
vi.mock("@/modules/trial/knowledge", () => ({
  TRIAL_INGEST_BUDGET: { maxSubpages: 1, maxChunksPerPage: 2, maxDrafts: 25 },
  withTrialKnowledgeSource,
}));
vi.mock("@/modules/trial/capabilities", () => ({
  isRestrictedAcquisitionTrial,
}));

import {
  addFactAction,
  answerQuestionAction,
  importFileAction,
  importGbpAction,
  importWebsiteAction,
  structureExistingInfoAction,
} from "@/app/(app)/agent/training-actions";

describe("restricted trial model-backed training actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({
      org: { id: "org_1" },
      role: "OWNER",
    });
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    prisma.agentProfile.findUnique.mockResolvedValue({
      businessInfo: "We are open Monday to Saturday.",
    });
    answerOwnerQuestion.mockResolvedValue({ facts: 1, followUpsSent: 0 });
    distillAnswer.mockResolvedValue([
      { category: "hours", fact: "Open Monday to Saturday." },
    ]);
    prisma.knowledgeEntry.create.mockResolvedValue({});
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
    withTrialKnowledgeSource.mockImplementation(
      async (_orgId, _source, work) => work(),
    );
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
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
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
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
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
});
