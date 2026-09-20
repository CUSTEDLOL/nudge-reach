import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/automations/page.tsx", "utf8");
const bar = readFileSync("src/app/(app)/automations/follow-up-bar.tsx", "utf8");
const card = readFileSync("src/app/(app)/automations/follow-up-card.tsx", "utf8");
const rows = readFileSync("src/app/(app)/automations/follow-up-rows.tsx", "utf8");

/**
 * Source assertions, the repo's pattern for pages that need a database and a
 * session to render. They guard the two regressions this page has had: the
 * builder being stranded at an unlinked URL, and the same follow-up appearing
 * twice under two different headings.
 */
describe("follow-ups page", () => {
  it("leads with the natural-language bar and the starter-set CTA", () => {
    expect(page).toContain("<FollowUpBar");
    expect(bar).toContain("draftFollowUpAction");
    expect(bar).toContain("createFollowUpAction");
    expect(bar).toContain("writeStarterSetAction");
  });

  it("shows every follow-up as one card list — no pack/builder split", () => {
    expect(page).toContain("<FollowUpCard");
    expect(page).not.toContain("AutomationsList");
    expect(page).not.toContain("Follow-ups you build yourself");
  });

  it("each card explains the situation in plain English and links to the builder", () => {
    expect(card).toContain("describeSituation");
    expect(card).toContain("describeMessageTiming");
    expect(card).toContain("/automations/${");
  });

  it("keeps the builder reachable and is honest about the nightly run", () => {
    expect(page).toContain('href="/automations/new"');
    expect(page).toMatch(/nightly run/i);
    expect(page).toContain("handed to a teammate");
  });

  it("keeps the tick-driven appointment rows, with their hour fields", () => {
    expect(page).toContain("<FollowUpRows");
    expect(page).toContain("FOLLOW_UP_KINDS");
    expect(page).toContain("paused={!config?.enabled}");
    expect(rows).toContain("setFollowUpTimingAction");
    expect(rows).toContain("setFollowUpFlagAction");
  });

  it("renders a hand-built follow-up as itself: trigger label, step count, no inline edit", () => {
    expect(card).toContain("When: ${model.triggerLabel}");
    expect(card).toContain("built in the editor");
    // The plain-English message list and the inline editor exist only when the
    // automation still has a spec — a builder edit nulls it.
    expect(card).toContain("model.spec && !editing");
    expect(card).toContain("Open in builder");
  });

  it("never shows a paused follow-up as waiting on Meta", () => {
    // Order matters: a rejection is always worth surfacing, but an off
    // follow-up reads "Off" rather than contradicting its own switch.
    expect(card).toMatch(/REJECTED[\s\S]{0,300}!m\.enabled[\s\S]{0,300}APPROVED/);
  });

  it("re-renders from the spec the server stored, not the one submitted", () => {
    expect(card).toContain("r.ok && r.spec");
  });

  it("offers the starter set until there is an AI-written follow-up, and once per session", () => {
    expect(bar).toContain("Write my starter set (about 3–5 AI credits)");
    expect(bar).toContain("hasSpecFollowUps");
    expect(bar).toContain("setDone(true)");
    expect(page).toMatch(/hasSpecFollowUps=\{cards\.some/);
  });
});
