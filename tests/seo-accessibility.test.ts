import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import { RESOURCE_LOADERS } from "@/content/resources/loaders";
import { resourceBySlug } from "@/content/resources/manifest";

const GUIDE_SLUG = "whatsapp-appointment-booking-for-clinics";
const BRAND_700 = "#047f48";
const BRAND_800 = "#0a643c";
const WHITE = "#ffffff";

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => channelToLinear(Number.parseInt(channel, 16)));
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("SEO page color contrast", () => {
  it("uses the AA brand-700 token for the shell eyebrow and primary CTA", () => {
    const html = renderToStaticMarkup(
      createElement(
        LandingShell,
        {
          breadcrumbs: [
            { name: "Home", path: "/" },
            { name: "Contrast", path: "/contrast" },
          ],
          eyebrow: "AA eyebrow",
          title: "Contrast contract",
          intro: "A deterministic render for the shared SEO shell.",
        } as Parameters<typeof LandingShell>[0],
        createElement("div"),
      ),
    );
    const eyebrow = html.match(/<p[^>]*>AA eyebrow<\/p>/)?.[0] ?? "";
    const cta = html.match(
      /<section class="mt-16[^>]*>[\s\S]*?Book a Free Demo[\s\S]*?<\/section>/,
    )?.[0] ?? "";

    expect(contrastRatio(BRAND_700, WHITE)).toBeCloseTo(5.0792, 4);
    expect(contrastRatio(BRAND_700, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BRAND_800, WHITE)).toBeCloseTo(7.2388, 4);
    expect(contrastRatio(BRAND_800, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(eyebrow).toContain("text-brand-700");
    expect(eyebrow).not.toContain("text-[#06c167]");
    expect(cta).toContain("bg-brand-700");
    expect(cta).toContain("text-white");
    expect(cta).toContain("hover:bg-brand-800");
    expect(cta).not.toContain("bg-[#06c167]");
  });

  it("uses the same AA action token for the guide CTA and checklist marks", async () => {
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(
      createElement(resourceModule.default, { resource }),
    );
    const guideCta = html.match(
      /<a[^>]*href="\/industries\/clinics"[^>]*>/,
    )?.[0] ?? "";
    const checklist = html.match(
      /<section aria-labelledby="implementation-checklist"[\s\S]*?<\/section>/,
    )?.[0] ?? "";

    expect(guideCta).toContain("bg-brand-700");
    expect(guideCta).toContain("text-white");
    expect(guideCta).toContain("hover:bg-brand-800");
    expect(checklist).not.toContain("bg-[#06c167]");
    expect(checklist).toContain("bg-brand-700");
  });
});
