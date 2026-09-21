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
        emailRedirectTo: "https://nudge.test/auth/confirm?next=/agent",
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

  it("routes an immediate authenticated session into Train AI", () => {
    expect(trialSignupDestination(true)).toBe("/agent");
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
