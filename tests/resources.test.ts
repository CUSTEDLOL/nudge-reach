import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResourcePage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/resources/[slug]/page";
import ResourcesPage, { metadata as resourcesMetadata } from "@/app/resources/page";
import { RESOURCE_LOADERS } from "@/content/resources/loaders";
import {
  publishedResources,
  resourceBySlug,
} from "@/content/resources/manifest";

const GUIDE_SLUG = "whatsapp-appointment-booking-for-clinics";

function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

describe("resource manifest", () => {
  it("publishes unique canonical slugs with honest dates", () => {
    const resources = publishedResources();
    expect(resources.map((item) => item.slug)).toEqual([
      "whatsapp-appointment-booking-for-clinics",
    ]);
    expect(new Set(resources.map((item) => item.slug)).size).toBe(resources.length);
    expect(resources[0]).toMatchObject({
      publishedAt: "2026-09-14",
      modifiedAt: "2026-09-14",
      parentPath: "/industries/clinics",
      draft: false,
    });
  });

  it("returns undefined for unknown or draft resources", () => {
    expect(resourceBySlug("missing")).toBeUndefined();
  });
});

describe("published resource loading", () => {
  it("keeps loader keys aligned with published manifest slugs", () => {
    expect(Object.keys(RESOURCE_LOADERS)).toEqual(
      publishedResources().map((resource) => resource.slug),
    );
    expect(
      (RESOURCE_LOADERS as Record<string, unknown>).missing,
    ).toBeUndefined();
  });

  it("renders the guide as an ordered article without taking route H1 ownership", async () => {
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(createElement(resourceModule.default));
    const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(
      (match) => plainText(match[1]),
    );

    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).not.toContain("<h1");
    expect(headings).toEqual([
      "Start with the booking outcome, not the bot",
      "Keep one availability source of truth",
      "Collect only what the clinic needs",
      "Separate replies from re-engagement",
      "Confirm, remind and recover",
      "Use deposits deliberately",
      "Design the human handoff",
      "Measure the full journey",
      "Implementation checklist",
    ]);
    expect(plainText(html)).toContain("Nudge team");
    expect(html).toMatch(/datetime="2026-09-14"/i);
    expect(plainText(html)).toContain("Operational product guidance");
    expect(plainText(html)).toContain("not medical or legal advice");
  });

  it("supports policy claims with a safe official primary-source link", async () => {
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(createElement(resourceModule.default));
    const policyLink = html.match(
      /<a[^>]*href="https:\/\/whatsappbusiness\.com\/policy\/"[^>]*>/,
    )?.[0];

    expect(plainText(html)).toContain("24-hour customer service window");
    expect(plainText(html)).toContain("approved message template");
    expect(policyLink).toContain('target="_blank"');
    expect(policyLink).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="/industries/clinics"');
  });
});

describe("resource routes", () => {
  it("lists the published guide with canonical metadata", () => {
    const html = renderToStaticMarkup(createElement(ResourcesPage));

    expect(resourcesMetadata.alternates?.canonical).toBe(
      "https://nudgeagent.app/resources",
    );
    expect(html).toContain('href="/resources/whatsapp-appointment-booking-for-clinics"');
    expect(plainText(html)).toContain(
      "WhatsApp Appointment Booking for Clinics: An Operational Guide",
    );
  });

  it("pre-renders only published resources and derives their metadata", async () => {
    expect(generateStaticParams()).toEqual([{ slug: GUIDE_SLUG }]);
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: GUIDE_SLUG }) }),
    ).resolves.toMatchObject({
      title: "WhatsApp Appointment Booking for Clinics: An Operational Guide",
      alternates: {
        canonical:
          "https://nudgeagent.app/resources/whatsapp-appointment-booking-for-clinics",
      },
    });
  });

  it("renders one route-owned H1, visible breadcrumbs and Article JSON-LD", async () => {
    const element = await ResourcePage({
      params: Promise.resolve({ slug: GUIDE_SLUG }),
    });
    const html = renderToStaticMarkup(element);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1])) as Array<Record<string, unknown>>;

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(scripts.find((value) => value["@type"] === "Article")).toMatchObject({
      headline: "WhatsApp Appointment Booking for Clinics: An Operational Guide",
      datePublished: "2026-09-14",
      dateModified: "2026-09-14",
    });
  });

  it("returns not found before attempting to load an unknown resource", async () => {
    await expect(
      ResourcePage({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
