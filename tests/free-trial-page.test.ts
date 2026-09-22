import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import FreeTrialPage, { metadata } from "@/app/free-trial/page";
import {
  completeTrialAccountHandoff,
  trialAccountPayload,
  trialClaimNeedsRefresh,
  trialIntakePayload,
  trialPasswordCredentials,
  trialSignupDestination,
  validateTrialPassword,
} from "@/modules/trial/browser-signup";

const signupFormSource = readFileSync(
  "src/app/free-trial/trial-signup-form.tsx",
  "utf8",
);

function plainText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function count(markup: string, pattern: RegExp) {
  return markup.match(pattern)?.length ?? 0;
}

const form = {
  ownerName: "Dr Asha Mehta",
  businessName: "Aster Clinic",
  email: "owner@aster.in",
  phone: "+919876543210",
  password: "secret-password",
  contactConsent: true,
  honeypot: "",
};

const claim = {
  trialId: "trial_1",
  claimToken: "opaque-claim-token",
};

function authenticatedSession(
  acquisitionTrialId = claim.trialId,
  acquisitionTrialToken = claim.claimToken,
) {
  return {
    data: {
      session: {
        user: {
          user_metadata: {
            acquisition_trial_id: acquisitionTrialId,
            acquisition_trial_token: acquisitionTrialToken,
          },
        },
      },
    },
    error: null,
  };
}

describe("free trial acquisition page", () => {
  const html = renderToStaticMarkup(createElement(FreeTrialPage));
  const text = plainText(html);

  it("offers one focused path into the trial", () => {
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(count(html, /<form\b/g)).toBe(1);
    expect(count(html, /<button[^>]*type="submit"/g)).toBe(1);
    expect(count(html, /data-cal-link=/g)).toBe(1);

    expect(text).toContain(
      "A front desk that answers before the lead goes cold.",
    );
    expect(text).toContain("7 days");
    expect(text).toContain("15 replies");
    expect(text).toContain("No card required");
    expect(text).toContain("No live WhatsApp connection");
    expect(text).toContain("Official WhatsApp API");
    expect(text).toContain("Train");
    expect(text).toContain("Test");
    expect(text).toContain("Go live");
    expect(text).toContain("Book a free demo");
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(text.toLowerCase()).not.toContain("blast");
  });

  it("is business-neutral instead of assuming a clinic", () => {
    const publicCopy = `${text} ${metadata.title} ${metadata.description}`;

    expect(publicCopy).toContain("business information");
    expect(publicCopy).toContain("customer questions");
    expect(publicCopy.toLowerCase()).not.toMatch(/\bclinics?\b/);
    expect(publicCopy.toLowerCase()).not.toMatch(/\bpatients?\b/);
  });

  it("explains the full paid AI Front Desk outcome without a product mockup", () => {
    expect(text).toContain("The paid AI Front Desk");
    expect(text).toContain("books into your real calendar");
    expect(text).toContain("follows up opted-in leads");
    expect(text).toContain("collects payments");
    expect(text).toContain("set it up with you");

    for (const removed of [
      "A safe, guided trial",
      "START FREE",
      "Aster Clinic AI",
      "Inside your trial",
      "TRAIN AI",
      "Explore",
    ]) {
      expect(text).not.toContain(removed);
    }
  });

  it("keeps all three trial FAQs visible", () => {
    expect(count(html, /<dl\b/g)).toBe(1);
    expect(count(html, /<dt\b/g)).toBe(3);
    expect(count(html, /<dd\b/g)).toBe(3);
    expect(html).not.toContain("<details");
  });

  it("keeps normal text and placeholders on AA contrast tokens", () => {
    expect(html).not.toMatch(/\btext-ink\/(?:35|45|55)\b/);
    expect(html).not.toMatch(/\bplaceholder:text-ink\/(?:35|45|55)\b/);
  });

  it("renders safe, accessible signup defaults", () => {
    const consent = html.match(/<input[^>]*name="contactConsent"[^>]*>/)?.[0] ?? "";
    const password = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    const honeypot = html.match(/<input[^>]*name="honeypot"[^>]*>/)?.[0] ?? "";

    expect(consent).toContain('type="checkbox"');
    expect(consent).not.toContain("checked");
    expect(password).toContain('minLength="8"');
    expect(password).toContain('maxLength="128"');
    expect(honeypot).toContain('aria-hidden="true"');
    expect(honeypot).toContain('tabindex="-1"');
    expect(html).toContain('aria-live="polite"');
    for (const name of [
      "ownerName",
      "businessName",
      "email",
      "phone",
      "password",
      "contactConsent",
      "honeypot",
    ]) {
      expect(count(html, new RegExp(`name="${name}"`, "g"))).toBe(1);
    }
  });

  it("publishes focused canonical metadata", () => {
    expect(metadata).toMatchObject({
      title: "Free AI Front Desk Trial | Nudge",
      description:
        "Teach Nudge about your business and test up to 15 grounded AI replies in a safe workspace. No card required.",
      alternates: { canonical: "/free-trial" },
      openGraph: { url: "/free-trial", type: "website" },
    });
  });
});

describe("free trial browser handoff", () => {
  it("never sends the password to the intake endpoint", () => {
    const intake = trialIntakePayload(form, {
      landingPath: "/free-trial",
      utmSource: "meta",
    });

    expect(intake).toEqual({
      ownerName: "Dr Asha Mehta",
      businessName: "Aster Clinic",
      email: "owner@aster.in",
      phone: "+919876543210",
      contactConsent: true,
      honeypot: "",
      attribution: { landingPath: "/free-trial", utmSource: "meta" },
    });
    expect(JSON.stringify(intake)).not.toContain("secret-password");
  });

  it("sends the claim and password to account creation, then signs in", () => {
    expect(trialAccountPayload(form, claim)).toEqual({
      trialId: "trial_1",
      claimToken: "opaque-claim-token",
      password: "secret-password",
    });
    expect(trialPasswordCredentials(form)).toEqual({
      email: "owner@aster.in",
      password: "secret-password",
    });
  });

  it("rejects short passwords before submission", () => {
    expect(validateTrialPassword("short")).toMatch(/at least 8 characters/i);
    expect(validateTrialPassword("long-enough")).toBeNull();
  });

  it("routes an immediate authenticated session into the dashboard", () => {
    expect(trialSignupDestination(true)).toBe("/dashboard");
    expect(trialSignupDestination(false)).toBeNull();
  });

  it("creates the account before password sign-in without a confirmation wall", () => {
    expect(signupFormSource).toContain('fetch("/api/trials/account"');
    expect(signupFormSource).toContain("signInWithPassword");
    expect(signupFormSource).not.toContain(".signUp(");
    expect(signupFormSource).not.toContain("Check your email");
    expect(signupFormSource).not.toContain("confirmationEmail");
  });

  it("provisions before sign-in and routes only the matching authenticated claim", async () => {
    const calls: string[] = [];
    const createAccount = vi.fn(async () => {
      calls.push("account");
      return { status: 200, ok: true, result: { ok: true as const } };
    });
    const signInWithPassword = vi.fn(async () => {
      calls.push("sign-in");
      return authenticatedSession();
    });

    const result = await completeTrialAccountHandoff(form, claim, {
      createAccount,
      signInWithPassword,
    });

    expect(calls).toEqual(["account", "sign-in"]);
    expect(result).toEqual({
      destination: "/dashboard",
      message: null,
      showSignIn: false,
    });
  });

  it("does not sign in or route after a non-409 provisioning failure", async () => {
    const signInWithPassword = vi.fn();

    const result = await completeTrialAccountHandoff(form, claim, {
      createAccount: async () => ({
        status: 503,
        ok: false,
        result: {
          ok: false as const,
          error: "Account creation is temporarily unavailable. Please try again.",
        },
      }),
      signInWithPassword,
    });

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(result).toEqual({
      destination: null,
      message: "Account creation is temporarily unavailable. Please try again.",
      showSignIn: false,
    });
  });

  it("tries password sign-in after a safe account conflict", async () => {
    const signInWithPassword = vi.fn(async () => authenticatedSession());

    const result = await completeTrialAccountHandoff(form, claim, {
      createAccount: async () => ({
        status: 409,
        ok: false,
        result: {
          ok: false as const,
          error: "This trial cannot create a new account. Sign in or restart with a different email.",
        },
      }),
      signInWithPassword,
    });

    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(result.destination).toBe("/dashboard");
  });

  it("does not route when password sign-in has no session", async () => {
    const result = await completeTrialAccountHandoff(form, claim, {
      createAccount: async () => ({
        status: 200,
        ok: true,
        result: { ok: true as const },
      }),
      signInWithPassword: async () => ({
        data: { session: null },
        error: null,
      }),
    });

    expect(result).toEqual({
      destination: null,
      message: "We couldn't sign in to continue this trial. Check the password and try again.",
      showSignIn: true,
    });
  });

  it.each([
    ["trial ID", "another_trial", claim.claimToken],
    ["claim token", claim.trialId, "another-opaque-claim-token"],
  ])("does not route when the authenticated %s differs", async (
    _field,
    acquisitionTrialId,
    acquisitionTrialToken,
  ) => {
    const result = await completeTrialAccountHandoff(form, claim, {
      createAccount: async () => ({
        status: 200,
        ok: true,
        result: { ok: true as const },
      }),
      signInWithPassword: async () => authenticatedSession(
        acquisitionTrialId,
        acquisitionTrialToken,
      ),
    });

    expect(result).toEqual({
      destination: null,
      message: "This account cannot continue the pending trial. Sign in with the matching account or restart with a different email.",
      showSignIn: true,
    });
  });

  it("revalidates an in-memory claim before retrying after its expiry", () => {
    expect(trialClaimNeedsRefresh(
      { trialId: "trial_1", claimToken: "token", expiresAt: "2026-09-21T00:00:00Z" },
      new Date("2026-09-21T00:00:01Z").getTime(),
    )).toBe(true);
    expect(trialClaimNeedsRefresh(
      { trialId: "trial_1", claimToken: "token", expiresAt: "2026-09-21T00:00:00Z" },
      new Date("2026-09-20T23:59:59Z").getTime(),
    )).toBe(false);
  });
});
