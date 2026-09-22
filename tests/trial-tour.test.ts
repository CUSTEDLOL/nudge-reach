import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TrialStatusStrip,
  trialStatusText,
} from "@/components/features/trial/trial-status-strip";
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
    const shellSource = readFileSync(
      new URL("../src/components/features/app-shell/shell.tsx", import.meta.url),
      "utf8",
    );
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
    expect(html).not.toContain('role="dialog"');
    expect(shellSource).not.toContain("TrialTour");
    expect(shellSource).not.toContain("shouldShowTrialTour");
    expect(shellSource).not.toContain("router.push");
    expect(shellSource).not.toContain("useOverlay");
  });
});
