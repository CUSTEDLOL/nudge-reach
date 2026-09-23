import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("next/navigation", () => ({
  usePathname: () => "/agent",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(app)/agent/training-actions", () => ({
  addFactAction: vi.fn(),
  archiveFactAction: vi.fn(),
  archiveFactsAction: vi.fn(),
  updateFactAction: vi.fn(),
  structureExistingInfoAction: vi.fn(),
}));

import { FrontDeskTabs } from "@/app/(app)/agent/front-desk-tabs";
import { Library, type LibraryFact } from "@/app/(app)/agent/library";

/**
 * The two-column Training page (founder, 2026-09-23): rules and facts on the
 * left, the business and the import box in a rail on the right — and the
 * rail FIRST in the DOM, so a phone shows the PDF upload above the facts
 * instead of below all of them.
 */
describe("Training page columns", () => {
  const page = readFileSync("src/app/(app)/agent/page.tsx", "utf8");

  it("puts the rail before the left column in the DOM and orders it last on desktop", () => {
    const aside = page.indexOf("<aside");
    expect(aside).toBeGreaterThan(-1);
    const tag = page.slice(aside, page.indexOf(">", aside));
    expect(tag).toContain("lg:order-last");
    expect(tag).toContain('aria-label="Business and sources"');

    // The rail holds the business and the sources; the columns come after it.
    const railEnd = page.indexOf("</aside>");
    expect(page.indexOf("<BusinessSection")).toBeGreaterThan(aside);
    expect(page.indexOf("<ImportPanel")).toBeGreaterThan(aside);
    expect(page.indexOf("<ImportPanel")).toBeLessThan(railEnd);
    // Both kinds of workspace, one place: the trial's website/Google/PDF box
    // is the rail's too, where the paid page puts ImportPanel. It used to sit
    // in the left column inside TrialTraining, under the facts.
    expect(page.indexOf("<TrialKnowledgeSources")).toBeGreaterThan(aside);
    expect(page.indexOf("<TrialKnowledgeSources")).toBeLessThan(railEnd);
    expect(page.indexOf("<RulesSection")).toBeGreaterThan(railEnd);
    // `<TrialTraining ` and not `<TrialTrainingHeader`, which is in the header.
    expect(page.search(/<TrialTraining\s/)).toBeGreaterThan(railEnd);

    expect(page).toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
    expect(page).not.toContain("max-w-3xl");
  });

  /**
   * The page is a server component with six Prisma reads, so its queries are
   * pinned on the source. Archived rules had no reader at all: `4a69dae` and
   * `2643237` began writing over-cap migration lines as `archived` rather than
   * dropping them, and nothing surfaced them until the restore disclosure.
   */
  it("reads the archived rules the restore disclosure needs, bounded", () => {
    expect(page).toContain('status: "archived"');
    // One more than it shows, so "N+" is measured rather than guessed — and a
    // `take`, so this can never become a second unbounded query.
    expect(page).toContain("MAX_ARCHIVED_RULES_SHOWN + 1");
    expect(page).toContain("archived={archivedRules}");
    expect(page).toContain("archivedTruncated={archivedTruncated}");
  });

  it("keeps auto-reply and Try it in chat together in the header, in that order", () => {
    const header = page.indexOf("<PageHeader");
    const switchAt = page.indexOf("<AutoReplySwitch />");
    const tryAt = page.indexOf("Try it in chat");
    expect(switchAt).toBeGreaterThan(header);
    expect(tryAt).toBeGreaterThan(switchAt);
  });
});

describe("Front Desk tab strip", () => {
  it("shows only where the sidebar does not", () => {
    const html = renderToStaticMarkup(createElement(FrontDeskTabs));

    expect(html).toMatch(/<nav[^>]*class="[^"]*lg:hidden/);
    expect(html).toContain(">Training<");
    expect(html).toContain(">Voice<");
    expect(html).toContain(">Actions<");
    expect(html).toMatch(/aria-current="page"[^>]*>Training</);
  });
});

describe("fact list", () => {
  const fact: LibraryFact = {
    id: "fact_1",
    category: "hours",
    fact: "Open Monday to Friday, 9 AM to 5 PM",
    condition: null,
    source: "manual",
  };

  function render(facts: LibraryFact[], canEdit = true) {
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(Library, { facts, canEdit, showStructureButton: false }),
      ),
    );
  }

  it("renders rows as a divided list with no border of their own", () => {
    const html = render([fact]);

    expect(html).toContain('class="divide-y divide-neutral-100"');
    const rows = [...html.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1]);
    expect(rows).toHaveLength(1);
    for (const cls of rows) {
      expect(cls).not.toMatch(/\bborder/);
      expect(cls).not.toMatch(/\brounded/);
    }
  });

  /** Same clipping as the rules list: a `Card` with `overflow-hidden` around a
   *  fact whose URL is one unbreakable word. */
  it("wraps a fact carrying a long URL instead of clipping it", () => {
    const html = render([
      {
        ...fact,
        fact: "Join the waitlist at https://getgutfeeling.in/waitlist-signup",
      },
    ]);

    const row = html.match(/<p class="([^"]*)"[^>]*>[^<]*getgutfeeling/)?.[1];
    expect(row).toBeDefined();
    expect(row).toContain("break-words");
  });

  it("opens the add form only while there are no facts", () => {
    const empty = render([]);
    expect(empty).toContain('id="kf-fact"');
    expect(empty).toContain("Cancel");
    expect(empty).toContain("No knowledge yet");

    const one = render([fact]);
    expect(one).not.toContain('id="kf-fact"');
    expect(one).toContain("Add fact");

    // A member who cannot edit gets neither the form nor the button.
    const readOnly = render([fact], false);
    expect(readOnly).not.toContain('id="kf-fact"');
    expect(readOnly).not.toContain("Add fact");
  });
});
