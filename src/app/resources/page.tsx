import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import {
  formatResourceDate,
  publishedResourceEntries,
  RESOURCE_MANIFEST,
} from "@/content/resources/manifest";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";
import { breadcrumbJsonLd } from "@/modules/marketing/structured-data";

const path = "/resources";
const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Resources", path },
];

export const metadata: Metadata = {
  ...metadataFor(path),
  alternates: { canonical: `${SITE_ORIGIN}${path}` },
};

export default function ResourcesPage() {
  const resources = publishedResourceEntries(RESOURCE_MANIFEST);

  return (
    <>
      <JsonLd value={breadcrumbJsonLd(breadcrumbs)} />
      <LandingShell
        breadcrumbs={breadcrumbs}
        eyebrow="Resources"
        title="Operating guides for an AI Front Desk"
        intro="Practical, evidence-backed guides for connecting WhatsApp conversations to the calendars, follow-ups, payments and people that move a customer forward."
        ctaTitle="Put the operating model into practice"
        ctaBody="See how Nudge turns a documented front-desk workflow into a connected, done-for-you system."
        surface="resource"
      >
        <section aria-labelledby="featured-tools-title">
          <div className="border-y-2 border-ink py-8 sm:py-10">
            <h2
              id="featured-tools-title"
              className="max-w-2xl text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Understand the system. Find the leaks.
            </h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)] lg:gap-0">
              <div className="lg:pr-10">
                <h3 className="text-xl font-black text-ink sm:text-2xl">
                  <Link
                    href="/whatsapp-ai-automation"
                    className="hover:text-brand-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                  >
                    Learn how WhatsApp AI automation works
                  </Link>
                </h3>
                <p className="mt-3 max-w-2xl leading-7 text-ink/65">
                  Follow the complete path from an inbound message to a grounded
                  answer, qualified lead, business action, compliant follow-up
                  and human handoff.
                </p>
              </div>
              <div className="border-t border-ink/20 pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <h3 className="text-lg font-black text-ink sm:text-xl">
                  <Link
                    href="/tools/whatsapp-lead-leakage-calculator"
                    className="hover:text-brand-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                  >
                    Estimate your WhatsApp lead leakage
                  </Link>
                </h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Use the free calculator to estimate the leads and revenue that
                  may be at risk when replies or follow-ups are missed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="resource-list-title"
          className="mt-16 sm:mt-20"
        >
          <h2 id="resource-list-title" className="sr-only">
            Published resources
          </h2>
          <div className="border-t-2 border-ink">
            {resources.map((resource) => (
              <article
                key={resource.slug}
                className="grid gap-5 border-b border-ink/15 py-8 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start sm:gap-8 sm:py-10"
              >
                <div className="text-sm text-ink/55">
                  <p className="font-bold text-brand-700">
                    {resource.audienceLabel}
                  </p>
                  <p className="mt-2">{resource.authorName}</p>
                  <time dateTime={resource.publishedAt} className="mt-1 block">
                    {formatResourceDate(resource.publishedAt)}
                  </time>
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
                    <Link href={resource.href} className="hover:text-brand-700">
                      {resource.title}
                    </Link>
                  </h3>
                  <p className="mt-4 max-w-2xl leading-7 text-ink/65">
                    {resource.excerpt}
                  </p>
                </div>
                <Link
                  href={resource.href}
                  aria-label={`Read ${resource.title}`}
                  className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink/70 text-ink transition-colors hover:bg-[#d3f8e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </LandingShell>
    </>
  );
}
