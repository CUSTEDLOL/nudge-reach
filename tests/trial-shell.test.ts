import { createElement } from "react";
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
import { Topbar } from "@/components/features/app-shell/topbar";
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
  it("renders one shared shell with only Inbox and Train AI destinations", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          orgName: "Aster Clinic",
          user: { name: "Asha", email: "asha@aster.in" },
          role: "OWNER",
          simulation: true,
          mode: "trial",
          trial,
        },
        createElement("p", null, "Trial home"),
      ),
    );

    expect(html).toContain("Safe test workspace");
    expect(html).toContain("12 of 15 replies left");
    expect(html).toContain("Ends 27 Sep");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/agent"');
    expect(html).toContain("grid-cols-2");
    expect(html).not.toContain('href="/inbox/try"');
    expect(html).not.toContain('href="/explore"');
    expect(html).not.toContain('href="/campaigns"');
    expect(html).not.toContain('href="/settings"');
    expect(html).not.toContain("Search or jump to...");
  });

  it("keeps command search in the standard workspace only", () => {
    const trialTopbar = renderToStaticMarkup(
      createElement(Topbar, {
        orgName: "Aster Clinic",
        user: { name: "Asha", email: "asha@aster.in" },
        role: "OWNER",
        mode: "trial",
      }),
    );
    const standardTopbar = renderToStaticMarkup(
      createElement(Topbar, {
        orgName: "Aster Clinic",
        user: { name: "Asha", email: "asha@aster.in" },
        role: "OWNER",
        mode: "standard",
      }),
    );

    expect(trialTopbar).not.toContain("Search or jump to...");
    expect(standardTopbar).toContain("Search or jump to...");
  });

  it("keeps the active usage string authoritative and polite", () => {
    expect(trialStatusText(trial)).toBe(
      "Free trial · 12 of 15 replies left · Ends 27 Sep",
    );
    const html = renderToStaticMarkup(createElement(TrialStatusStrip, { trial }));
    expect(html).toContain('aria-live="polite"');
  });

  it("does not start the product tour until setup is complete", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          orgName: "Aster Clinic",
          user: { name: "Asha", email: "asha@aster.in" },
          mode: "trial",
          trial: { ...trial, setupComplete: false },
        },
        createElement("p", null, "Manual fact editor"),
      ),
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
      createElement(TrialStatusStrip, { trial: { ...trial, status } }),
    );
    expect(html).toContain(reason);
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
  });
});
