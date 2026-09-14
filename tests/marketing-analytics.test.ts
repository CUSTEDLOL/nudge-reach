import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BookDemoButton,
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

  it("truncates captured values to 200 characters", () => {
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
    expect(attribution.gaClientId).toHaveLength(200);
  });

  it("does not treat an arbitrary GA cookie value as a client ID", () => {
    const storage = new FakeStorage();

    const attribution = captureAttribution(
      new URL("https://nudgeagent.app/"),
      "",
      storage,
      "_ga=GA1.1.person@example.com"
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
  it("keeps the Cal trigger config static during server rendering", () => {
    const html = renderToStaticMarkup(
      createElement(BookDemoButton, { surface: "hero" }, "Book a Demo")
    );

    expect(html).toContain(
      'data-cal-config="{&quot;layout&quot;:&quot;month_view&quot;,&quot;useSlotsViewOnSmallScreen&quot;:&quot;true&quot;}"'
    );
    expect(html).toContain('data-cal-link="hqnudge/30min"');
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

  it("initializes and subscribes to Cal events exactly once", () => {
    const dataLayer: object[] = [];
    const script = { src: "" };
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
    const cal = (window as Window & { Cal: CalApi }).Cal;
    const eventCalls = cal.ns["30min"].q.filter((call) => call[0] === "on");

    expect(script.src).toBe("https://app.cal.com/embed/embed.js");
    expect(cal.config.forwardQueryParams).toBe(false);
    expect(eventCalls.map((call) => call[1])).toMatchObject([
      { action: "bookingSuccessfulV2" },
      { action: "linkFailed" },
    ]);

    const booking = eventCalls[0][1] as {
      callback: (event: { detail?: { data?: { uid?: string } } }) => void;
    };
    booking.callback({
      detail: {
        data: { uid: "booking-123" },
      },
    });

    const failure = eventCalls[1][1] as {
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
      {
        event: "generate_lead",
        lead_source: "cal",
        booking_uid: "booking-123",
      },
      { event: "cal_embed_error", surface: "cal_embed" },
    ]);
  });
});
