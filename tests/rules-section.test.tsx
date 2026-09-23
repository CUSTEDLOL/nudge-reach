import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/app/(app)/agent/rules-actions", () => ({
  createRuleAction: vi.fn(),
  updateRuleAction: vi.fn(),
  archiveRuleAction: vi.fn(),
  restoreRuleAction: vi.fn(),
}));

import { RulesSection } from "@/app/(app)/agent/rules-section";
import {
  MAX_ACTIVE_RULES,
  describeRule,
  type RuleListItem,
} from "@/modules/agent/rules";

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

  /**
   * The page and the prompt now share one test for "already says its scope"
   * (`opensWithItsScope`). They were two copies: this page suppressed the bold
   * lead-in at 5ae7f18 while `describeRule` — the instruction `distillRule`
   * falls back to on the whole keyless path — kept its prefix, so a row that
   * read correctly here still reached the model doubled.
   */
  it("agrees with the line the prompt carries, opener by opener", () => {
    for (const text of [...NEVER_OPENERS, "quote a price over chat"]) {
      const suppressedOnThePage = !row("never", text).includes(`${BOLD}Never</span>`);
      const suppressedInThePrompt = describeRule({ scope: "never", text }) === text;
      expect(suppressedOnThePage).toBe(suppressedInThePrompt);
    }
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

/**
 * Archiving is the only way a rule leaves the list, and `migrateProfileToRules`
 * files every legacy line past the cap the same way (4a69dae) — so before this
 * disclosure existed the owner's own words sat in a table no screen read: 19
 * archived rules on one production org, unreachable.
 */
describe("archived rules", () => {
  const archived = (n: number): RuleListItem[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `arch_${i}`,
      scope: "never" as const,
      text: `archived rule ${i}`,
      condition: null,
    }));

  function renderWithArchive(
    rules: RuleListItem[],
    archivedRules: RuleListItem[],
    over: { canEdit?: boolean; archivedTruncated?: boolean } = {},
  ) {
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(RulesSection, {
          rules,
          archived: archivedRules,
          canEdit: true,
          limit: MAX_ACTIVE_RULES.full,
          ...over,
        }),
      ),
    );
  }

  const live: RuleListItem[] = [
    { id: "r1", scope: "always", text: "send the booking link first", condition: null },
  ];

  it("is absent entirely when nothing is archived", () => {
    const html = renderWithArchive(live, []);

    expect(html).not.toContain("<details");
    expect(html).not.toContain("archived");
    expect(html).not.toContain("Restore");
  });

  it("collapses the archive behind a count and lists a Restore per rule", () => {
    const html = renderWithArchive(live, archived(3));

    expect(html).toContain("<details");
    // Collapsed by default: `<details>` carries no `open` attribute.
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    expect(html).toContain("3");
    expect(html).toContain("archived");
    expect(html).toContain("archived rule 0");
    expect(html).toContain("archived rule 2");
    expect([...html.matchAll(/Restore</g)]).toHaveLength(3);
    // The live list's own grammar, not a new pattern.
    expect(html).toContain('class="divide-y divide-neutral-100"');
  });

  it("says the count is a floor when the page read more than it shows", () => {
    const html = renderWithArchive(live, archived(2), { archivedTruncated: true });

    expect(html).toContain("2+");
    expect(html).toContain("Showing the first 2.");
  });

  it("shows a member who cannot edit the archive without a way to restore", () => {
    const html = renderWithArchive(live, archived(2), { canEdit: false });

    expect(html).toContain("archived rule 0");
    expect(html).not.toContain("Restore");
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
