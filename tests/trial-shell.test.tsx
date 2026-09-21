import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/(app)/shell-actions", () => ({
  saveSidebarCollapsedAction: vi.fn(),
}));

import {
  AppShell,
  shouldShowTrialTour,
} from "@/components/features/app-shell/shell";
import {
  TrialStatusStrip,
  trialStatusText,
} from "@/components/features/trial/trial-status-strip";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const trial: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  expiresAt: "2026-09-27T10:00:00.000Z",
  repliesUsed: 3,
  replyLimit: 15,
  repliesRemaining: 12,
  setupComplete: true,
  knowledgeSource: "website",
  knowledgeReady: true,
  knowledgeCount: 5,
  firstReplyAt: "2026-09-21T09:00:00.000Z",
  exploreViewed: false,
  tourStep: "welcome",
  tourCompleted: false,
  tourDismissed: false,
  demoBooked: false,
  converted: false,
};

describe("trial app shell", () => {
  it("renders one shared shell with four real coach-mark links", () => {
    const html = renderToStaticMarkup(
      <AppShell
        orgName="Aster Clinic"
        user={{ name: "Asha", email: "asha@aster.in" }}
        role="OWNER"
        simulation
        mode="trial"
        trial={trial}
      >
        <p>Trial home</p>
      </AppShell>,
    );

    expect(html).toContain("Safe test workspace");
    expect(html).toContain("12 of 15 replies left");
    expect(html).toContain("Ends 27 Sep");
    for (const target of ["nav-home", "nav-train", "nav-test", "nav-explore"]) {
      expect(html).toContain(`data-tour="${target}"`);
    }
    expect(html).not.toContain('href="/campaigns"');
    expect(html).not.toContain('href="/settings"');
  });

  it("keeps the active usage string authoritative and polite", () => {
    expect(trialStatusText(trial)).toBe(
      "Free trial · 12 of 15 replies left · Ends 27 Sep",
    );
    const html = renderToStaticMarkup(<TrialStatusStrip trial={trial} />);
    expect(html).toContain('aria-live="polite"');
  });

  it("does not start the product tour until setup is complete", () => {
    const html = renderToStaticMarkup(
      <AppShell
        orgName="Aster Clinic"
        user={{ name: "Asha", email: "asha@aster.in" }}
        mode="trial"
        trial={{ ...trial, setupComplete: false }}
      >
        <p>Manual fact editor</p>
      </AppShell>,
    );

    expect(html).toContain("Manual fact editor");
    expect(html).not.toContain("Skip guided tour");
    expect(shouldShowTrialTour("trial", { ...trial, setupComplete: false })).toBe(false);
    expect(shouldShowTrialTour("trial", trial)).toBe(true);
  });

  it.each([
    ["exhausted", "15-reply limit reached"],
    ["expired", "Trial ended"],
  ] as const)("shows conversion choices when the trial is %s", (status, reason) => {
    const html = renderToStaticMarkup(
      <TrialStatusStrip trial={{ ...trial, status }} />,
    );
    expect(html).toContain(reason);
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
  });
});
