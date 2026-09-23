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

/**
 * `migrateProfileToRules` stores the owner's sentence verbatim, and an owner
 * writing a do-not writes one: "Do not invent features…", "Always record the
 * lead…". Leading those with the bold scope word read as a doubled negative —
 * "**Never** Do not invent features…" — for 10 of the 26 rules in production.
 *
 * The lead-in is suppressed when the text opens with its own scope word, and
 * only then: the stored scope is unchanged and the editor's Select still shows
 * it.
 */
describe("a rule that already says its own scope", () => {
  const row = (scope: "always" | "never", text: string) =>
    render([{ id: "r1", scope, text, condition: null }]);

  const NEVER_OPENERS = [
    "Never quote a price over chat",
    "Do not invent features we do not offer",
    "Don't promise a delivery date",
    "Don’t promise a delivery date",
    "Avoid medical advice of any kind",
    "Under no circumstances share a customer's number",
  ];

  for (const text of NEVER_OPENERS) {
    it(`drops the lead-in for a never rule opening “${text.split(" ")[0]}”`, () => {
      const html = row("never", text);
      expect(html).not.toContain(`${BOLD}Never</span>`);
      expect(html).toContain(text.replace(/'/g, "&#x27;"));
    });
  }

  it("keeps the lead-in for a never rule that does not say it", () => {
    const html = row("never", "quote a price over chat");
    expect(html).toContain(`${BOLD}Never</span> quote a price over chat`);
  });

  it("drops the lead-in for an always rule opening “Always”", () => {
    const html = row("always", "Always record the lead in the sheet");
    expect(html).not.toContain(`${BOLD}Always</span>`);
    expect(html).toContain("Always record the lead in the sheet");
  });

  it("keeps the lead-in for an always rule that does not say it", () => {
    const html = row("always", "send the booking link first");
    expect(html).toContain(`${BOLD}Always</span> send the booking link first`);
  });

  it("matches only at the start, and only on a whole word", () => {
    // "Avoidable" is not "avoid", and a scope word mid-sentence says nothing
    // about how the row reads.
    expect(row("never", "Avoidable delays annoy customers")).toContain(
      `${BOLD}Never</span> Avoidable delays annoy customers`,
    );
    expect(row("never", "Tell them we never discount")).toContain(
      `${BOLD}Never</span> Tell them we never discount`,
    );
    expect(row("always", "Reply as we always do, within the hour")).toContain(
      `${BOLD}Always</span> Reply as we always do, within the hour`,
    );
  });

  it("leaves a when rule alone even when its text opens with a scope word", () => {
    const html = render([
      {
        id: "r1",
        scope: "when",
        text: "never quote a figure",
        condition: "someone asks about pricing",
      },
    ]);
    expect(html).toContain(
      `${BOLD}When someone asks about pricing,</span> never quote a figure`,
    );
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
