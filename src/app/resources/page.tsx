import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import { publishedResources } from "@/content/resources/manifest";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";

const path = "/resources";

export const metadata: Metadata = {
  ...metadataFor(path),
  alternates: { canonical: `${SITE_ORIGIN}${path}` },
};

export default function ResourcesPage() {
  const resources = publishedResources();

  return (
    <LandingShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Resources", path },
      ]}
      eyebrow="Resources"
      title="Operating guides for an AI Front Desk"
      intro="Practical, evidence-backed guides for connecting WhatsApp conversations to the calendars, follow-ups, payments and people that move a customer forward."
      ctaTitle="Put the operating model into practice"
      ctaBody="See how Nudge turns a documented front-desk workflow into a connected, done-for-you system."
    >
      <section aria-labelledby="resource-list-title">
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
                <p className="font-bold text-brand-700">For clinics</p>
                <p className="mt-2">{resource.authorName}</p>
                <time dateTime={resource.publishedAt} className="mt-1 block">
                  14 September 2026
                </time>
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
                  <Link href={`/resources/${resource.slug}`} className="hover:text-brand-700">
                    {resource.title}
                  </Link>
                </h3>
                <p className="mt-4 max-w-2xl leading-7 text-ink/65">{resource.excerpt}</p>
              </div>
              <Link
                href={`/resources/${resource.slug}`}
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
  );
}
