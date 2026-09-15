import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "@/components/marketing/seo/breadcrumbs";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import {
  articleJsonLd,
  breadcrumbJsonLd,
} from "@/modules/marketing/structured-data";

describe("marketing structured data", () => {
  it("builds absolute ordered breadcrumbs", () => {
    const value = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Clinics", path: "/industries/clinics" },
    ]);

    expect(value["@type"]).toBe("BreadcrumbList");
    expect(value.itemListElement[1]).toMatchObject({
      position: 2,
      item: "https://nudgeagent.app/industries/clinics",
    });
  });

  it("keeps article facts aligned to the visible resource", () => {
    const value = articleJsonLd({
      headline: "WhatsApp appointment booking for clinics",
      description:
        "An operational guide for clinic owners evaluating WhatsApp appointment booking.",
      path: "/resources/whatsapp-appointment-booking-for-clinics",
      publishedAt: "2026-09-14",
      modifiedAt: "2026-09-14",
      authorName: "Nudge team",
    });

    expect(value).toMatchObject({
      "@type": "Article",
      datePublished: "2026-09-14",
      dateModified: "2026-09-14",
    });
    expect(value.mainEntityOfPage).toContain("/resources/");
  });

  it("renders one safe, parseable JSON-LD script", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "Thing",
      name: "Nudge </script><script>unsafe()</script>",
    };

    const html = renderToStaticMarkup(createElement(JsonLd, { value }));

    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toContain("</script><script>");
    const content = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
    expect(content).toBeDefined();
    expect(JSON.parse(content!)).toEqual(value);
  });

  it("renders the current breadcrumb as wrapping text instead of a link", () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumbs, {
        items: [
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
          {
            name: "A deliberately long current resource title for a narrow mobile viewport",
            path: "/resources/long-title",
          },
        ],
      }),
    );
    const crumbs = [...html.matchAll(/<li[^>]*>[\s\S]*?<\/li>/g)].map(
      (match) => match[0],
    );
    const current = crumbs.at(-1) ?? "";

    expect(html.match(/<a /g)).toHaveLength(2);
    expect(current).toContain('aria-current="page"');
    expect(current).not.toContain("<a ");
    expect(current).toContain("max-w-full");
    expect(current).toContain("min-w-0");
    expect(current).toContain("shrink-0");
    expect(current).toContain("break-words");
  });
});
