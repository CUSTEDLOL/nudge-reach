import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/app/(app)/agent/rules-actions", () => ({
  createRuleAction: vi.fn(),
  updateRuleAction: vi.fn(),
  archiveRuleAction: vi.fn(),
}));

import { RulesSection } from "@/app/(app)/agent/rules-section";
import { MAX_ACTIVE_RULES, type RuleListItem } from "@/modules/agent/rules";

const BOLD = '<span class="font-semibold text-neutral-900">';

function render(rules: RuleListItem[], canEdit = true) {
  return renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(RulesSection, {
        rules,
        canEdit,
        limit: MAX_ACTIVE_RULES.full,
      }),
    ),
  );
}

describe("house rules rows", () => {
  it("reads each row as a sentence: the scope in bold, the owner's words plain", () => {
    const html = render([
      { id: "r1", scope: "never", text: "quote a price over chat", condition: null },
      {
        id: "r2",
        scope: "when",
        text: "say call us",
        condition: "someone asks about pricing",
      },
      { id: "r3", scope: "always", text: "send the booking link first", condition: null },
      // A "when" rule with no condition can only come from a bad migration;
      // it shows its text alone rather than claiming a scope it lacks.
      { id: "r4", scope: "when", text: "just the text", condition: null },
    ]);

    expect(html).toContain(`${BOLD}Never</span> quote a price over chat`);
    expect(html).toContain(
      `${BOLD}When someone asks about pricing,</span> say call us`,
    );
    expect(html).toContain(`${BOLD}Always</span> send the booking link first`);
    expect(html).toContain(">just the text<");
    // The distilled "Never: …" line is the prompt's, never the page's.
    expect(html).not.toContain("Never:");
    expect(html).not.toContain("pricing:");
  });
});

describe("house rules add form", () => {
  it("opens itself only while there are no rules, with two examples underneath", () => {
    const empty = render([]);
    expect(empty).toContain('id="rule-text"');
    expect(empty).toContain("Cancel");
    expect(empty).toContain(
      "Try: “always send the booking link first”, “never quote a price over chat”.",
    );
    // No box and no empty-state card: the open form is the whole section.
    expect(empty).not.toContain("<ul");

    const one = render([
      { id: "r1", scope: "always", text: "send the booking link first", condition: null },
    ]);
    expect(one).not.toContain('id="rule-text"');
    expect(one).toContain("Add rule");
    expect(one).toContain("1 of 20");
    expect(one).toContain("Rules win over facts.");
    expect(one).not.toContain("Try:");
  });
});
