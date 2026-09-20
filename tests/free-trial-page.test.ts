import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import FreeTrialPage, { metadata } from "@/app/free-trial/page";
import {
  trialAuthCredentials,
  trialClaimNeedsRefresh,
  trialIntakePayload,
  trialSignupDestination,
  validateTrialPassword,
} from "@/modules/trial/browser-signup";

function plainText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

describe("free trial acquisition page", () => {
  const html = renderToStaticMarkup(createElement(FreeTrialPage));
  const text = plainText(html);

  it("makes the clinic trial offer and next step unambiguous", () => {
    expect(text).toContain("Try Nudge on your clinic's real questions");
    expect(text).toContain("7 days or 15 AI replies");
    expect(text).toContain("No card required");
    expect(text).toContain("Official WhatsApp API");
    expect(text).toContain("Book a free demo");
    expect(text.toLowerCase()).not.toContain("blast");
  });

  it("renders safe, accessible signup defaults", () => {
    const consent = html.match(/<input[^>]*name="contactConsent"[^>]*>/)?.[0] ?? "";
    const password = html.match(/<input[^>]*name="password"[^>]*>/)?.[0] ?? "";
    const honeypot = html.match(/<input[^>]*name="honeypot"[^>]*>/)?.[0] ?? "";

    expect(consent).toContain('type="checkbox"');
    expect(consent).not.toContain("checked");
    expect(password).toContain('minLength="8"');
    expect(honeypot).toContain('aria-hidden="true"');
    expect(honeypot).toContain('tabindex="-1"');
    expect(html).toContain('aria-live="polite"');
  });

  it("publishes focused canonical metadata", () => {
    expect(metadata).toMatchObject({
      title: "Free AI Front Desk Trial for Clinics | Nudge",
      description:
        "Teach Nudge about your clinic and test up to 15 grounded AI replies in a safe workspace. No card required.",
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

  it("sends the claim and password only to Supabase Auth", () => {
    expect(
      trialAuthCredentials(form, "https://nudge.test", {
        trialId: "trial_1",
        claimToken: "opaque-claim-token",
      }),
    ).toEqual({
      email: "owner@aster.in",
      password: "secret-password",
      options: {
        emailRedirectTo: "https://nudge.test/auth/confirm?next=/trial/setup",
        data: {
          acquisition_trial_id: "trial_1",
          acquisition_trial_token: "opaque-claim-token",
        },
      },
    });
  });

  it("rejects short passwords before submission", () => {
    expect(validateTrialPassword("short")).toMatch(/at least 8 characters/i);
    expect(validateTrialPassword("long-enough")).toBeNull();
  });

  it("routes an immediate authenticated session into trial setup", () => {
    expect(trialSignupDestination(true)).toBe("/trial/setup");
    expect(trialSignupDestination(false)).toBeNull();
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
