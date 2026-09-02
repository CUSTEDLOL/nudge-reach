import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("landing page document integrations", () => {
  it("places the GTM loader and Facebook verification in head", () => {
    const head = layout.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";

    expect(head).toContain("GTM-WTMGT6DJ");
    expect(head).toContain('name="facebook-domain-verification"');
    expect(head).toContain('content="uh9j91b9gh8qxdt3bxezjqlpa82fil"');
  });

  it("places the GTM noscript fallback first in body", () => {
    const body = layout.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? "";

    expect(body.indexOf("<noscript>")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("<noscript>")).toBeLessThan(body.indexOf("{children}"));
    expect(body).toContain("googletagmanager.com/ns.html?id=GTM-WTMGT6DJ");
  });
});
