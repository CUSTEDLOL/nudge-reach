import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import { RESOURCE_LOADERS } from "@/content/resources/loaders";
import { publishedResources, resourceBySlug } from "@/content/resources/manifest";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/marketing/structured-data";

interface ResourcePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return publishedResources().map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({ params }: ResourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  const path = `/resources/${resource.slug}` as const;
  return {
    ...metadataFor(path),
    alternates: { canonical: `${SITE_ORIGIN}${path}` },
  };
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  const path = `/resources/${resource.slug}` as const;
  const { default: ResourceContent } = await RESOURCE_LOADERS[resource.slug]();
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Resources", path: "/resources" },
    { name: resource.title, path },
  ];

  return (
    <>
      <JsonLd value={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd
        value={articleJsonLd({
          headline: resource.title,
          description: resource.description,
          path,
          publishedAt: resource.publishedAt,
          modifiedAt: resource.modifiedAt,
          authorName: resource.authorName,
        })}
      />
      <LandingShell
        breadcrumbs={breadcrumbs}
        eyebrow="Clinic operations guide"
        title={resource.title}
        intro={resource.description}
        ctaTitle="See the complete clinic workflow"
        ctaBody="Walk through real availability, a confirmed booking, compliant follow-up and human handoff in one practical Nudge demo."
      >
        <ResourceContent />
      </LandingShell>
    </>
  );
}
