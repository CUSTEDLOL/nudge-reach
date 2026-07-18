import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Website → draft-facts ingestion. Invariants under test:
 *  - stripHtml produces readable line-broken text (no scripts/tags)
 *  - discoverLinks stays same-origin and prefers informative paths
 *  - heuristicFacts (the keyless path, invariant #4) categorizes price /
 *    hours / address lines deterministically
 *  - ingestWebsite stores DRAFTS (never active), org-scoped, deduped
 *    against existing facts
 */

const { prisma, assertPublicHttpsUrl } = vi.hoisted(() => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
  },
  assertPublicHttpsUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: { ANTHROPIC_API_KEY: undefined } }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  assertPublicHttpsUrl,
}));

import {
  stripHtml,
  discoverLinks,
  heuristicFacts,
  ingestWebsite,
} from "@/modules/knowledge/ingest";

describe("stripHtml", () => {
  it("drops scripts/styles/tags and keeps line structure", () => {
    const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body><h1>Glow Salon</h1><p>Haircut ₹500</p><p>Open Mon&nbsp;10 AM</p></body></html>`;
    const text = stripHtml(html);
    expect(text).toContain("Glow Salon");
    expect(text).toContain("Haircut ₹500");
    expect(text).toContain("Open Mon 10 AM");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("<");
  });
});

describe("discoverLinks", () => {
  it("keeps same-origin pages and ranks informative paths first", () => {
    const html = `
      <a href="/menu">Menu</a>
      <a href="/pricing">Prices</a>
      <a href="https://evil.example.com/menu">off-site</a>
      <a href="/blog/post-1">Blog</a>
      <a href="/logo.png">img</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/careers">Careers</a>`;
    const links = discoverLinks("https://glow.example.com/", html);
    expect(links.length).toBeLessThanOrEqual(4);
    expect(links.every((l) => l.startsWith("https://glow.example.com/"))).toBe(true);
    expect(links).toContain("https://glow.example.com/menu");
    expect(links).not.toContain("https://evil.example.com/menu");
    expect(links).not.toContain("https://glow.example.com/logo.png");
    // The keyword-less pages lose to the informative ones.
    expect(links).not.toContain("https://glow.example.com/blog/post-1");
  });
});

describe("heuristicFacts (keyless path)", () => {
  it("categorizes price, hours and address lines", () => {
    const text = [
      "Welcome to Glow Salon", // no signal → skipped
      "Classic facial ₹1,800 for 50 minutes",
      "Open Mon–Sat 10 AM to 8 PM",
      "2nd Floor, Green Plaza, MG Road, near Metro",
    ].join("\n");
    const facts = heuristicFacts(text);
    const byCat = Object.fromEntries(facts.map((f) => [f.category, f.fact]));
    expect(byCat.pricing).toContain("₹1,800");
    expect(byCat.hours).toContain("10 AM");
    expect(byCat.location).toContain("MG Road");
    expect(facts.length).toBe(3);
  });
});

describe("ingestWebsite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    prisma.knowledgeEntry.create.mockResolvedValue({});
    assertPublicHttpsUrl.mockResolvedValue(undefined);
  });

  const PAGE = `<html><body>
    <p>Haircut ₹500</p>
    <p>Open Mon–Sat 10 AM to 8 PM</p>
    <p>2nd Floor, Green Plaza, MG Road, near Metro</p>
  </body></html>`;

  it("stores draft rows, org-scoped, never active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(PAGE, { headers: { "content-type": "text/html" } })
      )
    );
    const result = await ingestWebsite("org1", "glow.example.com");
    expect(result.drafts).toBe(3);
    for (const call of prisma.knowledgeEntry.create.mock.calls) {
      expect(call[0].data.orgId).toBe("org1");
      expect(call[0].data.status).toBe("draft");
      expect(call[0].data.source).toBe("import");
    }
    vi.unstubAllGlobals();
  });

  it("dedupes against existing facts (case-insensitive)", async () => {
    prisma.knowledgeEntry.findMany.mockResolvedValue([
      { fact: "haircut ₹500" },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(PAGE, { headers: { "content-type": "text/html" } })
      )
    );
    const result = await ingestWebsite("org1", "https://glow.example.com");
    expect(result.drafts).toBe(2); // the haircut line is already known
    vi.unstubAllGlobals();
  });

  it("throws a friendly error when the start URL is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(ingestWebsite("org1", "https://down.example.com")).rejects.toThrow(
      /Couldn't read/
    );
    vi.unstubAllGlobals();
  });

  it("refuses SSRF-blocked URLs (guard consulted before fetching)", async () => {
    assertPublicHttpsUrl.mockRejectedValue(new Error("private address"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(ingestWebsite("org1", "https://10.0.0.1/")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
