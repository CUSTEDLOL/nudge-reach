import type { Metadata, MetadataRoute } from "next";

export const SITE_ORIGIN = "https://nudgeagent.app";

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  modifiedAt: `${number}-${number}-${number}`;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  index: boolean;
}

export const SEO_PAGES = [
  {
    path: "/",
    title: "Nudge: the AI Front Desk that runs your WhatsApp",
    description: "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk books into your real calendar, follows up with quiet leads, collects payments, and is set up with you.",
    modifiedAt: "2026-09-12",
    changeFrequency: "weekly",
    priority: 1,
    index: true,
  },
  {
    path: "/pricing",
    title: "Pricing",
    description: "Compare Nudge AI Front Desk plans for WhatsApp replies, team inboxes, real calendar booking, payment links, compliant follow-ups, voice, and custom actions.",
    modifiedAt: "2026-09-12",
    changeFrequency: "weekly",
    priority: 0.9,
    index: true,
  },
  {
    path: "/faq",
    title: "Frequently asked questions",
    description: "Answers about Nudge setup, pricing, trials, the official WhatsApp Cloud API, business-specific AI, calendar booking, follow-ups, payments, and data handling.",
    modifiedAt: "2026-07-19",
    changeFrequency: "monthly",
    priority: 0.6,
    index: true,
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    description: "Read how Nudge handles account, conversation, customer, integration and usage data for its business-specific AI Front Desk and WhatsApp workspace.",
    modifiedAt: "2026-07-19",
    changeFrequency: "yearly",
    priority: 0.2,
    index: true,
  },
  {
    path: "/terms",
    title: "Terms of service",
    description: "Read the terms that govern business use of Nudge, including accounts, WhatsApp messaging, acceptable use, subscriptions, integrations and service limitations.",
    modifiedAt: "2026-07-05",
    changeFrequency: "yearly",
    priority: 0.2,
    index: true,
  },
] as const satisfies readonly SeoPage[];

export type SeoPagePath = (typeof SEO_PAGES)[number]["path"];

export function seoPage(path: SeoPagePath): (typeof SEO_PAGES)[number] {
  const page = SEO_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`Unregistered SEO page: ${path}`);
  return page;
}

export function metadataFor(path: SeoPagePath): Metadata {
  const page = seoPage(path);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    robots: page.index ? undefined : { index: false, follow: false },
  };
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  return SEO_PAGES.filter((page) => page.index).map((page) => ({
    url: `${SITE_ORIGIN}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(`${page.modifiedAt}T00:00:00.000Z`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
