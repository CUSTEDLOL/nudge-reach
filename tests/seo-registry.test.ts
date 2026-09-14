import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as termsMetadata } from "@/app/terms/page";
import {
  SEO_PAGES,
  metadataFor,
  seoPage,
} from "@/modules/marketing/seo-pages";

describe("SEO page registry", () => {
  it("has one absolute canonical per unique path", () => {
    const paths = SEO_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of SEO_PAGES) {
      expect(metadataFor(page.path).alternates?.canonical).toBe(page.path);
      expect(page.title.trim()).not.toBe("");
      expect(page.description.length).toBeGreaterThanOrEqual(80);
    }
  });

  it("uses reviewed dates instead of the current clock", () => {
    expect(seoPage("/").modifiedAt).toBe("2026-09-12");
    expect(seoPage("/industries/clinics").modifiedAt).toBe("2026-09-14");
    expect(seoPage("/pricing").modifiedAt).toBe("2026-09-12");
    expect(seoPage("/faq").modifiedAt).toBe("2026-07-19");
    expect(seoPage("/privacy").modifiedAt).toBe("2026-07-19");
    expect(seoPage("/terms").modifiedAt).toBe("2026-07-05");
  });

  it("uses registry metadata for legal pages", () => {
    expect(privacyMetadata).toEqual(metadataFor("/privacy"));
    expect(termsMetadata).toEqual(metadataFor("/terms"));
  });

  it("builds the sitemap from every published registry page", () => {
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      SEO_PAGES.filter((page) => page.index).map(
        (page) => `https://nudgeagent.app${page.path === "/" ? "" : page.path}`,
      ),
    );
    expect(entries.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });
});
