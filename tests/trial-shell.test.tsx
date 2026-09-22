import { readFileSync } from "node:fs";
import {
  createElement,
  type ComponentProps,
  type ComponentType,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/(app)/shell-actions", () => ({
  saveSidebarCollapsedAction: vi.fn(),
}));

import { AppShell } from "@/components/features/app-shell/shell";
import { Topbar } from "@/components/features/app-shell/topbar";
import {
  TrialStatusStrip,
  trialStatusText,
} from "@/components/features/trial/trial-status-strip";
import type { TrialWorkspace } from "@/modules/trial/workspace";

type AppShellElementProps = Omit<ComponentProps<typeof AppShell>, "children">;
const AppShellElement = AppShell as ComponentType<AppShellElementProps>;

const trial: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  emailVerified: false,
  expiresAt: "2026-09-27T10:00:00.000Z",
  repliesUsed: 3,
  replyLimit: 15,
  repliesRemaining: 12,
  setupComplete: true,
  knowledgeSource: "website",
  knowledgeReady: true,
  knowledgeCount: 5,
  approvedFactCount: 5,
  draftFactCount: 0,
  factCount: 5,
  factLimit: 50,
  webImportsUsed: 1,
  webImportLimit: 1,
  fileImportsUsed: 0,
  fileImportLimit: 3,
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
        AppShellElement,
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
    const html = renderToStaticMarkup(
      createElement(TrialStatusStrip, { trial, email: "asha@aster.in" }),
    );
    expect(html).toContain('aria-live="polite"');
  });

  it("shows the verification reminder only for an unverified active trial", () => {
    const unverified = renderToStaticMarkup(
      createElement(TrialStatusStrip, {
        trial,
        email: "asha@aster.in",
      }),
    );
    const verified = renderToStaticMarkup(
      createElement(TrialStatusStrip, {
        trial: { ...trial, emailVerified: true },
        email: "asha@aster.in",
      }),
    );

    expect(unverified).toContain("Verify your email to protect this workspace.");
    expect(unverified).toContain("Resend email");
    expect(unverified).toContain("Dismiss");
    expect(verified).not.toContain("Verify your email to protect this workspace.");
  });

  it("shows quiet inline guidance before setup without mounting a tour", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShellElement,
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
    expect(html).toContain("How to use this trial");
    expect(html).toContain("<details");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Skip tour");
  });

  it.each([
    ["exhausted", "15-reply limit reached"],
    ["expired", "Trial ended"],
  ] as const)("shows conversion choices when the trial is %s", (status, reason) => {
    const html = renderToStaticMarkup(
      createElement(TrialStatusStrip, {
        trial: { ...trial, status },
        email: "asha@aster.in",
      }),
    );
    expect(html).toContain(reason);
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
  });
});

describe("active trial workspace copy", () => {
  it("does not assume the business is a clinic or medical practice", () => {
    const source = [
      "../src/app/(app)/inbox/try/page.tsx",
      "../src/components/features/trial/try-your-ai.tsx",
      "../src/components/features/trial/test-conversation.tsx",
      "../src/components/features/trial/trial-training.tsx",
      "../src/components/features/trial/upgrade-dialog.tsx",
    ]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");

    expect(source).toContain("customer");
    expect(source).toContain("business");
    expect(source.toLowerCase()).not.toMatch(
      /\b(?:clinics?|patients?|practice)\b/,
    );
  });
});
