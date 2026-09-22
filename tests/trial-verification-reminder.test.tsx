import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TrialEmailVerification,
  trialVerificationRedirect,
  trialVerificationStorageKeys,
} from "@/components/features/trial/trial-email-verification";

describe("trial email verification reminder", () => {
  it("derives isolated per-trial storage keys", () => {
    expect(trialVerificationStorageKeys("trial_1")).toEqual({
      sent: "nudge:trial:trial_1:verification-sent",
      dismissed: "nudge:trial:trial_1:verification-dismissed",
    });
  });

  it("returns to the dashboard after magic-link confirmation", () => {
    expect(trialVerificationRedirect("https://nudge.test")).toBe(
      "https://nudge.test/auth/confirm?next=/dashboard",
    );
  });

  it("renders the optional reminder with quiet text actions", () => {
    const html = renderToStaticMarkup(
      createElement(TrialEmailVerification, {
        trialId: "trial_1",
        email: "owner@example.com",
      }),
    );

    expect(html).toContain("Verify your email to protect this workspace.");
    expect(html).toContain("Resend email");
    expect(html).toContain("Dismiss");
  });

  it("keeps sending isolated, retriable, and non-blocking", () => {
    const source = readFileSync(
      new URL(
        "../src/components/features/trial/trial-email-verification.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("shouldCreateUser: false");
    expect(source).toContain("useRef");
    expect(source).toContain("useState(() =>");
    expect(source).toContain("queueMicrotask");
    expect(source).toContain("trialVerificationStorageKeys(trialId)");
    expect(source).toContain("Verification email sent.");
    expect(source).toContain("setError");
    expect(source).not.toMatch(/(?:router\.|window\.location\s*=|disabled=)/);
  });
});
