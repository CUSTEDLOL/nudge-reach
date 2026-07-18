import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Google Business Profile import. Invariants under test:
 *  - gbpFacts is deterministic: address→location, hours packed ≤280 chars,
 *    phone→other, rating→faq; no model call involved
 *  - keyless mode uses the demo listing so the flow works with zero keys
 *    (invariant #4) — and never calls Google
 *  - live mode parses the Places response and stores drafts
 *  - a listing website chains into the crawler, and a crawler failure
 *    never sinks the GBP facts
 */

const { prisma, envState, assertPublicHttpsUrl } = vi.hoisted(() => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
  },
  envState: {
    ANTHROPIC_API_KEY: undefined as string | undefined,
    GOOGLE_MAPS_API_KEY: undefined as string | undefined,
  },
  assertPublicHttpsUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ chat: vi.fn(), generate: vi.fn() }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  assertPublicHttpsUrl,
}));

import { gbpFacts, ingestGbp, type GbpPlace } from "@/modules/knowledge/ingest";

beforeEach(() => {
  vi.clearAllMocks();
  envState.GOOGLE_MAPS_API_KEY = undefined;
  envState.ANTHROPIC_API_KEY = undefined;
  prisma.knowledgeEntry.findMany.mockResolvedValue([]);
});

describe("gbpFacts", () => {
  it("maps listing fields to categorized facts", () => {
    const place: GbpPlace = {
      formattedAddress: "MG Road, Bengaluru",
      nationalPhoneNumber: "+91 98765 43210",
      rating: 4.7,
      userRatingCount: 214,
      regularOpeningHours: {
        weekdayDescriptions: ["Monday: 10 AM – 8 PM", "Sunday: Closed"],
      },
    };
    const facts = gbpFacts(place);
    const cats = facts.map((f) => f.category);
    expect(cats).toContain("location");
    expect(cats).toContain("hours");
    expect(cats).toContain("other");
    expect(cats).toContain("faq");
    const hours = facts.find((f) => f.category === "hours")!;
    expect(hours.fact).toContain("Monday");
    expect(hours.fact).toContain("Sunday");
  });

  it("splits very long hour sets across multiple ≤300-char facts", () => {
    const place: GbpPlace = {
      regularOpeningHours: {
        weekdayDescriptions: Array.from(
          { length: 7 },
          (_, i) =>
            `Day${i}: 10:00 AM – 1:00 PM, 2:00 PM – 6:00 PM, 7:00 PM – 11:00 PM (last entry 10:45 PM, kitchen closes earlier on public holidays)`
        ),
      },
    };
    const facts = gbpFacts(place);
    expect(facts.length).toBeGreaterThan(1);
    for (const f of facts) expect(f.fact.length).toBeLessThanOrEqual(300);
  });
});

describe("ingestGbp", () => {
  it("keyless → demo listing stored as drafts, Google never called", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await ingestGbp("org1", "glow beauty bangalore");
    expect(result.drafts).toBeGreaterThan(0);
    expect(result.name).toContain("demo");
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const call of prisma.knowledgeEntry.create.mock.calls) {
      expect(call[0].data.status).toBe("draft");
      expect(call[0].data.orgId).toBe("org1");
    }
    vi.unstubAllGlobals();
  });

  it("live mode parses the Places response", async () => {
    envState.GOOGLE_MAPS_API_KEY = "maps-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [
              {
                displayName: { text: "Real Salon" },
                formattedAddress: "12 Park St, Kolkata",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } }
        )
      )
    );
    const result = await ingestGbp("org1", "real salon kolkata");
    expect(result.name).toBe("Real Salon");
    expect(result.drafts).toBe(1); // just the address
    vi.unstubAllGlobals();
  });

  it("chains into the website crawl and survives its failure", async () => {
    envState.GOOGLE_MAPS_API_KEY = "maps-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // Places lookup succeeds with a website on the listing…
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              places: [
                {
                  displayName: { text: "Site Salon" },
                  formattedAddress: "1 Beach Rd, Chennai",
                  websiteUri: "https://sitesalon.example.com",
                },
              ],
            }),
            { headers: { "content-type": "application/json" } }
          )
        )
        // …but the website fetch blows up.
        .mockRejectedValue(new Error("site down"))
    );
    const result = await ingestGbp("org1", "site salon chennai");
    expect(result.drafts).toBe(1); // GBP address fact still stored
    expect(result.websiteCrawled).toBe(false);
    vi.unstubAllGlobals();
  });

  it("live mode with no match throws a friendly error", async () => {
    envState.GOOGLE_MAPS_API_KEY = "maps-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ places: [] }), {
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(ingestGbp("org1", "nonexistent biz")).rejects.toThrow(
      /Couldn't find/
    );
    vi.unstubAllGlobals();
  });
});
