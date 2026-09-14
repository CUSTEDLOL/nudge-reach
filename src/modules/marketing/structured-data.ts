import { SITE_ORIGIN } from "./seo-pages";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface ArticleSchemaInput {
  headline: string;
  description: string;
  path: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  };
}

export function articleJsonLd(input: ArticleSchemaInput) {
  const url = `${SITE_ORIGIN}${input.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: url,
    url,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt,
    author: {
      "@type": "Organization",
      name: input.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "Nudge",
      url: SITE_ORIGIN,
    },
  };
}
