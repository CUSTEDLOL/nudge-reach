import type { Metadata, MetadataRoute } from "next";
import {
  RESOURCE_MANIFEST,
  publishedResourceEntries,
  type ResourceRecord,
} from "@/content/resources/manifest";

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

interface ResourceSeoPage extends SeoPage {
  path: `/resources/${string}`;
}

export function resourceSeoPages(
  resources: readonly ResourceRecord[],
): ResourceSeoPage[] {
  return publishedResourceEntries(resources).map((resource) => ({
    path: resource.href,
    title: resource.title,
    description: resource.description,
    modifiedAt: resource.modifiedAt,
    changeFrequency: "monthly",
    priority: 0.6,
    index: true,
  }));
}

export const SEO_PAGES = [
  {
    path: "/",
    title: "Nudge: the AI Front Desk that runs your WhatsApp",
    description: "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk books into your real calendar, follows up with quiet leads, collects payments, and is set up with you.",
    modifiedAt: "2026-09-17",
    changeFrequency: "weekly",
    priority: 1,
    index: true,
  },
  {
    path: "/industries/clinics",
    title: "AI Front Desk for Clinics in India on WhatsApp",
    description: "AI Front Desk for aesthetic dermatology, cosmetic dental and hair transplant clinics in India, with WhatsApp booking, follow-up, payment links and handoff.",
    modifiedAt: "2026-09-15",
    changeFrequency: "monthly",
    priority: 0.9,
    index: true,
  },
  {
    path: "/whatsapp-ai-automation",
    title: "WhatsApp AI Automation: From Reply to Qualified Lead",
    description: "Learn how WhatsApp AI automation captures and qualifies leads, takes real business actions, follows up compliantly, and hands conversations to your team.",
    modifiedAt: "2026-09-17",
    changeFrequency: "monthly",
    priority: 0.9,
    index: true,
  },
  {
    path: "/tools/whatsapp-lead-leakage-calculator",
    title: "WhatsApp Lead Leakage Calculator",
    description: "Estimate the value of unanswered WhatsApp enquiries using your own lead volume, response rate, conversion rate, and average customer value.",
    modifiedAt: "2026-09-17",
    changeFrequency: "monthly",
    priority: 0.8,
    index: true,
  },
  {
    path: "/resources",
    title: "AI Front Desk Resources and Operational Guides",
    description: "Practical guides for connecting WhatsApp enquiries to real availability, confirmed bookings, compliant follow-ups, payments and human handoff.",
    modifiedAt: "2026-09-17",
    changeFrequency: "weekly",
    priority: 0.7,
    index: true,
  },
  ...resourceSeoPages(RESOURCE_MANIFEST),
  {
    path: "/pricing",
    title: "Pricing",
    description: "Entry ₹1,499, Starter ₹4,999, Growth ₹9,999 and Pro ₹19,999 a month in India, with included AI credits and no setup fee.",
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
    modifiedAt: "2026-09-15",
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
    openGraph: {
      title: page.title,
      description: page.description,
      siteName: "Nudge",
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
    robots: page.index ? undefined : { index: false, follow: false },
  };
}

export function sitemapEntries(
  pages: readonly SeoPage[] = SEO_PAGES,
): MetadataRoute.Sitemap {
  return pages.filter((page) => page.index).map((page) => ({
    url: `${SITE_ORIGIN}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(`${page.modifiedAt}T00:00:00.000Z`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
