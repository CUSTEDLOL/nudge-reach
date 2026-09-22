import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TrialEmailVerification,
  completeTrialVerificationRequest,
  initialTrialVerificationState,
  markTrialVerificationSent,
  resolveTrialVerificationStorage,
  startTrialVerificationRequest,
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

  it("keeps server and first-client state identical before resolving a dismissal", () => {
    const serverState = initialTrialVerificationState();
    const firstClientState = initialTrialVerificationState();

    expect(firstClientState).toEqual(serverState);
    expect(firstClientState.storageResolved).toBe(false);
    expect(firstClientState.dismissed).toBe(false);

    const hydrated = resolveTrialVerificationStorage(firstClientState, {
      dismissed: true,
      sent: false,
    });

    expect(hydrated).toMatchObject({
      storageResolved: true,
      dismissed: true,
    });
  });

  it("keeps the newest visible request result while stale successes still persist", () => {
    const writes: Array<[string, string]> = [];
    const storage = {
      setItem(key: string, value: string) {
        writes.push([key, value]);
      },
    };
    let state = resolveTrialVerificationStorage(initialTrialVerificationState(), {
      dismissed: false,
      sent: false,
    });
    state = startTrialVerificationRequest(state, 1);
    state = startTrialVerificationRequest(state, 2);
    state = completeTrialVerificationRequest(state, 2, "error");

    markTrialVerificationSent(storage, "trial_1");
    state = completeTrialVerificationRequest(state, 1, "success");

    expect(state.status).toEqual({ kind: "error" });
    expect(writes).toEqual([
      ["nudge:trial:trial_1:verification-sent", "true"],
    ]);
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
    expect(source).toContain("initialTrialVerificationState");
    expect(source).toContain("storageResolved");
    expect(source).toContain("queueMicrotask");
    expect(source).toContain("trialVerificationStorageKeys(trialId)");
    expect(source).toContain("Verification email sent.");
    expect(source).toContain("latestRequestId");
    expect(source).toContain("completeTrialVerificationRequest");
    expect(source).not.toMatch(/(?:router\.|window\.location\s*=|disabled=)/);
  });
});
