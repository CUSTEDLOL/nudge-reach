import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import ResourcesPage from "@/app/resources/page";

const HOME_PILLAR_PATH = "/whatsapp-ai-automation";
const RESOURCE_PATHS = [
  HOME_PILLAR_PATH,
  "/resources/how-to-build-whatsapp-ai-automation",
  "/resources/how-to-stop-losing-leads-on-whatsapp",
  "/tools/whatsapp-lead-leakage-calculator",
] as const;

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anchorTextsFor(html: string, href: string): string[] {
  const pattern = new RegExp(
    `<a\\b(?=[^>]*\\bhref="${escapeRegex(href)}")[^>]*>([\\s\\S]*?)<\\/a>`,
    "g",
  );

  return [...html.matchAll(pattern)].map((match) => plainText(match[1]));
}

function expectDescriptiveLink(html: string, href: string) {
  const labels = anchorTextsFor(html, href).filter(Boolean);

  expect(labels, `missing crawlable link to ${href}`).not.toHaveLength(0);
  expect(labels.some((label) => label.toLowerCase() === "read more")).toBe(false);
  expect(labels.some((label) => label.split(/\s+/).length >= 3)).toBe(true);
}

describe("WhatsApp AI content cluster links", () => {
  it("links the homepage to the WhatsApp AI automation pillar with descriptive text", () => {
    const html = renderToStaticMarkup(createElement(Home));

    expectDescriptiveLink(html, HOME_PILLAR_PATH);
  });

  it("links Resources to the pillar, both broad guides and the lead leakage tool", () => {
    const html = renderToStaticMarkup(createElement(ResourcesPage));

    for (const href of RESOURCE_PATHS) {
      expectDescriptiveLink(html, href);
    }
  });
});
