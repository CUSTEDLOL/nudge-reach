import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";

const text = renderToStaticMarkup(createElement(PrivacyPage));

describe("privacy policy", () => {
  it("discloses demo-prospect identity, booking, and optional attribution data", () => {
    expect(text).toContain("Last updated 15 September 2026");
    expect(text).toContain("Demo and access-request data");
    expect(text).toContain("Cal booking UID");
    expect(text).toContain("appointment time");
    expect(text).toContain("Nudge separately stores its internal lead status");
    expect(text).toContain("operator-authored notes");
    expect(text).toContain("Website first-touch attribution is disabled by default");
    expect(text).toContain("NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED");
    expect(text).toContain("Only the exact value");
    expect(text).toContain("read an existing _ga cookie");
    expect(text).toContain("forward attribution to Cal.com");
    expect(text).toContain("Aggregate CTA and form events can still enter the GTM data layer");
    expect(text).not.toContain(
      "Website attribution and GA4 measurement are disabled by default",
    );
    expect(text).toContain("approved consent and analytics configuration");
    expect(text).toContain("landing path, origin-only referrer");
    expect(text).toContain("pseudonymous Google Analytics client ID");
  });

  it("describes autonomous and BYOK model processing without the stale manual-only claim", () => {
    expect(text).toContain("automatically answer inbound messages");
    expect(text).toContain("customer-supplied API key");
    expect(text).toContain("Anthropic, OpenAI or Google");
    expect(text).toContain("selected model provider");
    expect(text).not.toContain("AI-suggested replies are never sent automatically");
  });

  it("names the demo, calendar, and optional measurement providers accurately", () => {
    expect(text).toContain("Cal.com — Nudge demo scheduling");
    expect(text).toContain("Google — connected Google Calendar");
    expect(text).toContain("Google Analytics 4 measurement");
    expect(text).not.toContain("each bound by data-protection terms");
  });

  it("states the actual retention, export, request, and legal-review boundaries", () => {
    expect(text).toContain("We do not currently promise a fixed deletion period");
    expect(text).toContain("export contacts and message history");
    expect(text).toContain("Demo prospects and other individuals can request access");
    expect(text).toContain("qualified legal review is still pending");
    expect(text).toContain("not legal advice");
  });
});
