import type { MetadataRoute } from "next";

const BASE = "https://nudge-reach.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated product surfaces and API routes carry no SEO value.
      disallow: [
        "/api/",
        "/dashboard",
        "/inbox",
        "/contacts",
        "/campaigns",
        "/templates",
        "/automations",
        "/agent",
        "/analytics",
        "/integrations",
        "/settings",
        "/onboarding",
        "/conversations",
        "/auth/",
        "/login",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
