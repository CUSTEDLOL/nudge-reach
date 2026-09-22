import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

const { refresh, actions, ruleActions, profileActions } = vi.hoisted(() => ({
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
  ruleActions: {
    createRuleAction: vi.fn(),
    updateRuleAction: vi.fn(),
    archiveRuleAction: vi.fn(),
    reorderRulesAction: vi.fn(),
  },
  profileActions: {
    saveBusinessBasicsAction: vi.fn(),
    saveAgentProfileAction: vi.fn(),
    enableAgentAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@/app/(app)/agent/training-actions", () => actions);
vi.mock("@/app/(app)/agent/rules-actions", () => ruleActions);
vi.mock("@/app/(app)/agent/setup-actions", () => profileActions);

import {
  TrialTraining,
  TrialTrainingHeader,
} from "@/components/features/trial/trial-training";
import { BusinessSection } from "@/app/(app)/agent/business-section";
import { RulesSection } from "@/app/(app)/agent/rules-section";
import { uploadTrialPdfFiles } from "@/components/features/trial/trial-knowledge-sources";
import { Library } from "@/app/(app)/agent/library";
import { MAX_ACTIVE_RULES, type RuleListItem } from "@/modules/agent/rules";
import { VERTICALS } from "@/modules/dashboard/verticals";
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

/**
 * What the trial must never do is ASSUME its visitor is a clinic — "we help
 * clinics book patients" in a heading, a hint or a placeholder. The shared
 * business-type picker is the one exemption: it renders the canonical
 * taxonomy (`modules/dashboard/verticals.ts`), whose health option is a value
 * an owner chooses, not a claim the page makes about them. Founder decision
 * 2026-09-22 — the beachhead IS clinics, and that option is what maps them to
 * the curated `VERTICAL_TEMPLATES` entry instead of the generic scope.
 *
 * So the ban is asserted on everything outside a `<select>`, which keeps it
 * biting on every word of trial prose.
 */
function trialProse(html: string): string {
  return html.replace(/<select\b[^>]*>[\s\S]*?<\/select>/gi, "");
}

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

/**
 * The trial and the paid app now render the SAME three sections — your
 * business, house rules, what it knows — so the trial's page is asserted the
 * way it is composed: the trial's own header and knowledge body around the two
 * shared sections.
 */
function renderTraining(
  current: TrialWorkspace,
  facts = current.approvedFactCount > 0 ? [activeFact] : [],
  drafts = current.draftFactCount > 0 ? [draft] : [],
  rules: RuleListItem[] = [],
  business = { businessName: "", vertical: "", tone: "" },
) {
  return renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(TrialTrainingHeader, { workspace: current }),
      createElement(BusinessSection, { ...business, canEdit: true }),
      createElement(RulesSection, {
        rules,
        canEdit: true,
        limit: MAX_ACTIVE_RULES.trial,
      }),
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
    expect(trialProse(html)).not.toMatch(/clinic|patient/i);
  });

  it("keeps the clinic ban biting on trial prose outside the picker", () => {
    // The guard itself, guarded: a heading that assumed the visitor runs a
    // clinic is still caught, and only the option list is exempt.
    expect(
      trialProse("<h2>We help clinics book more patients</h2>"),
    ).toMatch(/clinic|patient/i);
    expect(
      trialProse(
        '<select id="business-vertical"><option value="clinic">Clinic / Health</option></select>',
      ),
    ).not.toMatch(/clinic|patient/i);
  });

  it("puts the two shared sections above the knowledge the trial already had", () => {
    const html = renderTraining(workspace);

    expect(html).toContain("Your business");
    expect(html).toContain("House rules");
    // Behaviour first, then facts — the order the page renders them in.
    expect(html.indexOf("Your business")).toBeLessThan(
      html.indexOf("House rules"),
    );
    expect(html.indexOf("House rules")).toBeLessThan(
      html.indexOf("Approved facts"),
    );
    // Rules are counted on their own; the fact counter is untouched.
    expect(html).toContain("0 of 5");
    expect(html).toContain("Facts 0/50");
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

  it("loads business, rules and both fact states for one page with no trial fork", () => {
    const agentPage = readFileSync("src/app/(app)/agent/page.tsx", "utf8");
    const sources = readFileSync(
      "src/components/features/trial/trial-knowledge-sources.tsx",
      "utf8",
    );

    expect(agentPage).toContain('status: "active"');
    expect(agentPage).toContain('status: "draft"');
    expect(agentPage).toContain("workspace={trial}");
    expect(agentPage).toContain("drafts={");
    expect(agentPage).toContain("<BusinessSection");
    expect(agentPage).toContain("<RulesSection");
    // The trial's tour step for Training anchors here; nothing rendered it
    // before, so the step showed "This area is still loading".
    expect(agentPage).toContain('data-tour="training-source"');
    // The fork that gave the trial a different page is gone.
    expect(agentPage).not.toContain("if (trial && !trial.converted)");
    expect(sources).toContain("router.refresh()");
    expect(sources).not.toContain("router.push");
  });
});

describe("house rules section", () => {
  const rule = (over: Partial<RuleListItem> = {}): RuleListItem => ({
    id: "rule_1",
    text: "push everyone to join the waitlist at https://getgutfeeling.in/",
    scope: "always",
    condition: null,
    ...over,
  });

  function renderRules(
    rules: RuleListItem[],
    limit: number = MAX_ACTIVE_RULES.full,
  ) {
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(RulesSection, { rules, canEdit: true, limit }),
      ),
    );
  }

  it("shows each rule in the owner's own words, never the distilled line", () => {
    const html = renderRules([
      rule(),
      rule({ id: "rule_2", scope: "never", text: "quote a price over chat" }),
      rule({
        id: "rule_3",
        scope: "when",
        condition: "someone asks about pricing",
        text: "offer a consultation instead",
      }),
    ]);

    expect(html).toContain(
      "Always: push everyone to join the waitlist at https://getgutfeeling.in/",
    );
    expect(html).toContain("Never: quote a price over chat");
    expect(html).toContain(
      "When someone asks about pricing: offer a consultation instead",
    );
    expect(html).toContain("3 of 20");
  });

  it("nudges on quality once the list gets long, without blocking", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      rule({ id: `rule_${i}`, text: `rule number ${i}` }),
    );
    const html = renderRules(many);

    expect(html).toContain(
      "10 of 20 · the more rules you add, the less reliably the AI follows each one.",
    );
    // A nudge, not a cap: there is still room, so the add form stays usable.
    expect(html).not.toContain("Rule limit reached");
    expect(html).not.toMatch(/id="rule-text"[^>]*disabled/);
  });

  it("says plainly when the list is full instead of failing on save", () => {
    const full = Array.from({ length: 5 }, (_, i) =>
      rule({ id: `rule_${i}`, text: `rule number ${i}` }),
    );
    const html = renderRules(full, MAX_ACTIVE_RULES.trial);

    expect(html).toContain("5 of 5");
    expect(html).toContain("Rule limit reached (5/5)");
    expect(html).toMatch(/id="rule-text"[^>]*disabled/);
  });

  it("hides the authoring controls from a member who cannot edit", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(RulesSection, {
          rules: [rule()],
          canEdit: false,
          limit: MAX_ACTIVE_RULES.full,
        }),
      ),
    );

    expect(html).toContain("Always: push everyone");
    expect(html).not.toContain('id="rule-text"');
    expect(html).not.toContain("Add rule");
  });
});

describe("your business section", () => {
  function renderBusiness(
    initial: { businessName: string; vertical: string; tone: string },
    canEdit = true,
  ) {
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(BusinessSection, { ...initial, canEdit }),
      ),
    );
  }

  it("collapses to one line once the business has a name", () => {
    const html = renderBusiness({
      businessName: "Spice Garden",
      vertical: "restaurant",
      tone: "Warm, friendly, and concise",
    });

    expect(html).toContain("Spice Garden");
    // The taxonomy's own label, so the summary reads back what was picked.
    expect(html).toContain("Restaurant / Café");
    expect(html).toContain("Warm, friendly, and concise");
    // Collapsed means collapsed: no form in the markup at all.
    expect(html).not.toContain('id="business-name"');
    expect(html).toContain("Edit");
  });

  it("opens itself when there is nothing saved yet", () => {
    const html = renderBusiness({ businessName: "", vertical: "", tone: "" });

    expect(html).toContain('id="business-name"');
    expect(html).toContain('id="business-vertical"');
    expect(html).toContain('id="business-tone"');
    expect(html).toContain("Save");
    // The section's own words name no industry; the picker's option list is
    // the taxonomy, and is exempt (see `trialProse`).
    expect(trialProse(html)).not.toMatch(/clinic|patient/i);
  });

  it("offers the canonical business types, health included", () => {
    const html = renderBusiness({ businessName: "", vertical: "", tone: "" });

    for (const v of VERTICALS) {
      expect(html).toContain(`value="${v.value}"`);
      // "Home & Decor" reaches the browser as "Home &amp; Decor".
      expect(html).toContain(v.label.replace(/&/g, "&amp;"));
    }
    // The value the beachhead needs: it is what maps to the curated template.
    expect(html).toContain('value="clinic"');
  });

  it("keeps a vertical that predates the list rather than silently relabelling it", () => {
    // "software" is a curated template but not an onboarding option. A select
    // with no matching option submits its first one, so the stored value is
    // offered explicitly — saving must not turn a software business into a
    // boutique behind the owner's back.
    const html = renderBusiness({
      businessName: "",
      vertical: "software",
      tone: "",
    });

    expect(html).toContain('value="software"');
  });

  it("shows a read-only summary to a member who cannot edit", () => {
    const html = renderBusiness(
      { businessName: "Spice Garden", vertical: "restaurant", tone: "Warm" },
      false,
    );

    expect(html).toContain("Spice Garden");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain('id="business-name"');
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
