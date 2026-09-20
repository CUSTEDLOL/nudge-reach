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
    converted: false,
  } as TrialWorkspace;

  it("sends an unfinished acquisition trial to its short setup first", () => {
    expect(dashboardRedirectFor(trial, true)).toBe("/trial/setup");
    expect(onboardingRedirectFor(trial)).toBe("/trial/setup");
  });

  it("preserves paid onboarding and lets a finished trial reach Home", () => {
    expect(dashboardRedirectFor(null, true)).toBe("/onboarding");
    expect(dashboardRedirectFor({ ...trial, setupComplete: true }, true)).toBeNull();
    expect(onboardingRedirectFor(null)).toBeNull();
  });

  it("wires the pure decisions into both App Router pages", () => {
    const dashboard = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    const onboarding = readFileSync("src/app/(app)/onboarding/page.tsx", "utf8");
    expect(dashboard).toContain("dashboardRedirectFor");
    expect(dashboard).toContain("getTrialWorkspace");
    expect(onboarding).toContain("onboardingRedirectFor");
    expect(onboarding).toContain("getTrialWorkspace");
  });
});
