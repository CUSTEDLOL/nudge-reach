import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { shouldShowTrialTour } from "@/components/features/app-shell/shell";
import {
  TrialStatusStrip,
  trialStatusText,
} from "@/components/features/trial/trial-status-strip";
import { TRIAL_TOUR_STEPS } from "@/modules/trial/tour";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const trial: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  emailVerified: false,
  expiresAt: "2026-09-27T10:00:00.000Z",
  repliesUsed: 3,
  replyLimit: 15,
  repliesRemaining: 12,
  setupComplete: false,
  knowledgeSource: null,
  knowledgeReady: false,
  knowledgeCount: 0,
  approvedFactCount: 0,
  draftFactCount: 0,
  factCount: 0,
  factLimit: 50,
  webImportsUsed: 0,
  webImportLimit: 1,
  fileImportsUsed: 0,
  fileImportLimit: 3,
  firstReplyAt: null,
  exploreViewed: false,
  tourStep: "welcome",
  tourCompleted: false,
  tourDismissed: false,
  demoBooked: false,
  converted: false,
};

describe("inline trial guide", () => {
  const html = renderToStaticMarkup(
    createElement(TrialStatusStrip, { trial, email: "owner@example.com" }),
  );
  const guide = html.match(/<details\b[\s\S]*?<\/details>/)?.[0] ?? "";

  it("keeps the authoritative allowance beside a closed native disclosure", () => {
    expect(trialStatusText(trial)).toBe(
      "Free trial · 12 of 15 replies left · Ends 27 Sep",
    );
    expect(html).toContain("12 of 15 replies left");
    expect(html).toContain('aria-live="polite"');
    expect(guide).toContain("How to use this trial");
    expect(guide.match(/^<details\b[^>]*>/)?.[0]).not.toContain("open");
  });

  it("offers exactly three neutral steps", () => {
    expect(guide.match(/<li\b/g)).toHaveLength(3);
    expect(guide).toContain("Add business information");
    expect(guide).toContain("Ask a customer question");
    expect(guide).toContain("Review the reply");
    expect(guide.toLowerCase()).not.toMatch(/\b(?:clinics?|patients?)\b/);
  });

  it("uses native open and close behavior without blocking page interaction", () => {
    const stripSource = readFileSync(
      new URL(
        "../src/components/features/trial/trial-status-strip.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(stripSource).toContain("<details");
    expect(stripSource).not.toContain("onToggle");
    expect(guide).not.toContain("href=");
    // the strip itself is never a dialog — the guided tour owns that surface
    expect(html).not.toContain('role="dialog"');
  });

  /**
   * The guided overlay is the first-run onboarding; the inline disclosure is
   * the always-available reminder. Both ship. The overlay must stay mounted,
   * because the "Restart guided tour" button on the trial home only dispatches
   * an event — with no tour listening, that button silently does nothing.
   */
  it("mounts the guided tour in the shell, gated on setup being complete", () => {
    const shellSource = readFileSync(
      new URL("../src/components/features/app-shell/shell.tsx", import.meta.url),
      "utf8",
    );

    expect(shellSource).toContain("<TrialTour");
    expect(shellSource).toContain("shouldShowTrialTour(mode, trial)");
    expect(shouldShowTrialTour("trial", { ...trial, setupComplete: true })).toBe(true);
    expect(shouldShowTrialTour("trial", { ...trial, setupComplete: false })).toBe(false);
    expect(shouldShowTrialTour("standard", { ...trial, setupComplete: true })).toBe(false);
    expect(shouldShowTrialTour("trial", null)).toBe(false);
  });

  it("keeps the restart control wired to a tour that is actually mounted", () => {
    const homeSource = readFileSync(
      new URL(
        "../src/components/features/trial/trial-home.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const tourSource = readFileSync(
      new URL(
        "../src/components/features/trial/trial-tour.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    // the button dispatches the event; only a mounted TrialTour listens for it
    expect(homeSource).toContain("RestartTrialTourButton");
    expect(tourSource).toContain("dispatchEvent(new Event(RESTART_EVENT))");
    expect(tourSource).toContain("addEventListener(RESTART_EVENT");
  });
});

/**
 * Each step spotlights `[data-tour="<target>"]`. When a target disappears —
 * as `training-source` did in the nav simplification — the tour does not
 * fail loudly: it shows "This area is still loading", which is wrong and
 * permanent. This keeps the steps and the markup honest with each other.
 */
describe("guided tour targets exist in the markup", () => {
  const SOURCES = [
    "../src/components/features/trial/trial-home.tsx",
    "../src/components/features/trial/trial-training.tsx",
    "../src/components/features/trial/try-your-ai.tsx",
    "../src/components/features/trial/test-conversation.tsx",
    "../src/components/features/trial/locked-feature-card.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

  it.each(TRIAL_TOUR_STEPS.map((step) => [step.id, step.target] as const))(
    "step %s spotlights an element that exists (%s)",
    (_id, target) => {
      expect(SOURCES).toContain(`"${target}"`);
    },
  );

  it("points every step at a route the app still serves", () => {
    for (const step of TRIAL_TOUR_STEPS) {
      const route = step.route.replace(/^\//, "");
      expect(
        existsSync(new URL(`../src/app/(app)/${route}/page.tsx`, import.meta.url)),
        `missing route page for ${step.route}`,
      ).toBe(true);
    }
  });
});
