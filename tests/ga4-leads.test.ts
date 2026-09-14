import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { analyticsEnv, fetchMock } = vi.hoisted(() => ({
  analyticsEnv: {
    GA4_MEASUREMENT_ID: undefined as string | undefined,
    GA4_API_SECRET: undefined as string | undefined,
  },
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: analyticsEnv }));

import { envSchema } from "@/lib/env-schema";
import { sendGa4LeadEvent } from "@/modules/marketing/ga4";

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

beforeEach(() => {
  vi.clearAllMocks();
  analyticsEnv.GA4_MEASUREMENT_ID = undefined;
  analyticsEnv.GA4_API_SECRET = undefined;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GA4 lead-event configuration", () => {
  it("accepts optional server-only Measurement Protocol credentials", () => {
    const parsed = envSchema.parse({
      ...baseEnv,
      GA4_MEASUREMENT_ID: "G-TEST123",
      GA4_API_SECRET: "server-secret",
    });

    expect(parsed.GA4_MEASUREMENT_ID).toBe("G-TEST123");
    expect(parsed.GA4_API_SECRET).toBe("server-secret");
  });
});

describe("sendGa4LeadEvent", () => {
  it.each([
    [undefined, "server-secret", "12345.67890"],
    ["G-TEST123", undefined, "12345.67890"],
    ["G-TEST123", "server-secret", ""],
  ])(
    "skips without every configured credential and persisted client ID",
    async (measurementId, apiSecret, clientId) => {
      analyticsEnv.GA4_MEASUREMENT_ID = measurementId;
      analyticsEnv.GA4_API_SECRET = apiSecret;

      await expect(
        sendGa4LeadEvent({
          name: "qualify_lead",
          clientId,
          leadId: "lead_123",
        })
      ).resolves.toBe("skipped");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("posts one recommended event with only client_id and internal lead_id", async () => {
    analyticsEnv.GA4_MEASUREMENT_ID = "G-TEST123";
    analyticsEnv.GA4_API_SECRET = "server-secret";
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      sendGa4LeadEvent({
        name: "qualify_lead",
        clientId: "12345.67890",
        leadId: "lead_123",
      })
    ).resolves.toBe("sent");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.google-analytics.com/mp/collect"
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      measurement_id: "G-TEST123",
      api_secret: "server-secret",
    });
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: "12345.67890",
      events: [
        {
          name: "qualify_lead",
          params: { lead_id: "booking:lead_123" },
        },
      ],
    });
  });

  it("returns failed without throwing for non-2xx and rejected requests", async () => {
    analyticsEnv.GA4_MEASUREMENT_ID = "G-TEST123";
    analyticsEnv.GA4_API_SECRET = "server-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      sendGa4LeadEvent({
        name: "disqualify_lead",
        clientId: "12345.67890",
        leadId: "lead_123",
      })
    ).resolves.toBe("failed");

    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(
      sendGa4LeadEvent({
        name: "close_convert_lead",
        clientId: "12345.67890",
        leadId: "lead_123",
      })
    ).resolves.toBe("failed");
  });

  it("aborts an in-flight request after five seconds and returns failed", async () => {
    vi.useFakeTimers();
    analyticsEnv.GA4_MEASUREMENT_ID = "G-TEST123";
    analyticsEnv.GA4_API_SECRET = "server-secret";
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        })
    );

    const result = sendGa4LeadEvent({
      name: "qualify_lead",
      clientId: "12345.67890",
      leadId: "lead_123",
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("failed");
    expect(requestSignal?.aborted).toBe(true);
  });
});
