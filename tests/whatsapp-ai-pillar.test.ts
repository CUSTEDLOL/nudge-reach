import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhatsAppAiAutomationPage, {
  metadata,
} from "@/app/whatsapp-ai-automation/page";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";

const PATH = "/whatsapp-ai-automation";

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const html = renderToStaticMarkup(createElement(WhatsAppAiAutomationPage));
const text = plainText(html);

describe("WhatsApp AI automation pillar", () => {
  it("owns the topic with one route H1 and registry-derived canonical metadata", () => {
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(
      (match) => plainText(match[1]),
    );
    const registeredMetadata = metadataFor(PATH);

    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toMatch(/WhatsApp AI automation/i);
    expect(metadata).toMatchObject({
      title: registeredMetadata.title,
      description: registeredMetadata.description,
      alternates: { canonical: `${SITE_ORIGIN}${PATH}` },
    });
  });

  it("explains the complete action-oriented system in a useful order", () => {
    const orderedSections = [
      "What WhatsApp AI automation means",
      "The complete workflow",
      "The architecture behind the conversation",
      "Replies versus actions",
      "Lead capture and qualification",
      "Follow-up rules",
      "Business examples",
      "Build versus buy",
      "Next steps",
    ];
    let previousIndex = -1;

    for (const heading of orderedSections) {
      const index = text.indexOf(heading);
      expect(index, `missing section: ${heading}`).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(text).toContain(
      "Inbound message → consent/context check → grounded answer → qualification → business action → status/owner → compliant follow-up → human handoff",
    );
  });

  it("provides crawlable next-step links", () => {
    for (const href of [
      "/resources/how-to-build-whatsapp-ai-automation",
      "/resources/how-to-stop-losing-leads-on-whatsapp",
      "/tools/whatsapp-lead-leakage-calculator",
      "/pricing",
      "/",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("attributes platform and messaging-policy claims to official sources", () => {
    for (const href of [
      "https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform",
      "https://whatsappbusiness.com/policy/",
    ]) {
      const link = [...html.matchAll(/<a[^>]*>/g)]
        .map((match) => match[0])
        .find((anchor) => anchor.includes(`href="${href}"`));

      expect(link).toBeDefined();
      expect(link!).toContain('target="_blank"');
      expect(link!).toContain('rel="noopener noreferrer"');
    }
  });

  it("uses a legible normal-text color for the reply label", () => {
    const replyLabel = html.match(/<p[^>]*>Reply only<\/p>/)?.[0] ?? "";

    expect(replyLabel).toContain("text-ink/65");
    expect(replyLabel).not.toContain("text-ink/45");
  });

  it("keeps the complete workflow readable on mobile without forced horizontal scrolling", () => {
    const workflowSection = html.match(
      /<section aria-labelledby="complete-workflow">[\s\S]*?<\/section>/,
    )?.[0] ?? "";

    expect(workflowSection).not.toContain("overflow-x-auto");
    expect(workflowSection).not.toContain("min-w-[48rem]");
    expect(plainText(workflowSection)).toContain(
      "Inbound message → consent/context check → grounded answer → qualification → business action → status/owner → compliant follow-up → human handoff",
    );
  });

  it("publishes one breadcrumb schema and no unsupported proof claims", () => {
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((match) => JSON.parse(match[1])) as Array<Record<string, unknown>>;

    expect(scripts.filter((value) => value["@type"] === "BreadcrumbList")).toHaveLength(1);
    expect(text).not.toMatch(/the #1|trusted by \d+|\d+% (?:more|increase|lift)/i);
    expect(text).not.toMatch(/guaranteed (?:results|revenue|leads|conversion)/i);
  });
});
