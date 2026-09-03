import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation" } }));

const state = vi.hoisted(() => ({
  jobs: [] as Record<string, unknown>[],
  connections: [{ id: "cc1", orgId: "org1", provider: "sim", status: "connected", simulated: true }] as Record<string, unknown>[],
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: {
      findMany: vi.fn(async ({ where }: { where: { orgId: string } }) => state.connections.filter((c) => c.orgId === where.orgId)),
      findUniqueOrThrow: vi.fn(async () => state.connections[0]),
      update: vi.fn(async () => ({})),
    },
    org: { findUnique: vi.fn(async () => ({ id: "org1", simulated: true })) },
    crmSyncJob: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        const j = { id: `j${state.jobs.length + 1}`, status: "pending", attempts: 0, externalId: null, createdAt: new Date(), ...create };
        state.jobs.push(j);
        return j;
      }),
      findMany: vi.fn(async ({ where }: { where: { status: string } }) => state.jobs.filter((j) => j.status === where.status)),
      findFirst: vi.fn(async ({ where }: { where: { event: string; payload?: { path: string[]; equals: string } } }) =>
        state.jobs.find((j) => j.event === where.event && j.status === "done" &&
          (!where.payload || (j.payload as { lead?: { phoneE164?: string } }).lead?.phoneE164 === where.payload.equals)) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const j = state.jobs.find((x) => x.id === where.id)!;
        Object.assign(j, data);
        return j;
      }),
    },
  },
}));

import { backoffMinutes, enqueueCrmEvent, tickCrmSync } from "@/modules/crm/sync";

beforeEach(() => { state.jobs.length = 0; });

describe("backoffMinutes", () => {
  it("grows 1,5,30,120,480", () => expect([1, 2, 3, 4, 5].map(backoffMinutes)).toEqual([1, 5, 30, 120, 480]));
});

describe("enqueue + tick", () => {
  it("creates a lead job then an activity job and drains them", async () => {
    await enqueueCrmEvent("org1", "contact.created", "c1", { kind: "lead", lead: { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" } });
    await enqueueCrmEvent("org1", "booking.created", "b1", { kind: "activity", phoneE164: "+919876543210", activity: { kind: "task", title: "Appointment", body: "tomorrow 5pm" } });
    expect(state.jobs).toHaveLength(2);
    const first = await tickCrmSync(new Date());   // one job per connection lane per tick
    const second = await tickCrmSync(new Date());
    expect(first).toEqual({ done: 1, failed: 0, dead: 0 });
    expect(second).toEqual({ done: 1, failed: 0, dead: 0 });
    expect(state.jobs.every((j) => j.status === "done")).toBe(true);
    expect(state.jobs[0].externalId).toBe("sim_lead_919876543210");
    expect(state.jobs[1].externalId).toBe("sim_lead_919876543210");
  });
  it("is a no-op for orgs without a CRM", async () => {
    await enqueueCrmEvent("org2", "contact.created", "c9", { kind: "lead", lead: { phoneE164: "+91", name: "x", source: "s" } });
    expect(state.jobs).toHaveLength(0);
  });
});
