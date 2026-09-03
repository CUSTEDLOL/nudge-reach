import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation" } }));
const state = vi.hoisted(() => ({
  created: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    followUpConfig: { findMany: vi.fn(async () => [{ orgId: "org1", enabled: true, reminderCalls: true }]) },
    voiceNumber: {
      findFirst: vi.fn(async () => ({
        id: "vn1", orgId: "org1", phoneE164: "+918000000001", elevenPhoneId: "pn",
        language: "en", voiceId: null, transferTo: null, enabled: true,
      })),
    },
    org: { findUnique: vi.fn(async () => ({ id: "org1", timezone: "Asia/Kolkata", simulated: true })) },
    bookingRequest: {
      findMany: vi.fn(async () => [
        {
          id: "b1", orgId: "org1", name: "Priya", requestedFor: "today 5pm",
          scheduledFor: new Date("2026-09-01T11:30:00Z"), status: "confirmed", reminder2SentAt: null,
          contact: { id: "c1", phoneE164: "+919876543210", name: "Priya", optedOutAt: null },
        },
        {
          id: "b2", orgId: "org1", name: "Amit", requestedFor: "today 5pm",
          scheduledFor: new Date("2026-09-01T11:30:00Z"), status: "confirmed", reminder2SentAt: null,
          contact: { id: "c2", phoneE164: "+919876543211", name: "Amit", optedOutAt: new Date() },
        },
      ]),
      update: vi.fn(async (args: Record<string, unknown>) => { state.updated.push(args); return {}; }),
    },
    voiceCall: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.created.push(data); return { id: "vc" }; }),
    },
    knowledgeEntry: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({
    enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "",
  })),
}));

import { isCallingHour, tickReminderCalls } from "@/modules/voice/reminder-calls";

describe("isCallingHour", () => {
  it("allows 09:00–20:00 local time only", () => {
    expect(isCallingHour(new Date("2026-09-01T04:30:00Z"), "Asia/Kolkata")).toBe(true); // 10:00 IST
    expect(isCallingHour(new Date("2026-09-01T16:30:00Z"), "Asia/Kolkata")).toBe(false); // 22:00 IST
  });
});

describe("tickReminderCalls", () => {
  it("calls bookings in the T-2h window, skips opted-out contacts, marks reminder sent", async () => {
    const r = await tickReminderCalls(new Date("2026-09-01T09:45:00Z")); // 15:15 IST, booking at 17:00 IST
    expect(r).toEqual({ reminders: 1, noShows: 0, skipped: 1 });
    expect(state.created[0]).toMatchObject({ orgId: "org1", direction: "outbound", purpose: "reminder", toE164: "+919876543210" });
    expect(state.updated[0]).toMatchObject({ where: { id: "b1" } });
  });
});
