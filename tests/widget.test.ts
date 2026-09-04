import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E5 website widget — the privacy/abuse contract:
 *  - the public config leaks NOTHING beyond render data (no org id)
 *  - unknown, malformed and disabled keys 404
 *  - saving requires a phone when enabling; keys are random and stable
 *  - click beacons are IP rate-limited and recorded as widget_click
 */

const { prisma, recordContactEvent } = vi.hoisted(() => ({
  prisma: { org: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
  recordContactEvent: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent }));

import { GET as getConfig } from "@/app/api/widget/[key]/config/route";
import { POST as postEvent } from "@/app/api/widget/[key]/event/route";
import { saveWidgetConfig, getPublicWidgetByKey, newWidgetKey } from "@/modules/widget";

const KEY = "wk_aaaaaaaaaaaaaaaaaaaaaaaa";
const WIDGET = {
  enabled: true,
  phoneE164: "+919876543210",
  prefill: "Hi!",
  position: "right",
  color: "#25D366",
  widgetKey: KEY,
};

const params = (key: string) => ({ params: Promise.resolve({ key }) });
const req = (ip = "1.2.3.4") =>
  new Request("https://x/api/widget/k/event", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findFirst.mockResolvedValue({ id: "org1", settings: { widget: WIDGET } });
});

describe("public config endpoint", () => {
  it("returns only render data — never the org id", async () => {
    const res = await getConfig(new Request("https://x"), params(KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      phone: "919876543210",
      prefill: "Hi!",
      position: "right",
      color: "#25D366",
    });
    expect(JSON.stringify(body)).not.toContain("org1");
  });

  it("404s malformed, unknown and disabled keys", async () => {
    expect((await getConfig(new Request("https://x"), params("not-a-key"))).status).toBe(404);
    prisma.org.findFirst.mockResolvedValue(null);
    expect((await getConfig(new Request("https://x"), params(KEY))).status).toBe(404);
    prisma.org.findFirst.mockResolvedValue({
      id: "org1",
      settings: { widget: { ...WIDGET, enabled: false } },
    });
    expect((await getConfig(new Request("https://x"), params(KEY))).status).toBe(404);
  });
});

describe("click beacon", () => {
  it("records widget_click for the org", async () => {
    const res = await postEvent(req(), params(KEY));
    expect(res.status).toBe(200);
    expect(recordContactEvent).toHaveBeenCalledWith("org1", "widget_click");
  });

  it("rate-limits a hammering IP", async () => {
    let limited = false;
    for (let i = 0; i < 10; i++) {
      const res = await postEvent(req("9.9.9.9"), params(KEY));
      if (res.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });
});

describe("saveWidgetConfig", () => {
  it("requires a phone number when enabling", async () => {
    const r = await saveWidgetConfig(
      "org1",
      { enabled: true, phone: "", prefill: "", position: "right", color: "#25D366" },
      "+91"
    );
    expect(r.ok).toBe(false);
  });

  it("generates a stable random key on first save and keeps it after", async () => {
    prisma.org.findUnique.mockResolvedValue({ settings: {} });
    prisma.org.update.mockResolvedValue({});
    const r = await saveWidgetConfig(
      "org1",
      { enabled: true, phone: "9876543210", prefill: "Hi", position: "right", color: "#25D366" },
      "+91"
    );
    expect(r.ok).toBe(true);
    expect(r.config!.widgetKey).toMatch(/^wk_[0-9a-f]{24}$/);

    prisma.org.findUnique.mockResolvedValue({ settings: { widget: r.config } });
    const r2 = await saveWidgetConfig(
      "org1",
      { enabled: false, phone: "9876543210", prefill: "Hi", position: "left", color: "#000000" },
      "+91"
    );
    expect(r2.config!.widgetKey).toBe(r.config!.widgetKey);
  });

  it("widget keys are unique-random", () => {
    expect(newWidgetKey()).not.toBe(newWidgetKey());
  });
});

describe("getPublicWidgetByKey", () => {
  it("rejects garbage keys before touching the DB", async () => {
    expect(await getPublicWidgetByKey("'; DROP TABLE--")).toBeNull();
    expect(prisma.org.findFirst).not.toHaveBeenCalled();
  });
});
