import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dashboardRedirectFor,
  onboardingRedirectFor,
  type TrialWorkspace,
} from "@/modules/trial/workspace";

describe("Today page hierarchy", () => {
  /**
   * Still one vertical decision flow, with two changes made on 2026-09-16
   * after the founder said the product felt "hiddenish":
   *  - an unfinished workspace leads with its checklist instead of meeting
   *    five sections of zeros before reaching it, and hides Business pulse
   *    (every figure in it would be a zero, which reads as broken, not new);
   *  - "Jump back in" sits under the attention queue, so the jobs buried two
   *    levels down the sidebar are one click from Home.
   */
  it("composes the approved single vertical decision flow", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    const orderedComponents = [
      "<SetupProgress",
      "<AttentionQueueSection",
      "<QuickActions",
      "<OperationsSummary",
      "<FrontDeskSummary",
      "<BusinessPulse",
      "<RecentActivity",
    ];
    const positions = orderedComponents.map((name) => source.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("shows the checklist and the business pulse to opposite workspaces", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(source).toContain("const settingUp = !data.checklist.allDone");
    expect(source).toContain("{!isAgent && settingUp && (");
    expect(source).toContain("{!isAgent && !settingUp && (");
  });

  it("keeps direct Prisma calls out of the route", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("prisma.");
  });

  it("applies the member's chosen guidance level to dashboard explanations", () => {
    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(source).toContain(
      "showDescription={workspaceDefaults.showSectionDescriptions}"
    );
  });

  it("uses a loading state shaped like the vertical Today hierarchy", () => {
    const source = readFileSync("src/app/(app)/dashboard/loading.tsx", "utf8");
    expect(source).toContain('aria-label="Loading Today workspace"');
    expect(source).not.toContain("Array.from({ length: 8 })");
    expect(source).toContain("grid-cols-1");
  });
});

describe("acquisition-trial routing", () => {
  const trial = {
    setupComplete: false,
    knowledgeReady: false,
    converted: false,
  } as TrialWorkspace;

  it("lets an active acquisition trial reach its Inbox before knowledge is ready", () => {
    expect(dashboardRedirectFor(trial, true)).toBeNull();
    expect(onboardingRedirectFor(trial)).toBe("/trial/setup");
  });

  it("preserves paid onboarding and lets a trained trial reach its Inbox", () => {
    expect(dashboardRedirectFor(null, true)).toBe("/onboarding");
    expect(dashboardRedirectFor({ ...trial, setupComplete: true }, true)).toBeNull();
    expect(onboardingRedirectFor(null)).toBeNull();
  });

  it("branches to the trial Inbox before loading paid dashboard analytics", () => {
    const dashboard = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    const onboarding = readFileSync("src/app/(app)/onboarding/page.tsx", "utf8");
    const trialInbox = dashboard.indexOf("<TrialInbox");
    const paidDashboardQuery = dashboard.indexOf(
      "const data = await getDashboardData",
    );

    expect(trialInbox).toBeGreaterThan(-1);
    expect(paidDashboardQuery).toBeGreaterThan(-1);
    expect(trialInbox).toBeLessThan(paidDashboardQuery);
    expect(dashboard).not.toContain("<TrialHome");
    expect(layout).toContain("getTrialWorkspace(org.id)");
    expect(dashboard).toContain("getTrialWorkspace(org.id)");
    expect(dashboard).not.toContain("getTrialWorkspace(org.id, now)");
    expect(dashboard).toContain("dashboardRedirectFor");
    expect(dashboard).toContain("getTrialWorkspace");
    expect(onboarding).toContain("onboardingRedirectFor");
    expect(onboarding).toContain("getTrialWorkspace");
  });
});
