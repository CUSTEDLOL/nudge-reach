import { describe, expect, it } from "vitest";
import {
  APPS,
  APP_CATEGORIES,
  buildAppCatalog,
  countConnected,
  matchesQuery,
  sortTiles,
  type CatalogState,
} from "@/modules/integrations/catalog";

/**
 * The app directory is the first thing a new client explores, so the rules
 * that decide what it claims are tested here rather than read off the screen.
 * The load-bearing promise: a tile never offers an action we cannot deliver.
 */

const BASE: CatalogState = {
  whatsappConnected: false,
  whatsappName: null,
  simulation: true,
  calendarConnected: false,
  calendarEmail: null,
  calendarSimulated: false,
  zohoConnected: false,
  salesforceConnected: false,
  webhookCount: 0,
  apiKeyCount: 0,
  widgetEnabled: false,
  hasFrontDesk: true,
  hasPublicApi: true,
  paymentsLive: false,
};

const state = (patch: Partial<CatalogState> = {}): CatalogState => ({
  ...BASE,
  ...patch,
});
const byId = (s: CatalogState, id: string) =>
  buildAppCatalog(s).find((t) => t.id === id)!;

describe("app catalog", () => {
  it("gives every app a category that exists and a unique id", () => {
    const ids = APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(APP_CATEGORIES.map((c) => c.id));
    for (const app of APPS) expect(categories.has(app.category)).toBe(true);
  });

  it("never offers an action for something we have not built", () => {
    for (const tile of buildAppCatalog(state())) {
      if (tile.kind === "planned") {
        expect(tile.status).toBe("planned");
        expect(tile.statusLabel).toBe("Coming soon");
        expect(tile.action).toBeNull();
      } else {
        expect(tile.action).not.toBeNull();
      }
    }
  });

  it("reflects what is actually connected", () => {
    const connected = state({
      whatsappConnected: true,
      whatsappName: "Spice Garden",
      simulation: false,
      calendarConnected: true,
      calendarEmail: "owner@spice.in",
      zohoConnected: true,
      webhookCount: 2,
      apiKeyCount: 1,
      widgetEnabled: true,
    });

    expect(byId(connected, "whatsapp").status).toBe("connected");
    expect(byId(connected, "whatsapp").detail).toContain("Spice Garden");
    expect(byId(connected, "google-calendar").detail).toBe("owner@spice.in");
    expect(byId(connected, "zoho").status).toBe("connected");
    expect(byId(connected, "salesforce").status).toBe("ready");
    expect(byId(connected, "webhooks").statusLabel).toBe("2 endpoints");
    expect(byId(connected, "rest-api").statusLabel).toBe("1 key");
    expect(countConnected(buildAppCatalog(connected))).toBeGreaterThanOrEqual(5);
  });

  it("says test mode rather than pretending a number is live", () => {
    const tile = byId(state({ simulation: true }), "whatsapp");
    expect(tile.statusLabel).toBe("Test mode");
    expect(tile.detail).toMatch(/mocked/i);
  });

  it("never offers a live workspace practice payment links", () => {
    const live = byId(state({ simulation: false, paymentsLive: false }), "razorpay");
    expect(live.statusLabel).toBe("Not switched on yet");
    expect(live.detail).toMatch(/No links are sent/);
    const test = byId(state({ simulation: true, paymentsLive: false }), "razorpay");
    expect(test.statusLabel).toBe("Test links");
  });

  it("marks a simulated calendar honestly", () => {
    const tile = byId(
      state({ calendarConnected: true, calendarSimulated: true }),
      "google-calendar"
    );
    expect(tile.detail).toMatch(/Test calendar/i);
  });

  it("locks plan-gated apps behind an upgrade instead of a dead button", () => {
    const basic = state({ hasFrontDesk: false, hasPublicApi: false });
    for (const id of ["google-calendar", "zoho", "razorpay", "webhooks", "rest-api", "zapier"]) {
      const tile = byId(basic, id);
      expect(tile.status).toBe("locked");
      expect(tile.action?.href).toBe("/settings/billing");
    }
    // Things that do not need those entitlements stay reachable.
    expect(byId(basic, "whatsapp").status).not.toBe("locked");
    expect(byId(basic, "website-button").status).not.toBe("locked");
  });

  it("routes bridge apps to the webhook panel with a recipe", () => {
    for (const id of ["zapier", "make", "n8n", "slack", "google-sheets", "hubspot", "pipedrive"]) {
      const tile = byId(state(), id);
      expect(tile.kind).toBe("bridge");
      expect(tile.action?.panel).toBe("bridge");
      expect(tile.statusLabel).toBe("Connect with a webhook");
    }
  });

  it("sorts connected apps to the front and planned ones to the back", () => {
    const sorted = sortTiles(
      buildAppCatalog(state({ whatsappConnected: true, simulation: false }))
    );
    expect(sorted[0].status).toBe("connected");
    expect(sorted.at(-1)?.status).toBe("planned");
  });

  it("searches name, tagline and keywords", () => {
    const tiles = buildAppCatalog(state());
    const find = (q: string) => tiles.filter((t) => matchesQuery(t, q)).map((t) => t.id);

    expect(find("zapier")).toContain("zapier");
    expect(find("upi")).toContain("razorpay"); // keyword only
    expect(find("spreadsheet")).toContain("google-sheets");
    expect(find("book")).toContain("google-calendar"); // tagline only
    expect(find("")).toHaveLength(tiles.length);
    expect(find("nothingmatchesthis")).toHaveLength(0);
  });
});
