import type { MetadataRoute } from "next";

const BASE = "https://nudgeagent.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Protected app routes redirect anonymous visitors to the crawlable,
      // noindex login response. Authentication remains the access boundary.
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
