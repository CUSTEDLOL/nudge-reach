import { beforeEach, describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    SEND_MODE: "simulation" as "simulation" | "live",
    WHATSAPP_API_VERSION: "v23.0",
  },
}));

vi.mock("@/lib/env", () => ({ env }));

import { validateWhatsappConnection } from "@/modules/whatsapp/connection-validator";

const INPUT = {
  displayName: "Clinic WhatsApp",
  wabaId: "123456789012345",
  phoneNumberId: "987654321098765",
  accessToken: "EAA-long-lived-system-user-token",
};

function metaResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  env.SEND_MODE = "simulation";
  env.WHATSAPP_API_VERSION = "v23.0";
});

describe("validateWhatsappConnection", () => {
  it.each([
    [{ ...INPUT, displayName: "" }, "display name"],
    [{ ...INPUT, wabaId: "not-an-id" }, "business account"],
    [{ ...INPUT, phoneNumberId: "pn_123" }, "phone number"],
    [{ ...INPUT, accessToken: "short" }, "access token"],
  ])("rejects malformed input before contacting Meta", async (input, message) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await validateWhatsappConnection(input);

    expect(result).toEqual({ ok: false, message: expect.stringMatching(new RegExp(message, "i")) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates deterministically in simulation mode without a network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(validateWhatsappConnection(INPUT)).resolves.toEqual({ ok: true, value: INPUT });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a number returned for the submitted WABA in live mode", async () => {
    env.SEND_MODE = "live";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(metaResponse(200, { data: [{ id: INPUT.phoneNumberId }] }) as Response);

    await expect(validateWhatsappConnection(INPUT)).resolves.toEqual({ ok: true, value: INPUT });
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://graph.facebook.com/v23.0/${INPUT.wabaId}/phone_numbers?fields=id&limit=100`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${INPUT.accessToken}` },
        method: "GET",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it.each([401, 403])("maps Meta credential rejection (%s) to a safe message", async (status) => {
    env.SEND_MODE = "live";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      metaResponse(status, { error: { message: `Secret response containing ${INPUT.accessToken}` } }) as Response
    );

    const result = await validateWhatsappConnection(INPUT);

    expect(result).toEqual({
      ok: false,
      message: expect.stringMatching(/rejected.*access token|access token.*rejected/i),
    });
    expect(result.ok || result.message).not.toContain(INPUT.accessToken);
  });

  it("rejects a Phone Number ID that is not registered under the WABA", async () => {
    env.SEND_MODE = "live";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      metaResponse(200, { data: [{ id: "111111111111111" }] }) as Response
    );

    await expect(validateWhatsappConnection(INPUT)).resolves.toEqual({
      ok: false,
      message: expect.stringMatching(/not registered.*business account/i),
    });
  });

  it("maps network failures to a retryable safe message", async () => {
    env.SEND_MODE = "live";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error(`network ${INPUT.accessToken}`));

    const result = await validateWhatsappConnection(INPUT);

    expect(result).toEqual({
      ok: false,
      message: expect.stringMatching(/could not be reached.*nothing was saved.*try again/i),
    });
    expect(result.ok || result.message).not.toContain(INPUT.accessToken);
  });

  it("rejects malformed successful Meta responses safely", async () => {
    env.SEND_MODE = "live";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(metaResponse(200, { data: "wrong" }) as Response);

    await expect(validateWhatsappConnection(INPUT)).resolves.toEqual({
      ok: false,
      message: expect.stringMatching(/could not be reached.*nothing was saved.*try again/i),
    });
  });
});
