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
  formatResourceDate,
  publishedResourceEntries,
  publishedResources,
  resourceBySlug,
  resourceRouteParams,
  selectPublishedResources,
  type ResourceRecord,
} from "@/content/resources/manifest";
import {
  SEO_PAGES,
  metadataFor,
  resourceSeoPages,
  seoPage,
  sitemapEntries,
} from "@/modules/marketing/seo-pages";

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

  it("returns undefined for unknown resources", () => {
    expect(resourceBySlug("missing")).toBeUndefined();
  });

  it("excludes draft records through the production publication filter", () => {
    const published = publishedResources()[0];
    const records = [
      published,
      { ...published, slug: "draft-clinic-guide", draft: true as const },
    ] as const;

    expect(selectPublishedResources(records).map((resource) => resource.slug)).toEqual([
      "whatsapp-appointment-booking-for-clinics",
    ]);
  });

  it("keeps draft fixtures out of route params, navigation and sitemap output", () => {
    const published = publishedResources()[0];
    const records = [
      published,
      {
        ...published,
        slug: "draft-clinic-guide",
        title: "Draft clinic guide",
        draft: true as const,
      },
    ] as const satisfies readonly ResourceRecord[];

    expect(resourceRouteParams(records)).toEqual([{ slug: GUIDE_SLUG }]);
    expect(publishedResourceEntries(records).map((item) => item.href)).toEqual([
      `/resources/${GUIDE_SLUG}`,
    ]);
    expect(
      sitemapEntries(resourceSeoPages(records)).map((entry) => entry.url),
    ).toEqual([
      `https://nudgeagent.app/resources/${GUIDE_SLUG}`,
    ]);
  });

  it("derives resource SEO facts from the manifest", () => {
    const resource = publishedResources()[0];
    const path = `/resources/${resource.slug}` as const;
    const page = seoPage(path);
    const sitemapEntry = sitemapEntries().find(
      (entry) => entry.url === `https://nudgeagent.app${path}`,
    );

    expect(page).toMatchObject({
      path,
      title: resource.title,
      description: resource.description,
      modifiedAt: resource.modifiedAt,
    });
    expect(metadataFor(path)).toMatchObject({
      title: resource.title,
      description: resource.description,
    });
    expect(sitemapEntry?.lastModified).toEqual(
      new Date(`${resource.modifiedAt}T00:00:00.000Z`),
    );

    const changedManifestFact = {
      ...resource,
      title: "Fixture title controlled by the manifest",
      description:
        "Fixture description controlled by the resource manifest for deterministic metadata behavior.",
      modifiedAt: "2026-01-05",
    } as const satisfies ResourceRecord;
    expect(resourceSeoPages([changedManifestFact])[0]).toMatchObject({
      title: changedManifestFact.title,
      description: changedManifestFact.description,
      modifiedAt: changedManifestFact.modifiedAt,
    });
    expect(
      SEO_PAGES.filter((candidate) => candidate.path.startsWith("/resources/")),
    ).toEqual(resourceSeoPages(publishedResources()));
  });

  it("formats manifest dates deterministically for visible copy", () => {
    expect(formatResourceDate("2026-01-05")).toBe("5 January 2026");
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
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(
      createElement(resourceModule.default, { resource }),
    );
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
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(
      createElement(resourceModule.default, { resource }),
    );
    const policyLink = html.match(
      /<a[^>]*href="https:\/\/whatsappbusiness\.com\/policy\/"[^>]*>/,
    )?.[0];

    expect(plainText(html)).toContain("24-hour customer service window");
    expect(plainText(html)).toContain("approved message template");
    expect(policyLink).toBeDefined();
    expect(policyLink!).toContain('target="_blank"');
    expect(policyLink!).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="/industries/clinics"');
  });

  it("attributes the financial-data policy next to the deposits guidance", async () => {
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(
      createElement(resourceModule.default, { resource }),
    );
    const depositsSection = html.match(
      /<section aria-labelledby="deposits"[\s\S]*?<\/section>/,
    )?.[0];
    const policyLink = depositsSection?.match(
      /<a[^>]*href="https:\/\/whatsappbusiness\.com\/policy\/"[^>]*>/,
    )?.[0];

    expect(plainText(depositsSection ?? "")).toContain(
      "full card or financial-account details",
    );
    expect(policyLink).toBeDefined();
    expect(policyLink!).toContain('target="_blank"');
    expect(policyLink!).toContain('rel="noopener noreferrer"');
  });

  it("renders the byline and publication date supplied by the manifest", async () => {
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const fixture = {
      ...resource,
      authorName: "Fixture editorial team",
      publishedAt: "2026-01-05",
    } as const satisfies ResourceRecord;
    const resourceModule = await RESOURCE_LOADERS[GUIDE_SLUG]();
    const html = renderToStaticMarkup(
      createElement(resourceModule.default, { resource: fixture }),
    );
    const articleHeader = html.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";

    expect(plainText(articleHeader)).toContain("By Fixture editorial team");
    expect(articleHeader).toMatch(/datetime="2026-01-05"/i);
    expect(plainText(articleHeader)).toContain("Published 5 January 2026");
    expect(plainText(articleHeader)).not.toContain("14 September 2026");
  });
});

describe("resource routes", () => {
  it("lists the published guide with canonical metadata", () => {
    const html = renderToStaticMarkup(createElement(ResourcesPage));
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((match) => JSON.parse(match[1])) as Array<Record<string, unknown>>;

    expect(resourcesMetadata.alternates?.canonical).toBe(
      "https://nudgeagent.app/resources",
    );
    expect(html).toContain('href="/resources/whatsapp-appointment-booking-for-clinics"');
    expect(plainText(html)).toContain(
      "WhatsApp Appointment Booking for Clinics: An Operational Guide",
    );
    expect(html).toMatch(/datetime="2026-09-14"/i);
    expect(plainText(html)).toContain("14 September 2026");
    expect(scripts).toContainEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://nudgeagent.app/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Resources",
          item: "https://nudgeagent.app/resources",
        },
      ],
    });
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
    const resource = resourceBySlug(GUIDE_SLUG)!;
    const element = await ResourcePage({
      params: Promise.resolve({ slug: GUIDE_SLUG }),
    });
    const html = renderToStaticMarkup(element);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1])) as Array<Record<string, unknown>>;

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(scripts.find((value) => value["@type"] === "Article")).toMatchObject({
      headline: resource.title,
      description: resource.description,
      datePublished: resource.publishedAt,
      dateModified: resource.modifiedAt,
      author: { name: resource.authorName },
    });
  });

  it("returns not found before attempting to load an unknown resource", async () => {
    await expect(
      ResourcePage({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
