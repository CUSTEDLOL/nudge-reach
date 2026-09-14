import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: {
    CAL_WEBHOOK_SECRET: "cal-webhook-secret" as string | undefined,
    CAL_EVENT_TYPE_SLUG: "30min",
  },
}));
const upsert = vi.hoisted(() => vi.fn(async () => ({ id: "demo-booking-1" })));

vi.mock("@/lib/env", () => ({ env: state.env }));
vi.mock("@/lib/db", () => ({ prisma: { demoBooking: { upsert } } }));

import { POST } from "@/app/api/webhooks/cal/route";

const validPayload = {
  triggerEvent: "BOOKING_CREATED",
  createdAt: "2026-09-15T08:00:00.000Z",
  payload: {
    uid: "booking-uid-123",
    type: "30min",
    startTime: "2026-09-20T09:30:00.000Z",
    attendees: [
      {
        name: "Dr Priya Rao",
        email: "priya@example.com",
        phoneNumber: "+91 98765 43210",
      },
    ],
    metadata: {
      landingPath: "/industries/clinics",
      referrer: "https://www.google.com/",
      utm_source: "google",
      gaClientId: "12345.67890",
      videoCallUrl: "https://meet.example/private-room",
    },
  },
};

function signature(body: string, secret = "cal-webhook-secret") {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function request(
  body: string,
  options: { signature?: string | null; version?: string | null } = {}
) {
  const headers = new Headers({ "content-type": "application/json" });
  const signed = options.signature === undefined ? signature(body) : options.signature;
  const version = options.version === undefined ? "2021-10-20" : options.version;
  if (signed !== null) headers.set("x-cal-signature-256", signed);
  if (version !== null) headers.set("x-cal-webhook-version", version);

  return new Request("http://localhost/api/webhooks/cal", {
    method: "POST",
    body,
    headers,
  });
}

beforeEach(() => {
  state.env.CAL_WEBHOOK_SECRET = "cal-webhook-secret";
  state.env.CAL_EVENT_TYPE_SLUG = "30min";
  upsert.mockClear();
});

describe("POST /api/webhooks/cal", () => {
  it.each([
    ["missing", null],
    ["malformed", "not-a-signature"],
    ["incorrect", "0".repeat(64)],
  ])("rejects a %s signature before database access", async (_name, value) => {
    const body = JSON.stringify(validPayload);
    const response = await POST(request(body, { signature: value }));

    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("fails closed before database access when the webhook secret is absent", async () => {
    state.env.CAL_WEBHOOK_SECRET = undefined;
    const body = JSON.stringify(validPayload);

    const response = await POST(request(body));

    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 400 for signed invalid JSON or booking schema", async () => {
    const badJson = "{broken";
    const badSchema = JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      payload: { ...validPayload.payload, startTime: "not-a-date" },
    });

    expect((await POST(request(badJson))).status).toBe(400);
    expect((await POST(request(badSchema))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignores signed events that are irrelevant to demo creation", async () => {
    const body = JSON.stringify({
      triggerEvent: "BOOKING_CANCELLED",
      payload: { uid: "booking-uid-123" },
    });

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an explicitly unsupported webhook payload version", async () => {
    const body = JSON.stringify(validPayload);

    const response = await POST(request(body, { version: "2099-01-01" }));

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a missing webhook payload version", async () => {
    const body = JSON.stringify(validPayload);

    const response = await POST(request(body, { version: null }));

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts duplicate deliveries by the same Cal UID", async () => {
    const body = JSON.stringify(validPayload);

    const first = await POST(request(body));
    const retry = await POST(request(body));

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(await retry.json()).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [input] of upsert.mock.calls) {
      expect(input.where).toEqual({ calUid: "booking-uid-123" });
      expect(input.create).toMatchObject({
        calUid: "booking-uid-123",
        landingPath: "/industries/clinics",
        utmSource: "google",
        gaClientId: "12345.67890",
      });
      expect(input.update).toEqual({
        startTime: new Date("2026-09-20T09:30:00.000Z"),
        attendeeName: "Dr Priya Rao",
        attendeeEmail: "priya@example.com",
        attendeePhoneE164: "+919876543210",
      });
    }
  });

  it("accepts the 2026-07-27 payload while discarding optional ICS content", async () => {
    const body = JSON.stringify({
      ...validPayload,
      payload: {
        ...validPayload.payload,
        attendeeIcsContent: "BEGIN:VCALENDAR\nPRIVATE ATTENDEE DATA",
        organizerIcsContent: "BEGIN:VCALENDAR\nPRIVATE ORGANIZER DATA",
      },
    });

    const response = await POST(request(body, { version: "2026-07-27" }));

    expect(response.status).toBe(200);
    expect(JSON.stringify(upsert.mock.calls)).not.toContain("VCALENDAR");
  });
});
