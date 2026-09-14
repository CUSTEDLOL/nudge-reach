import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/industries/clinics/page";
import { ClinicHub } from "@/components/marketing/clinics/clinic-hub";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";

const pageHtml = renderToStaticMarkup(createElement(ClinicHub));
const heroHtml = renderToStaticMarkup(createElement(HeroV2));
const pageText = pageHtml.replace(/<[^>]*>/g, " ");

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

  it("does not claim generic CRM leadership or unsupported proof", () => {
    expect(`${pageHtml}\n${heroHtml}`).not.toContain("The #1");
    expect(pageHtml.toLowerCase()).not.toContain("best whatsapp crm");
    expect(pageText).not.toMatch(/\d+%|trusted by \d+/);
  });
});
