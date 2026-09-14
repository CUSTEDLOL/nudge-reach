import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/industries/clinics/page";
import { ClinicHub } from "@/components/marketing/clinics/clinic-hub";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";

const pageHtml = renderToStaticMarkup(createElement(ClinicHub));
const heroHtml = renderToStaticMarkup(createElement(HeroV2));
const pageText = pageHtml.replace(/<[^>]*>/g, " ");
const pageH1 = pageHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
  .replace(/<[^>]*>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

describe("clinic SEO landing page", () => {
  it("owns the clinic receptionist intent with concrete front-desk actions", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://nudgeagent.app/industries/clinics",
    );
    expect(pageHtml).toContain("AI Front Desk for clinics");
    for (const phrase of [
      "real calendar",
      "follow",
      "payment",
      "human handoff",
      "official WhatsApp Cloud API",
    ]) {
      expect(pageHtml.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it("targets India's aesthetic dermatology, cosmetic dental and hair transplant clinics", () => {
    expect(metadata.title).toBe("AI Front Desk for Clinics in India on WhatsApp");
    expect(metadata.description).toBe(
      "AI Front Desk for aesthetic dermatology, cosmetic dental and hair transplant clinics in India, with WhatsApp booking, follow-up, payment links and handoff.",
    );
    expect(pageH1).toBe(
      "An AI Front Desk for India's aesthetic dermatology, cosmetic dental and hair transplant clinics.",
    );
    for (const phrase of [
      "clinics in India",
      "aesthetic dermatology",
      "cosmetic dental",
      "hair transplant",
      "consultation",
    ]) {
      expect(pageText.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it("does not claim generic CRM leadership or unsupported proof", () => {
    expect(`${pageHtml}\n${heroHtml}`).not.toContain("The #1");
    expect(pageHtml.toLowerCase()).not.toContain("best whatsapp crm");
    expect(pageText).not.toMatch(/\d+%|trusted by \d+/);
  });
});
