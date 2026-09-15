import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BookDemoButton,
  buildCalTriggerConfig,
  initializeCalEmbed,
  trackDemoCta,
} from "@/components/marketing/book-demo";
import {
  calMetadata,
  captureAttribution,
  pushMarketingEvent,
} from "@/modules/marketing/analytics";

class FakeStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const STORAGE_KEY = "nudge:first-touch:v1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("marketing attribution", () => {
  it("captures whitelisted first-touch fields and an existing GA client ID", () => {
    const storage = new FakeStorage();

    expect(
      captureAttribution(
        new URL(
          "https://nudgeagent.app/industries/clinics?utm_source=google&utm_medium=organic"
        ),
        "https://www.google.com/",
        storage,
        "_ga=GA1.1.12345.67890"
      )
    ).toMatchObject({
      landingPath: "/industries/clinics",
      referrer: "https://www.google.com/",
      utmSource: "google",
      utmMedium: "organic",
      gaClientId: "12345.67890",
    });
  });

  it("keeps stored first-touch values on later pages", () => {
    const storage = new FakeStorage();
    captureAttribution(
      new URL("https://nudgeagent.app/industries/clinics?utm_source=google"),
      "https://www.google.com/search?q=nudge",
      storage,
      ""
    );

    const later = captureAttribution(
      new URL("https://nudgeagent.app/pricing?utm_source=newsletter"),
      "https://example.com/private/path?token=secret",
      storage,
      ""
    );

    expect(later).toEqual({
      landingPath: "/industries/clinics",
      referrer: "https://www.google.com/",
      utmSource: "google",
    });
  });

  it("normalizes known fields from storage and rewrites the sanitized record", () => {
    const storage = new FakeStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        landingPath:
          "/resources?email=person@example.com#phone=+919999999999",
        referrer:
          "https://partner.example/private?email=person@example.com",
        utmSource: "a".repeat(250),
        unknown: "must not survive",
      })
    );

    const attribution = captureAttribution(
      new URL("https://nudgeagent.app/pricing"),
      "https://current.example/private",
      storage,
      ""
    );

    expect(attribution).toEqual({
      landingPath: "/resources",
      referrer: "https://partner.example/",
      utmSource: "a".repeat(200),
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}")).toEqual(
      attribution
    );
  });

  it("replaces an invalid stored record with a persistent current first touch", () => {
    const storage = new FakeStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        landingPath:
          "https://nudgeagent.app/private?email=person@example.com",
        referrer: "tel:+919999999999",
      })
    );

    const repaired = captureAttribution(
      new URL("https://nudgeagent.app/pricing?utm_source=google"),
      "https://www.google.com/search?q=nudge",
      storage,
      ""
    );
    const later = captureAttribution(
      new URL("https://nudgeagent.app/faq?utm_source=newsletter"),
      "https://example.com/private",
      storage,
      ""
    );

    expect(repaired).toEqual({
      landingPath: "/pricing",
      referrer: "https://www.google.com/",
      utmSource: "google",
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}")).toEqual(repaired);
    expect(later).toEqual(repaired);
  });

  it("repairs malformed stored JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, "{broken");

    const attribution = captureAttribution(
      new URL("https://nudgeagent.app/industries/clinics"),
      "",
      storage,
      ""
    );

    expect(attribution).toEqual({ landingPath: "/industries/clinics" });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}")).toEqual(
      attribution
    );
  });

  it("truncates captured attribution but rejects an overlong client ID", () => {
    const storage = new FakeStorage();
    const longValue = "a".repeat(250);
    const longGaClientId = `${"1".repeat(125)}.${"2".repeat(125)}`;

    const attribution = captureAttribution(
      new URL(
        `https://nudgeagent.app/${longValue}?utm_source=${longValue}&utm_campaign=${longValue}`
      ),
      "",
      storage,
      `_ga=GA1.1.${longGaClientId}`
    );

    expect(attribution.landingPath).toHaveLength(200);
    expect(attribution.utmSource).toHaveLength(200);
    expect(attribution.utmCampaign).toHaveLength(200);
    expect(attribution.gaClientId).toBeUndefined();
  });

  it.each([
    ["malformed", "12345.67890.123"],
    ["whitespace-padded", " 12345.67890 "],
    ["trailing-whitespace", "12345.67890 "],
    ["email-shaped", "person@example.com"],
    ["name-shaped", "Dr Priya Rao"],
    ["phone-shaped", "+919876543210"],
  ])("does not treat a %s GA cookie value as a client ID", (_kind, value) => {
    const storage = new FakeStorage();

    const attribution = captureAttribution(
      new URL("https://nudgeagent.app/"),
      "",
      storage,
      `_ga=GA1.1.${value}`
    );

    expect(attribution).toEqual({ landingPath: "/" });
  });

  it("excludes unknown query parameters from memory, storage, and Cal config", () => {
    const storage = new FakeStorage();

    const attribution = captureAttribution(
      new URL(
        "https://nudgeagent.app/resources?utm_medium=organic&email=person%40example.com&token=secret"
      ),
      "https://example.com/path?customer=private",
      storage,
      ""
    );

    expect(attribution).toEqual({
      landingPath: "/resources",
      referrer: "https://example.com/",
      utmMedium: "organic",
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      landingPath: "/resources",
      referrer: "https://example.com/",
      utmMedium: "organic",
    });
    expect(calMetadata(attribution)).toEqual({
      utm_medium: "organic",
      "metadata[landingPath]": "/resources",
      "metadata[referrer]": "https://example.com/",
    });
  });

  it("returns current-page attribution when storage access throws", () => {
    const storage = new FakeStorage();
    storage.getItem = () => {
      throw new Error("storage disabled");
    };

    expect(
      captureAttribution(
        new URL("https://nudgeagent.app/pricing?utm_campaign=clinic-launch"),
        "https://partner.example/private?lead=secret",
        storage,
        "_ga=GA1.1.987.654"
      )
    ).toEqual({
      landingPath: "/pricing",
      referrer: "https://partner.example/",
      utmCampaign: "clinic-launch",
      gaClientId: "987.654",
    });
  });

  it("projects only approved attribution into Cal metadata", () => {
    expect(
      calMetadata({
        landingPath: "/industries/clinics",
        referrer: "https://www.google.com/",
        utmSource: "google",
        utmMedium: "organic",
        utmCampaign: "clinic-search",
        gaClientId: "12345.67890",
      })
    ).toEqual({
      utm_source: "google",
      utm_medium: "organic",
      utm_campaign: "clinic-search",
      "metadata[landingPath]": "/industries/clinics",
      "metadata[referrer]": "https://www.google.com/",
      "metadata[gaClientId]": "12345.67890",
    });
  });

  it.each([
    ["malformed", "12345.67890.123"],
    ["whitespace-padded", " 12345.67890 "],
    ["email-shaped", "person@example.com"],
    ["name-shaped", "Dr Priya Rao"],
    ["phone-shaped", "+919876543210"],
  ])("omits a %s client ID from Cal metadata", (_kind, gaClientId) => {
    expect(calMetadata({ landingPath: "/pricing", gaClientId })).toEqual({
      "metadata[landingPath]": "/pricing",
    });
  });
});

describe("marketing browser events", () => {
  it("appends one plain event object to an available data layer", () => {
    const dataLayer: object[] = [];
    vi.stubGlobal("window", { dataLayer });

    pushMarketingEvent({
      event: "demo_cta_click",
      surface: "hero",
      landing_path: "/industries/clinics",
    });

    expect(dataLayer).toEqual([
      {
        event: "demo_cta_click",
        surface: "hero",
        landing_path: "/industries/clinics",
      },
    ]);
    expect(Object.getPrototypeOf(dataLayer[0])).toBe(Object.prototype);
  });

  it("does not throw when browser analytics is unavailable", () => {
    expect(() =>
      pushMarketingEvent({
        event: "generate_lead",
        lead_source: "access_form",
      })
    ).not.toThrow();
  });
});

describe("demo booking funnel", () => {
  it("keeps attribution storage and forwarding off unless explicitly enabled", () => {
    const browser = Object.defineProperties({}, {
      locationHref: {
        get() {
          throw new Error("location must not be read");
        },
      },
      referrer: {
        get() {
          throw new Error("referrer must not be read");
        },
      },
      storage: {
        get() {
          throw new Error("storage must not be read");
        },
      },
      cookie: {
        get() {
          throw new Error("cookie must not be read");
        },
      },
    });

    expect(buildCalTriggerConfig(false, browser as never)).toBe(
      JSON.stringify({
        layout: "month_view",
        useSlotsViewOnSmallScreen: "true",
      })
    );
  });

  it("adds only whitelisted attribution when the public gate is enabled", () => {
    const storage = new FakeStorage();

    expect(
      JSON.parse(
        buildCalTriggerConfig(true, {
          locationHref:
            "https://nudgeagent.app/industries/clinics?utm_source=google&token=private",
          referrer: "https://www.google.com/private?q=nudge",
          storage,
          cookie: "_ga=GA1.1.12345.67890",
        })
      )
    ).toEqual({
      layout: "month_view",
      useSlotsViewOnSmallScreen: "true",
      utm_source: "google",
      "metadata[landingPath]": "/industries/clinics",
      "metadata[referrer]": "https://www.google.com/",
      "metadata[gaClientId]": "12345.67890",
    });
  });

  it("keeps the Cal trigger config static during server rendering", () => {
    const html = renderToStaticMarkup(
      createElement(BookDemoButton, { surface: "hero" }, "Book a Demo")
    );

    expect(html).toContain(
      'data-cal-config="{&quot;layout&quot;:&quot;month_view&quot;,&quot;useSlotsViewOnSmallScreen&quot;:&quot;true&quot;}"'
    );
    expect(html).toContain('data-cal-link="hqnudge/30min"');
    expect(html).toContain('href="https://cal.com/hqnudge/30min"');
  });

  it("tracks a CTA click with its stable surface and pathname", () => {
    const dataLayer: object[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackDemoCta("hero", { pathname: "/industries/clinics" });

    expect(dataLayer).toEqual([
      {
        event: "demo_cta_click",
        surface: "hero",
        landing_path: "/industries/clinics",
      },
    ]);
  });

  it("subscribes both Cal success events to one aggregate-only deduplicating callback", () => {
    const dataLayer: object[] = [];
    const script = { src: "", onerror: null as null | (() => void) };
    vi.stubGlobal("window", { dataLayer });
    vi.stubGlobal("document", {
      head: { appendChild: (element: object) => element },
      createElement: () => script,
    });

    initializeCalEmbed();
    initializeCalEmbed();

    type CalApi = ((...args: unknown[]) => void) & {
      config: { forwardQueryParams?: boolean };
      ns: Record<string, CalNamespace>;
    };
    type CalNamespace = ((...args: unknown[]) => void) & { q: unknown[][] };
    const cal = (window as unknown as Window & { Cal: CalApi }).Cal;
    const eventCalls = cal.ns["30min"].q.filter((call) => call[0] === "on");

    expect(script.src).toBe("https://app.cal.com/embed/embed.js");
    expect(cal.config.forwardQueryParams).toBe(false);
    expect(eventCalls.map((call) => call[1])).toMatchObject([
      { action: "bookingSuccessfulV2" },
      { action: "dryRunBookingSuccessfulV2" },
      { action: "linkFailed" },
    ]);

    const booking = eventCalls.find(
      (call) =>
        (call[1] as { action?: string }).action === "bookingSuccessfulV2"
    )?.[1] as {
      callback: (event: unknown) => void;
    };
    const dryRun = eventCalls.find(
      (call) =>
        (call[1] as { action?: string }).action ===
        "dryRunBookingSuccessfulV2"
    )?.[1] as {
      callback: (event: unknown) => void;
    };
    expect(dryRun.callback).toBe(booking.callback);

    booking.callback({
      detail: {
        data: {
          uid: "Booking_UID-123",
          startTime: "2026-09-20T10:00:00.000Z",
          endTime: "2026-09-20T10:30:00.000Z",
          eventTypeId: 30,
        },
      },
    });
    dryRun.callback({
      detail: {
        data: {
          startTime: "2026-09-20T10:00:00.000Z",
          endTime: "2026-09-20T10:30:00.000Z",
          eventTypeId: 30,
        },
      },
    });
    expect(dataLayer).toHaveLength(1);
    dryRun.callback({
      detail: {
        data: {
          startTime: "2026-09-21T10:00:00.000Z",
          endTime: "2026-09-21T10:30:00.000Z",
          eventTypeId: 30,
        },
      },
    });
    booking.callback({
      detail: {
        data: {
          uid: "Booking_UID-456",
          startTime: "2026-09-21T10:00:00.000Z",
          endTime: "2026-09-21T10:30:00.000Z",
          eventTypeId: 30,
        },
      },
    });
    expect(dataLayer).toHaveLength(2);

    const failure = eventCalls.find(
      (call) => (call[1] as { action?: string }).action === "linkFailed"
    )?.[1] as {
      callback: (event: unknown) => void;
    };
    failure.callback({
      detail: {
        data: {
          msg: "private provider error",
          url: "https://cal.com/private?email=person@example.com",
        },
      },
    });

    expect(dataLayer).toEqual([
      { event: "generate_lead", lead_source: "cal" },
      { event: "generate_lead", lead_source: "cal" },
      { event: "cal_embed_error", surface: "cal_embed" },
    ]);
    expect(JSON.stringify(dataLayer)).not.toContain("Booking_UID");
    expect(JSON.stringify(dataLayer)).not.toContain("Booking_UID-456");
  });

  it("clears the Cal initialization latch after a script error so a later call retries", () => {
    const scripts: { src: string; onerror: null | (() => void) }[] = [];
    vi.stubGlobal("window", { dataLayer: [] });
    vi.stubGlobal("document", {
      head: {
        appendChild: (element: { src: string; onerror: null | (() => void) }) => {
          scripts.push(element);
          return element;
        },
      },
      createElement: () => ({ src: "", onerror: null }),
    });

    initializeCalEmbed();
    expect(scripts).toHaveLength(1);
    scripts[0].onerror?.();
    initializeCalEmbed();

    expect(scripts).toHaveLength(2);
    expect(scripts.every((script) => script.src === "https://app.cal.com/embed/embed.js")).toBe(true);
    const cal = (window as unknown as Window & {
      Cal: { q: unknown[][] };
    }).Cal;
    expect(
      cal.q.filter(
        (call) => call[0] === "initNamespace" && call[1] === "30min"
      )
    ).toHaveLength(1);
  });

  it("retries after a synchronous Cal script insertion failure", () => {
    let attempts = 0;
    vi.stubGlobal("window", { dataLayer: [] });
    vi.stubGlobal("document", {
      head: {
        appendChild: (element: object) => {
          attempts += 1;
          if (attempts === 1) throw new Error("blocked script insertion");
          return element;
        },
      },
      createElement: () => ({ src: "", onerror: null }),
    });

    expect(() => initializeCalEmbed()).not.toThrow();
    initializeCalEmbed();

    expect(attempts).toBe(2);
  });
});
