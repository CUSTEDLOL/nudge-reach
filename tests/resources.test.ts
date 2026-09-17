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
const BUILD_GUIDE_SLUG = "how-to-build-whatsapp-ai-automation";
const LEAD_GUIDE_SLUG = "how-to-stop-losing-leads-on-whatsapp";
const PUBLISHED_SLUGS = [BUILD_GUIDE_SLUG, LEAD_GUIDE_SLUG, GUIDE_SLUG] as const;

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
    expect(resources.map((item) => item.slug)).toEqual(PUBLISHED_SLUGS);
    expect(new Set(resources.map((item) => item.slug)).size).toBe(resources.length);
    expect(resourceBySlug(GUIDE_SLUG)).toMatchObject({
      publishedAt: "2026-09-14",
      modifiedAt: "2026-09-14",
      parentPath: "/industries/clinics",
      audienceLabel: "For clinics",
      eyebrow: "Clinic operations guide",
      ctaTitle: "See the complete clinic workflow",
      ctaBody:
        "Walk through real availability, a confirmed booking, compliant follow-up and human handoff in one practical Nudge demo.",
      draft: false,
    });
  });

  it("registers the broad WhatsApp AI guides with their publication copy", () => {
    expect(resourceBySlug(BUILD_GUIDE_SLUG)).toEqual({
      slug: BUILD_GUIDE_SLUG,
      title: "How to Build WhatsApp AI Automation with the Official Cloud API",
      description:
        "Learn the architecture behind a reliable WhatsApp AI automation: Cloud API webhooks, business knowledge, AI replies, actions, follow-ups and human handoff.",
      excerpt:
        "A practical system map for moving from an inbound WhatsApp message to a grounded reply, business action, compliant follow-up and human handoff.",
      publishedAt: "2026-09-17",
      modifiedAt: "2026-09-17",
      authorName: "Nudge team",
      parentPath: "/whatsapp-ai-automation",
      audienceLabel: "Build guide",
      eyebrow: "WhatsApp AI build guide",
      ctaTitle: "Prefer a working AI Front Desk to a build project?",
      ctaBody:
        "Nudge connects the official WhatsApp Cloud API to your business knowledge, calendars, follow-ups, payments and human team, then helps you set it up.",
      draft: false,
    });
    expect(resourceBySlug(LEAD_GUIDE_SLUG)).toEqual({
      slug: LEAD_GUIDE_SLUG,
      title: "How to Stop Losing Leads on WhatsApp",
      description:
        "Use a clear WhatsApp lead-response and follow-up workflow so every opted-in enquiry has an owner, status, next action and safe human handoff.",
      excerpt:
        "A five-state operating workflow for answering, qualifying and following up with WhatsApp leads without relying on memory or sending unwanted messages.",
      publishedAt: "2026-09-17",
      modifiedAt: "2026-09-17",
      authorName: "Nudge team",
      parentPath: "/whatsapp-ai-automation",
      audienceLabel: "Lead operations",
      eyebrow: "WhatsApp lead operations",
      ctaTitle: "Give every WhatsApp lead a next action",
      ctaBody:
        "See how Nudge answers from your business knowledge, keeps lead context, follows up with consent and hands important conversations to your team.",
      draft: false,
    });
  });

  it("returns undefined for unknown resources", () => {
    expect(resourceBySlug("missing")).toBeUndefined();
  });

  it("excludes draft records through the production publication filter", () => {
    const published = resourceBySlug(GUIDE_SLUG)!;
    const records = [
      published,
      { ...published, slug: "draft-clinic-guide", draft: true as const },
    ] as const;

    expect(selectPublishedResources(records).map((resource) => resource.slug)).toEqual([
      "whatsapp-appointment-booking-for-clinics",
    ]);
  });

  it("keeps draft fixtures out of route params, navigation and sitemap output", () => {
    const published = resourceBySlug(GUIDE_SLUG)!;
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
    const resource = resourceBySlug(GUIDE_SLUG)!;
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

  it("loads every broad guide as a valid article without taking route H1 ownership", async () => {
    for (const slug of [BUILD_GUIDE_SLUG, LEAD_GUIDE_SLUG] as const) {
      const resource = resourceBySlug(slug)!;
      const resourceModule = await RESOURCE_LOADERS[slug]();
      const html = renderToStaticMarkup(
        createElement(resourceModule.default, { resource }),
      );

      expect(html.match(/<article/g)).toHaveLength(1);
      expect(html).not.toContain("<h1");
    }
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
  it("lists the published guides with canonical metadata and manifest labels", () => {
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
    expect(plainText(html)).toContain("Build guide");
    expect(plainText(html)).toContain("Lead operations");
    expect(plainText(html)).toContain("For clinics");
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
    expect(generateStaticParams()).toEqual(
      PUBLISHED_SLUGS.map((slug) => ({ slug })),
    );
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

  it("passes each resource's manifest-owned eyebrow and CTA to the landing shell", async () => {
    const resource = resourceBySlug(BUILD_GUIDE_SLUG)!;
    const element = await ResourcePage({
      params: Promise.resolve({ slug: BUILD_GUIDE_SLUG }),
    });
    const html = renderToStaticMarkup(element);
    const text = plainText(html);

    expect(text).toContain(resource.eyebrow);
    expect(text).toContain(resource.ctaTitle);
    expect(text).toContain(resource.ctaBody);
    expect(text).not.toContain("Clinic operations guide");
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
