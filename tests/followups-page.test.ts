import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statusOf } from "@/app/(app)/automations/follow-up-card";

const page = readFileSync("src/app/(app)/automations/page.tsx", "utf8");
const bar = readFileSync("src/app/(app)/automations/follow-up-bar.tsx", "utf8");
const card = readFileSync("src/app/(app)/automations/follow-up-card.tsx", "utf8");
const rows = readFileSync("src/app/(app)/automations/follow-up-rows.tsx", "utf8");

/**
 * Source assertions, the repo's pattern for pages that need a database and a
 * session to render. They guard the regressions this page has had: the builder
 * stranded at an unlinked URL, the same follow-up listed twice, a plan-locked
 * org left staring at an empty page, and a pause nobody could undo.
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

  it("keeps the builder reachable and is honest about when messages send", () => {
    expect(page).toContain('href="/automations/new"');
    // Four of the five situations fire inline; only chained waits wait.
    expect(page).toContain("goes out straight away");
    expect(page).toContain("next daily run");
    expect(page).not.toMatch(/nightly/i);
    // Scoped to the chase: reminders don't check conversation status.
    expect(page).toContain("handed to a teammate");
  });

  it("keeps the tick-driven appointment rows, with their hour fields", () => {
    expect(page).toContain("<FollowUpRows");
    expect(page).toContain("FOLLOW_UP_KINDS");
    expect(page).toContain("paused={!config?.enabled}");
    expect(rows).toContain("setFollowUpTimingAction");
    expect(rows).toContain("setFollowUpFlagAction");
  });

  it("explains a paused pack and leaves the row switches live to undo it", () => {
    expect(page).toContain("config && !config.enabled");
    expect(page).toContain(
      "Your follow-ups are paused. Switch any one back on to resume them."
    );
    // The switch must not be disabled by `paused` — that was the dead end.
    expect(rows).toContain("disabled={!canManage || pending}");
    // The hour fields stay disabled: they are not a way out.
    expect(rows).toContain("canManage={canManage && !paused}");
  });

  it("renders a hand-built follow-up as itself: trigger label, step count, no inline edit", () => {
    expect(card).toContain("When: ${model.triggerLabel}");
    expect(card).toContain("built in the editor");
    expect(card).toContain("model.spec && !editing");
    expect(card).toContain("Open in builder");
  });

  it("re-renders from the spec the server stored, not the one submitted", () => {
    expect(card).toContain("r.ok && r.spec");
  });

  it("says a booked follow-up is timed from the booking, not the appointment", () => {
    expect(card).toContain('model.spec?.situation.kind === "booked"');
    expect(card).toContain("Timed from when they book");
    expect(card).toContain("use Appointment reminders above");
  });

  it("links the templates Meta has not approved, so a rejection isn't a dead end", () => {
    expect(card).toContain("/templates/${t.id}?from=followups");
    expect(card).toContain('t.status !== "APPROVED"');
    expect(page).toContain("name: true");
  });

  it("offers the starter set until there is an AI-written follow-up, and once per session", () => {
    expect(bar).toContain("Write my starter set");
    expect(bar).toContain("Uses about 5 AI credits");
    expect(bar).toContain("hasSpecFollowUps");
    expect(bar).toContain("setDone(true)");
    expect(page).toMatch(/hasSpecFollowUps=\{cards\.some/);
  });

  it("uses separate transitions so the starter set doesn't spin Draft it", () => {
    expect(bar).toContain("startDraft");
    expect(bar).toContain("startStarter");
  });

  it("lists newest-last by creation, not enabled-first", () => {
    expect(page).toContain('orderBy: { createdAt: "asc" }');
    expect(page).not.toContain('enabled: "desc"');
  });
});

/**
 * A plan without AI Front Desk still reaches this page (Free, Entry and
 * Starter all get automations). The bar is the only thing above the list, so
 * it must explain the lock rather than vanish.
 */
describe("follow-ups page without AI Front Desk", () => {
  it("renders the bar locked, with an upgrade path and the honest fallback", () => {
    expect(bar).toContain("hasFrontDesk");
    expect(bar).toContain("if (!hasFrontDesk)");
    expect(bar).toContain(
      "Describe a follow-up in plain English and the AI writes it."
    );
    expect(bar).toContain(
      "Available from the Growth plan — upgrade in Settings → Billing."
    );
    expect(bar).toContain("You can still build one by hand.");
  });

  it("passes the role and the plan gate separately", () => {
    // The builder, the switches and delete are ADMIN-only, not plan-gated.
    expect(page).toContain("canManage={canManage}");
    expect(page).toContain("hasFrontDesk={hasFrontDesk}");
    // The tick rows' own actions ARE plan-gated, so they take both.
    expect(page).toContain("canManage={canManage && hasFrontDesk}");
  });

  it("never points the empty state at a control that isn't rendered", () => {
    expect(page).toContain("Build your first one by hand");
    expect(page).toContain("An admin can set them up");
  });
});

/**
 * The chip sits beside the switch, so it must never contradict it. Every
 * freshly created follow-up lands off with pending templates.
 */
describe("statusOf", () => {
  it("surfaces a rejection even when the follow-up is off", () => {
    expect(
      statusOf({ enabled: false, templates: [{ status: "REJECTED" }] })
    ).toEqual({ label: "Rejected by Meta", tone: "danger" });
  });

  it("reads Off when it is off, not Waiting for Meta", () => {
    expect(
      statusOf({ enabled: false, templates: [{ status: "APPROVED" }] })
    ).toEqual({ label: "Off", tone: "neutral" });
    expect(
      statusOf({ enabled: false, templates: [{ status: "PENDING" }] })
    ).toEqual({ label: "Off", tone: "neutral" });
  });

  it("warns only when it is on and Meta hasn't approved yet", () => {
    expect(
      statusOf({ enabled: true, templates: [{ status: "PENDING" }] })
    ).toEqual({ label: "Waiting for Meta", tone: "warning" });
  });

  it("reads On when it is on and nothing is waiting", () => {
    expect(statusOf({ enabled: true, templates: [] })).toEqual({
      label: "On",
      tone: "success",
    });
    expect(
      statusOf({ enabled: true, templates: [{ status: "APPROVED" }] })
    ).toEqual({ label: "On", tone: "success" });
  });
});
