import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TRIAL_TOUR_STEPS,
  nextTrialTourStep,
  previousTrialTourStep,
  trialTourPresentation,
  trialTourTargetSelector,
} from "@/modules/trial/tour";

describe("trial tour definition", () => {
  it("walks the real product in the approved route order", () => {
    expect(TRIAL_TOUR_STEPS).toEqual([
      expect.objectContaining({ id: "welcome", route: "/dashboard", target: "trial-home" }),
      expect.objectContaining({ id: "train", route: "/agent", target: "training-source" }),
      expect.objectContaining({ id: "test", route: "/inbox/try", target: "test-composer" }),
      expect.objectContaining({ id: "inbox", route: "/inbox/try", target: "test-thread" }),
      expect.objectContaining({ id: "locked", route: "/explore", target: "locked-whatsapp" }),
      expect.objectContaining({ id: "finish", route: "/dashboard", target: "trial-conversion" }),
    ]);
  });

  it("keeps next, back, finish, route, and selector behavior deterministic", () => {
    expect(nextTrialTourStep("welcome")?.id).toBe("train");
    expect(previousTrialTourStep("welcome")).toBeNull();
    expect(previousTrialTourStep("test")?.id).toBe("train");
    expect(nextTrialTourStep("finish")).toBeNull();
    expect(nextTrialTourStep("locked")?.route).toBe("/dashboard");
    expect(trialTourTargetSelector(TRIAL_TOUR_STEPS[2])).toBe(
      '[data-tour="test-composer"]',
    );
  });

  it("uses a bottom sheet below the desktop breakpoint", () => {
    expect(trialTourPresentation(390)).toBe("bottom-sheet");
    expect(trialTourPresentation(767)).toBe("bottom-sheet");
    expect(trialTourPresentation(768)).toBe("popover");
    expect(trialTourPresentation(1440)).toBe("popover");
  });

  it("uses business-neutral guidance", () => {
    const copy = TRIAL_TOUR_STEPS
      .flatMap((step) => [step.title, step.body])
      .join(" ");

    expect(copy).toContain("customer question");
    expect(copy).toContain("business facts");
    expect(copy.toLowerCase()).not.toMatch(/\b(?:clinics?|patients?)\b/);
  });
});

describe("trial tour accessibility contract", () => {
  const source = readFileSync(
    new URL("../src/components/features/trial/trial-tour.tsx", import.meta.url),
    "utf8",
  );

  it("opens on unfinished first visits and follows route changes", () => {
    expect(source).toContain("!trial.tourCompleted && !trial.tourDismissed");
    expect(source).toContain("router.push(step.route)");
    expect(source).toContain("scrollIntoView");
  });

  it("is a labelled dialog with explicit dismissal and shared focus handling", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("useOverlay(mounted && open, handleDismiss, panelRef, targetRef)");
    expect(source).toContain("targetRef.current = target");
    expect(source).toContain("panelRef.current?.focus");
    expect(source).toContain("Skip tour");
  });

  it("supports reduced motion, a missing-target fallback, and a mobile sheet", () => {
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("missingTarget");
    expect(source).toContain("rounded-t-2xl");
    expect(source).toContain("aria-hidden");
  });

  it("mounts once and points to the six real controls", () => {
    const shell = readFileSync(
      new URL("../src/components/features/app-shell/shell.tsx", import.meta.url),
      "utf8",
    );
    const targets = [
      readFileSync(new URL("../src/components/features/trial/trial-home.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../src/components/features/trial/trial-training.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../src/app/(app)/inbox/try/try-your-ai.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../src/components/features/trial/test-conversation.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../src/components/features/trial/locked-feature-card.tsx", import.meta.url), "utf8"),
    ].join("\n");

    expect(shell.match(/<TrialTour trial=/g)).toHaveLength(1);
    for (const target of [
      "trial-home",
      "training-source",
      "test-composer",
      "test-thread",
      "locked-whatsapp",
      "trial-conversion",
    ]) {
      expect(targets).toContain(`\"${target}\"`);
    }
  });
});
