import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WhatsAppLeadLeakageCalculatorPage, {
  metadata,
} from "@/app/tools/whatsapp-lead-leakage-calculator/page";
import { LeadLeakageCalculator } from "@/app/tools/whatsapp-lead-leakage-calculator/lead-leakage-calculator";
import { metadataFor } from "@/modules/marketing/seo-pages";

const PATH = "/tools/whatsapp-lead-leakage-calculator";

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&rarr;/g, "→")
    .replace(/\s+/g, " ")
    .trim();
}

describe("WhatsApp lead-leakage calculator page", () => {
  const html = renderToStaticMarkup(
    createElement(WhatsAppLeadLeakageCalculatorPage),
  );
  const text = plainText(html);

  it("publishes one H1 and registry-derived canonical metadata", () => {
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(
      (match) => plainText(match[1]),
    );

    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toMatch(/WhatsApp lead leakage calculator/i);
    expect(metadata).toEqual(metadataFor(PATH));
  });

  it("publishes exactly one breadcrumb schema", () => {
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((match) => JSON.parse(match[1])) as Array<Record<string, unknown>>;

    expect(
      scripts.filter((value) => value["@type"] === "BreadcrumbList"),
    ).toHaveLength(1);
  });

  it("renders five labelled, constrained decimal inputs", () => {
    const fields = [
      ["monthly-leads", "Monthly WhatsApp leads", undefined],
      ["missed-reply-percent", "Leads without a timely reply (%)", "100"],
      ["missing-followup-percent", "Replied leads without follow-up (%)", "100"],
      ["conversion-percent", "Lead-to-customer conversion rate (%)", "100"],
      ["average-sale-value", "Average sale value", undefined],
    ] as const;

    for (const [id, label, max] of fields) {
      expect(html).toContain(`<label for="${id}"`);
      expect(text).toContain(label);
      const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
      expect(input).toContain('type="number"');
      expect(input).toContain('inputMode="decimal"');
      expect(input).toContain('min="0"');
      expect(input).toContain('required=""');
      if (max) expect(input).toContain(`max="${max}"`);
    }
  });

  it("explains the estimate, protects privacy and links to the next useful guides", () => {
    expect(text).toContain("No information entered here is stored");
    expect(text).toMatch(/missed repl(?:y|ies).*missing follow-up.*revenue at risk/i);
    expect(text).toMatch(/own local currency/i);
    expect(html).toContain('href="/whatsapp-ai-automation"');
    expect(html).toContain(
      'href="/resources/how-to-stop-losing-leads-on-whatsapp"',
    );
  });

  it("starts with an instructional empty result region", () => {
    const resultRegion = html.match(
      /<p[^>]*aria-live="polite"[^>]*>[\s\S]*?<\/p>/,
    )?.[0] ?? "";

    expect(resultRegion).not.toBe("");
    expect(plainText(resultRegion)).toMatch(/enter all five values/i);
    expect(plainText(resultRegion)).not.toContain("₹");
    expect(resultRegion).not.toContain("aria-atomic");
  });
});

describe("LeadLeakageCalculator deterministic renders", () => {
  it("shows the calculated example labels when all initial values are valid", () => {
    const html = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: "240",
          missedReplyPercent: "25",
          missingFollowupPercent: "20",
          conversionPercent: "10",
          averageSaleValue: "5000",
        },
      }),
    );
    const text = plainText(html);

    expect(html).toContain('aria-live="polite"');
    expect(text).toContain("Leads at risk each month");
    expect(text).toContain("Potential customers at risk");
    expect(text).toContain("Estimated monthly revenue at risk");
    expect(text).toContain("Estimated annual revenue at risk");
    expect(text).toContain("96");
    expect(text).toContain("9.6");
    expect(text).toMatch(/₹48,000/);
    expect(text).toMatch(/₹5,76,000/);
  });

  it("keeps incomplete or invalid initial values in the instructional state", () => {
    const incomplete = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: "240",
          missedReplyPercent: "101",
          missingFollowupPercent: "20",
          conversionPercent: "10",
          averageSaleValue: "5000",
        },
      }),
    );

    expect(plainText(incomplete)).toMatch(/enter all five values/i);
    expect(plainText(incomplete)).not.toContain(
      "Estimated monthly revenue at risk",
    );
  });

  it("explains an invalid percentage and connects the input to help and error text", () => {
    const html = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: "240",
          missedReplyPercent: "101",
          missingFollowupPercent: "20",
          conversionPercent: "10",
          averageSaleValue: "5000",
        },
      }),
    );
    const input = html.match(
      /<input[^>]*id="missed-reply-percent"[^>]*>/,
    )?.[0] ?? "";

    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain(
      'aria-describedby="missed-reply-percent-hint missed-reply-percent-error"',
    );
    expect(html).toContain('id="missed-reply-percent-hint"');
    expect(html).toContain('id="missed-reply-percent-error"');
    expect(plainText(html)).toContain("Enter a percentage from 0 to 100.");
  });

  it("explains invalid non-percent values with non-negative-number guidance", () => {
    const html = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: "not-a-number",
          missedReplyPercent: "25",
          missingFollowupPercent: "20",
          conversionPercent: "10",
          averageSaleValue: "-5000",
        },
      }),
    );

    for (const id of ["monthly-leads", "average-sale-value"]) {
      const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
      expect(input).toContain('aria-invalid="true"');
      expect(input).toContain(`${id}-hint ${id}-error`);
    }
    expect(plainText(html).match(/Enter a non-negative number\./g)).toHaveLength(2);
  });

  it("clears field errors and updates the estimate after corrected values", () => {
    const corrected = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: "240",
          missedReplyPercent: "25",
          missingFollowupPercent: "20",
          conversionPercent: "10",
          averageSaleValue: "5000",
        },
      }),
    );
    const input = corrected.match(
      /<input[^>]*id="missed-reply-percent"[^>]*>/,
    )?.[0] ?? "";
    const liveRegion = corrected.match(
      /<p[^>]*aria-live="polite"[^>]*>[\s\S]*?<\/p>/,
    )?.[0] ?? "";

    expect(input).not.toContain("aria-invalid");
    expect(input).toContain(
      'aria-describedby="missed-reply-percent-hint"',
    );
    expect(corrected).not.toContain('id="missed-reply-percent-error"');
    expect(plainText(liveRegion)).toContain(
      "Estimate updated: 96 leads and ₹48,000 monthly revenue at risk.",
    );
    expect(liveRegion).not.toContain("Potential customers at risk");
    expect(liveRegion).not.toContain("Estimated annual revenue at risk");
    expect(liveRegion).not.toContain("aria-atomic");
    expect(plainText(corrected)).toContain("Estimated annual revenue at risk");
  });

  it("visibly discloses calculations that reach the numeric precision limit", () => {
    const html = renderToStaticMarkup(
      createElement(LeadLeakageCalculator, {
        initialValues: {
          monthlyLeads: String(Number.MAX_VALUE),
          missedReplyPercent: "100",
          missingFollowupPercent: "100",
          conversionPercent: "100",
          averageSaleValue: String(Number.MAX_VALUE),
        },
      }),
    );

    expect(plainText(html)).toMatch(
      /reached JavaScript's numeric\/precision limit.*limit rather than an exact estimate/i,
    );
  });
});
