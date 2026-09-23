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
import LoadingTraining from "@/app/(app)/agent/loading";

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

/**
 * The skeleton is what the owner sees first, so it has to be the shape the
 * page resolves into. It was `LoadingKnowledge` — one full-width column of
 * stacked cards, the pre-House-Rules layout — against a page that is now two
 * columns with a 340px rail, so the content slid sideways on first paint.
 */
describe("Training loading skeleton", () => {
  const page = readFileSync("src/app/(app)/agent/page.tsx", "utf8");

  it("holds the same grid and rail order the page resolves into", () => {
    const html = renderToStaticMarkup(createElement(LoadingTraining));

    const grid = "lg:grid-cols-[minmax(0,1fr)_340px]";
    expect(html).toContain(grid);
    expect(page).toContain(grid);
    // The rail is first in the DOM and ordered last on desktop, exactly as the
    // page does it — otherwise the phone stack flips between the two.
    expect(html).toContain("lg:order-last");
    expect(html.indexOf("lg:order-last")).toBeLessThan(html.lastIndexOf("rounded-2xl"));
    expect(html).toContain('aria-busy="true"');
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

  function renderWithLimit(facts: LibraryFact[], factCount: number, factLimit: number) {
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(Library, {
          facts,
          canEdit: true,
          showStructureButton: false,
          factCount,
          factLimit,
        }),
      ),
    );
  }

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

  /**
   * Manage / Fact sheet are a tab pair drawn as bare `<button>`s, so they get
   * none of what `buttonVariants` gives a `Button`. Without `aria-pressed` the
   * chosen view is a dark pill and nothing else — inaudible to a screen reader
   * and invisible to an owner who cannot tell the two greys apart.
   */
  it("says which view is chosen, and can be seen taking focus", () => {
    const html = render([fact]);

    // Exactly two, so the pair hoisted above the `view === "sheet"` return
    // cannot quietly become two copies again.
    const tabs = [
      ...html.matchAll(/<button[^>]*>\s*<svg[^>]*>[\s\S]*?<\/svg>\s*(Manage|Fact sheet)/g),
    ];
    expect(tabs.map((m) => m[1])).toEqual(["Manage", "Fact sheet"]);
    const manage = html.match(/<button([^>]*)>(?:(?!<button)[\s\S])*?Manage/)?.[1] ?? "";
    const sheet = html.match(/<button([^>]*)>(?:(?!<button)[\s\S])*?Fact sheet/)?.[1] ?? "";
    expect(manage).toContain('aria-pressed="true"');
    expect(sheet).toContain('aria-pressed="false"');
    for (const tag of [manage, sheet]) expect(tag).toContain("focus-visible:ring-2");
  });

  it("says whether a category is fully selected, on a checkbox it drew by hand", () => {
    const html = render([fact]);

    const box = html.match(/<button([^>]*aria-label="Select all in [^"]*"[^>]*)>/)?.[1];
    expect(box).toBeDefined();
    expect(box).toContain('aria-pressed="false"');
    expect(box).toContain("focus-visible:ring-2");
  });

  /**
   * The fact-limit line is a live region. It used to be rendered only once the
   * cap was hit — and a live region that appears at the moment it has something
   * to say is not announced, because assistive tech has nothing to diff it
   * against. It is always in the DOM now and its TEXT changes, which is the
   * shape the rules section's counter already used.
   */
  it("keeps the fact-limit live region mounted before the cap is reached", () => {
    const under = renderWithLimit([fact], 1, 50);
    expect(under).toContain('role="status"');
    expect(under).not.toContain("Fact limit reached");

    const at = renderWithLimit([fact], 50, 50);
    expect(at).toContain('role="status"');
    expect(at).toContain("Fact limit reached (50/50)");
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
