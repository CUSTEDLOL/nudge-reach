import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

const { refresh, actions } = vi.hoisted(() => ({
  refresh: vi.fn(),
  actions: {
    addFactAction: vi.fn(),
    archiveFactAction: vi.fn(),
    archiveFactsAction: vi.fn(),
    updateFactAction: vi.fn(),
    structureExistingInfoAction: vi.fn(),
    importWebsiteAction: vi.fn(),
    importGbpAction: vi.fn(),
    importFileAction: vi.fn(),
    approveDraftAction: vi.fn(),
    discardDraftAction: vi.fn(),
    approveAllDraftsAction: vi.fn(),
    discardAllDraftsAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@/app/(app)/agent/training-actions", () => actions);

import { TrialTraining } from "@/components/features/trial/trial-training";
import { uploadTrialPdfFiles } from "@/components/features/trial/trial-knowledge-sources";
import { Library } from "@/app/(app)/agent/library";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const workspace: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  emailVerified: false,
  expiresAt: "2026-09-29T10:00:00.000Z",
  repliesUsed: 0,
  replyLimit: 15,
  repliesRemaining: 15,
  setupComplete: false,
  knowledgeSource: null,
  knowledgeReady: false,
  knowledgeCount: 0,
  approvedFactCount: 0,
  draftFactCount: 0,
  factCount: 0,
  factLimit: 50,
  webImportsUsed: 0,
  webImportLimit: 1,
  fileImportsUsed: 0,
  fileImportLimit: 3,
  firstReplyAt: null,
  exploreViewed: false,
  tourStep: "welcome",
  tourCompleted: false,
  tourDismissed: false,
  demoBooked: false,
  converted: false,
};

const activeFact = {
  id: "fact_1",
  category: "hours",
  fact: "Open Monday to Friday, 9 AM to 5 PM",
  condition: null,
  source: "manual",
};

const draft = {
  id: "draft_1",
  category: "pricing",
  fact: "Standard setup costs $120",
  condition: null,
};

function renderTraining(
  current: TrialWorkspace,
  facts = current.approvedFactCount > 0 ? [activeFact] : [],
  drafts = current.draftFactCount > 0 ? [draft] : [],
) {
  return renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(TrialTraining, {
        workspace: current,
        facts,
        drafts,
        canEdit: true,
      }),
    ),
  );
}

describe("continuous trial training page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows every training control together without a staged source picker", () => {
    const html = renderTraining(workspace);

    expect(html).toContain("Train AI");
    expect(html).toContain("Website or Google listing");
    expect(html).toContain("0/1");
    expect(html).toContain("Text PDFs");
    expect(html).toContain("0/3");
    expect(html).toContain("Text PDF, 4 MB max each");
    expect(html).toContain('accept="application/pdf,.pdf"');
    expect(html).toContain("multiple");
    expect(html).toContain("Drafts to review");
    expect(html).toContain("Approved facts");
    expect(html).toContain("Add fact");
    expect(html).toContain("Facts 0/50");
    expect(html).toContain('placeholder="e.g. Standard setup costs $120"');
    expect(html).not.toContain("Bridal mehendi");
    expect(html).not.toContain("Test in Inbox");
    expect(html).not.toContain("data-source-card");
    expect(html).not.toMatch(/step 1|progress/i);
    expect(html).not.toMatch(/clinic|patient/i);
  });

  it("keeps every source visible after imports and offers Inbox only with approved knowledge", () => {
    const trained = {
      ...workspace,
      setupComplete: true,
      knowledgeSource: "website" as const,
      knowledgeReady: true,
      knowledgeCount: 1,
      approvedFactCount: 1,
      draftFactCount: 1,
      factCount: 2,
      webImportsUsed: 1,
      fileImportsUsed: 2,
    };
    const html = renderTraining(trained);

    expect(html).toContain("Website address");
    expect(html).toContain("Google Business Profile");
    expect(html).toContain("Choose text PDFs");
    expect(html).toContain("1/1");
    expect(html).toContain("2/3");
    expect(html).toContain(draft.fact);
    expect(html).toContain(activeFact.fact);
    expect(html).toContain("Facts 2/50");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Test in Inbox");
    expect(html).not.toContain("/trial/setup");
  });

  it("disables manual creation honestly when active plus draft facts reach the cap", () => {
    const full = {
      ...workspace,
      knowledgeReady: true,
      knowledgeCount: 49,
      approvedFactCount: 49,
      draftFactCount: 1,
      factCount: 50,
    };
    const html = renderTraining(full, [activeFact], [draft]);

    expect(html).toContain("Fact limit reached (50/50)");
    expect(html).toMatch(/id="kf-fact"[^>]*disabled/);
    expect(html).toContain("Test in Inbox");
  });

  it("preserves the paid Library placeholder when no trial override is passed", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(Library, {
          facts: [],
          canEdit: true,
          showStructureButton: false,
        }),
      ),
    );

    expect(html).toContain(
      'placeholder="e.g. Bridal mehendi package is ₹5,000"',
    );
  });

  it("loads active and draft facts into the trial branch and never pushes after imports", () => {
    const agentPage = readFileSync("src/app/(app)/agent/page.tsx", "utf8");
    const sources = readFileSync(
      "src/components/features/trial/trial-knowledge-sources.tsx",
      "utf8",
    );

    expect(agentPage).toContain('status: "active"');
    expect(agentPage).toContain('status: "draft"');
    expect(agentPage).toContain("workspace={trial}");
    expect(agentPage).toContain("drafts={");
    expect(sources).toContain("router.refresh()");
    expect(sources).not.toContain("router.push");
  });
});

describe("sequential PDF uploads", () => {
  it("uploads in order and stops at the visible remaining allowance", async () => {
    const files = [
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.pdf", { type: "application/pdf" }),
      new File(["three"], "three.pdf", { type: "application/pdf" }),
    ];
    let releaseFirst!: (value: { ok: boolean; message: string }) => void;
    const first = new Promise<{ ok: boolean; message: string }>((resolve) => {
      releaseFirst = resolve;
    });
    const upload = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ok: true, message: "Second uploaded." });

    const result = uploadTrialPdfFiles(files, 2, upload);
    await Promise.resolve();
    expect(upload).toHaveBeenCalledTimes(1);

    releaseFirst({ ok: true, message: "First uploaded." });
    await expect(result).resolves.toEqual({
      ok: true,
      message: "Uploaded 2 PDFs. Review the facts below.",
      uploaded: 2,
    });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(
      upload.mock.calls.map(([form]) => (form as FormData).get("file")),
    ).toEqual(files.slice(0, 2));
  });

  /**
   * The trial's Train AI page and the paid Training page are the same screen
   * at different allowances, so they should read as one design: full width,
   * one flat stack of small labelled blocks, and the fact library leading
   * once the AI has been taught anything. The trial's limits stay — they are
   * what the trial is.
   */
  describe("matches the paid Training page layout", () => {
    const paidPage = readFileSync("src/app/(app)/agent/page.tsx", "utf8");

    it("uses the paid page's full-width stack, not a narrow column", () => {
      const html = renderTraining(workspace);

      expect(html).not.toContain("max-w-3xl");
      expect(html).toContain("flex flex-col gap-8");
      expect(paidPage).toContain('<div className="flex flex-col gap-8">');
      // the old bordered-divider treatment is gone from every trial block
      expect(html).not.toContain("border-t border-neutral-200 py-7");
    });

    it("labels blocks the same way the paid page does", () => {
      const html = renderTraining(workspace);
      const headings = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) ?? [];

      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings) {
        expect(heading).toContain("text-sm font-semibold text-neutral-900");
      }
      expect(paidPage).toContain('className="mb-3 text-sm font-semibold text-neutral-900"');
    });

    it("leads with the library once taught, and with the sources before that", () => {
      const untaught = renderTraining(workspace);
      expect(untaught).toContain("Approved facts");
      expect(untaught.indexOf("Website or Google listing"))
        .toBeLessThan(untaught.indexOf("Approved facts"));

      const taught = renderTraining({
        ...workspace,
        approvedFactCount: 2,
        factCount: 2,
        knowledgeCount: 2,
      });
      expect(taught).toContain("Your AI knows 2 facts");
      expect(taught.indexOf("Your AI knows"))
        .toBeLessThan(taught.indexOf("Website or Google listing"));
    });

    it("keeps the trial allowances visible in the new layout", () => {
      const html = renderTraining(workspace);

      expect(html).toContain("Facts 0/50");
      expect(html).toContain("0/1");
      expect(html).toContain("0/3");
      expect(html).toContain('data-tour="training-source"');
    });
  });

  it("refreshes the allowance after a persisted upload even when the next PDF fails", async () => {
    const files = [
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.pdf", { type: "application/pdf" }),
    ];
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, message: "First uploaded." })
      .mockResolvedValueOnce({ ok: false, message: "Second PDF could not be read." });
    const refreshAllowance = vi.fn();

    await expect(
      uploadTrialPdfFiles(files, 3, upload, refreshAllowance),
    ).resolves.toEqual({
      ok: false,
      message: "Uploaded 1 PDF, then stopped: Second PDF could not be read.",
      uploaded: 1,
    });
    expect(refreshAllowance).toHaveBeenCalledOnce();
    expect(refreshAllowance).toHaveBeenCalledWith(1);
  });
});
