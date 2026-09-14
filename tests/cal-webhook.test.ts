import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseCalBooking,
  verifyCalSignature,
} from "@/modules/marketing/cal-webhook";

const SECRET = "cal-webhook-secret";

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

const longValue = "a".repeat(240);
const bookingPayload = {
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
        timeZone: "Asia/Kolkata",
      },
    ],
    metadata: {
      landingPath: `/industries/clinics/${longValue}`,
      referrer: `https://www.google.com/${longValue}`,
      utm_source: longValue,
      utm_medium: "organic",
      utm_campaign: "clinic-search",
      gaClientId: "12345.67890",
      videoCallUrl: "https://meet.example/private-room",
      undeclared: { patientAnswer: "private" },
    },
    additionalNotes: "Private consultation notes",
    videoCallData: { url: "https://meet.example/private-room" },
    attendeeIcsContent: "BEGIN:VCALENDAR\nPRIVATE ATTENDEE DATA",
    organizerIcsContent: "BEGIN:VCALENDAR\nPRIVATE ORGANIZER DATA",
    unexpected: { private: "must not survive" },
  },
};

describe("verifyCalSignature", () => {
  it("accepts the HMAC-SHA256 hex signature for the exact raw body", () => {
    const body = JSON.stringify(bookingPayload);
    expect(verifyCalSignature(body, sign(body), SECRET)).toBe(true);
  });

  it.each([
    ["missing signature", null, SECRET, JSON.stringify(bookingPayload)],
    ["empty signature", "", SECRET, JSON.stringify(bookingPayload)],
    ["malformed signature", "not-hex", SECRET, JSON.stringify(bookingPayload)],
    ["short signature", "ab12", SECRET, JSON.stringify(bookingPayload)],
    ["missing secret", sign(JSON.stringify(bookingPayload)), "", JSON.stringify(bookingPayload)],
    ["wrong secret", sign(JSON.stringify(bookingPayload)), "wrong", JSON.stringify(bookingPayload)],
    ["tampered body", sign(JSON.stringify(bookingPayload)), SECRET, JSON.stringify({ ...bookingPayload, createdAt: "changed" })],
  ])("rejects %s without throwing", (_name, signature, secret, body) => {
    expect(() => verifyCalSignature(body, signature, secret)).not.toThrow();
    expect(verifyCalSignature(body, signature, secret)).toBe(false);
  });
});

describe("parseCalBooking", () => {
  it("returns only the declared booking and attribution fields", () => {
    const parsed = parseCalBooking(JSON.stringify(bookingPayload));

    expect(parsed).toEqual({
      calUid: "booking-uid-123",
      attendeeName: "Dr Priya Rao",
      attendeeEmail: "priya@example.com",
      attendeePhoneE164: "+919876543210",
      eventType: "30min",
      startTime: new Date("2026-09-20T09:30:00.000Z"),
      attribution: {
        landingPath: `/industries/clinics/${longValue}`.slice(0, 200),
        referrer: `https://www.google.com/${longValue}`.slice(0, 200),
        utmSource: longValue.slice(0, 200),
        utmMedium: "organic",
        utmCampaign: "clinic-search",
        gaClientId: "12345.67890",
      },
    });

    const serialized = JSON.stringify(parsed);
    for (const sensitive of [
      "additionalNotes",
      "Private consultation notes",
      "videoCallUrl",
      "private-room",
      "attendeeIcsContent",
      "organizerIcsContent",
      "VCALENDAR",
      "unexpected",
      "patientAnswer",
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it("returns null for events other than the configured booking event", () => {
    expect(
      parseCalBooking(
        JSON.stringify({ ...bookingPayload, triggerEvent: "BOOKING_CANCELLED" })
      )
    ).toBeNull();
  });

  it("returns null for a different Cal event-type slug", () => {
    expect(
      parseCalBooking(
        JSON.stringify({
          triggerEvent: "BOOKING_CREATED",
          payload: { type: "60min", unrelated: "not our event shape" },
        })
      )
    ).toBeNull();
  });

  it("throws for invalid JSON or an invalid booking schema", () => {
    expect(() => parseCalBooking("{broken")).toThrow();
    expect(() =>
      parseCalBooking(
        JSON.stringify({
          triggerEvent: "BOOKING_CREATED",
          payload: {
            uid: "booking-uid-123",
            type: "30min",
            startTime: "not-a-date",
            attendees: [],
          },
        })
      )
    ).toThrow();
  });
});
