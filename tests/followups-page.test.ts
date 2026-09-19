import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/automations/page.tsx", "utf8");
const rows = readFileSync("src/app/(app)/automations/follow-up-rows.tsx", "utf8");

/**
 * Guards a real regression: the automations list and its "new" button were once
 * deleted from this page, which stranded the working builder at an unlinked URL
 * and left the installed pack invisible and uneditable.
 */
describe("follow-ups page", () => {
  it("keeps the builder reachable", () => {
    expect(page).toContain('href="/automations/new"');
    expect(page).toContain("New follow-up");
  });

  it("lists the org's own follow-ups, not just the installed pack", () => {
    expect(page).toContain("AutomationsList");
    expect(page).toContain("prisma.automation.findMany");
  });

  it("shows what the pack runs, each with its own switch", () => {
    expect(page).toContain("FOLLOW_UP_KINDS");
    expect(page).toContain("FollowUpRows");
    expect(rows).toContain("setFollowUpFlagAction");
  });

  it("links every follow-up to the template whose wording it sends", () => {
    expect(rows).toContain("/templates/${t.id}?from=followups");
  });

  it("shows the pack's automation once, not in both sections", () => {
    expect(page).toContain("a.name !== LEAD_NUDGE_NAME");
  });

  it("lets the owner set when the time-based follow-ups fire", () => {
    expect(rows).toContain("setFollowUpTimingAction");
    expect(page).toContain("normalizeTiming");
  });
});
