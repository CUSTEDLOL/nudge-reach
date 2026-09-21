import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrgContext,
  requireRole,
  distillAnswer,
  storeKnowledgeFacts,
  isRestrictedAcquisitionTrial,
  revalidatePath,
} = vi.hoisted(() => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    org: { findUnique: vi.fn(), update: vi.fn() },
    knowledgeEntry: { createMany: vi.fn() },
  },
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
  distillAnswer: vi.fn(),
  storeKnowledgeFacts: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/modules/knowledge/distill", () => ({ distillAnswer }));
vi.mock("@/modules/knowledge/store", () => ({ storeKnowledgeFacts }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
import { questionnaireScript } from "@/modules/knowledge/questionnaire";
import { KNOWLEDGE_CATEGORIES } from "@/modules/knowledge/digest";
import {
  submitQuestionnaireAction,
  submitQuestionnaireAnswerAction,
} from "@/app/(app)/agent/questionnaire/actions";

describe("questionnaireScript", () => {
  it("has a substantial, bounded script", () => {
    const script = questionnaireScript("boutique");
    expect(script.length).toBeGreaterThanOrEqual(18);
    expect(script.length).toBeLessThanOrEqual(24);
  });

  it("covers every knowledge category", () => {
    const cats = new Set(questionnaireScript("other").map((q) => q.category));
    for (const c of KNOWLEDGE_CATEGORIES) expect(cats.has(c)).toBe(true);
  });

  it("ids are stable and unique across verticals", () => {
    const a = questionnaireScript("clinic").map((q) => q.id);
    const b = questionnaireScript("boutique").map((q) => q.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("adapts wording to curated verticals", () => {
    const clinic = questionnaireScript("clinic").find(
      (q) => q.id === "services_list"
    );
    expect(clinic?.prompt.toLowerCase()).toContain("treatment");
    const restaurant = questionnaireScript("restaurant").find(
      (q) => q.id === "services_list"
    );
    expect(restaurant?.prompt.toLowerCase()).toContain("dish");
    const generic = questionnaireScript("jewellery").find(
      (q) => q.id === "services_list"
    );
    expect(generic?.prompt.toLowerCase()).toContain("products or services");
  });

  it("every item has a prompt and placeholder", () => {
    for (const q of questionnaireScript("salon")) {
      expect(q.prompt.length).toBeGreaterThan(10);
      expect(q.placeholder.length).toBeGreaterThan(3);
    }
  });
});

describe("acquisition trial questionnaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({ org: { id: "org_1" } });
    prisma.agentProfile.findUnique.mockResolvedValue({ vertical: "clinic" });
    prisma.knowledgeEntry.createMany.mockResolvedValue({ count: 1 });
    distillAnswer.mockResolvedValue([{ category: "other", fact: "A fact" }]);
    storeKnowledgeFacts.mockResolvedValue({
      created: 1,
      capacityReached: false,
    });
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
  });

  it("accepts the approved five answers without consuming an import quota", async () => {
    const answers = [
      { id: "business_summary", answer: "Aster is an aesthetic clinic." },
      { id: "services_list", answer: "Hair restoration and skin treatments." },
      { id: "hours_weekly", answer: "Monday to Friday, 9 AM to 6 PM." },
      { id: "location_address", answer: "12 Orchard Road, Singapore." },
      { id: "faq_1", answer: "Consultations take about 30 minutes." },
      { id: "business_summary", answer: "A duplicate answer must be ignored." },
      { id: "payments_accepted", answer: "Cards and cash." },
    ];

    const result = await submitQuestionnaireAction(answers);

    expect(result).toMatchObject({ ok: true, facts: 5 });
    expect(distillAnswer).toHaveBeenCalledTimes(5);
    expect(storeKnowledgeFacts).toHaveBeenCalledTimes(5);
    expect(storeKnowledgeFacts).toHaveBeenCalledWith(
      "org_1",
      [{ category: "menu_services", fact: "A fact" }],
      {
        source: "questionnaire",
        status: "active",
        activeDraftCap: 50,
      },
    );
    expect(prisma.knowledgeEntry.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("stops a restricted questionnaire at the shared 50-fact limit", async () => {
    storeKnowledgeFacts.mockResolvedValue({
      created: 0,
      capacityReached: true,
    });

    await expect(submitQuestionnaireAction([
      { id: "business_summary", answer: "Aster is an aesthetic clinic." },
      { id: "services_list", answer: "Hair restoration." },
    ])).resolves.toEqual({
      ok: false,
      facts: 0,
      message: "Your free trial can store up to 50 facts. Archive a fact before adding another.",
    });

    expect(distillAnswer).toHaveBeenCalledOnce();
    expect(storeKnowledgeFacts).toHaveBeenCalledOnce();
  });

  it("rejects one-at-a-time answers so they cannot bypass the batch budget", async () => {
    await expect(submitQuestionnaireAnswerAction(
      "business_summary",
      "Aster is an aesthetic clinic."
    )).resolves.toEqual({
      ok: false,
      message: "Use the 5-question trial setup so your answers are saved together",
    });
    expect(distillAnswer).not.toHaveBeenCalled();
  });

  it("keeps one-at-a-time mode for paid workspaces", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(false);

    await expect(submitQuestionnaireAnswerAction(
      "business_summary",
      "Aster is an aesthetic clinic."
    )).resolves.toMatchObject({ ok: true, facts: 1 });
    expect(distillAnswer).toHaveBeenCalledOnce();
    expect(prisma.knowledgeEntry.createMany).toHaveBeenCalledOnce();
    expect(storeKnowledgeFacts).not.toHaveBeenCalled();
  });
});
