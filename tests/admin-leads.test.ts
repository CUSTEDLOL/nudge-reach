import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    accessRequest: { update: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    waitlistSignup: { update: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { leadsList, newLeadsCount, updateLead } from "@/modules/admin/leads";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.accessRequest.update.mockResolvedValue({});
  prisma.waitlistSignup.update.mockResolvedValue({});
});

describe("updateLead", () => {
  it("rejects unknown statuses and empty patches", async () => {
    expect((await updateLead("access", "a1", { status: "hot" })).ok).toBe(false);
    expect((await updateLead("access", "a1", {})).ok).toBe(false);
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });

  it("writes status to the right table and trims/clears notes", async () => {
    await updateLead("waitlist", "w1", { status: "contacted", notes: "  called, callback Tue  " });
    expect(prisma.waitlistSignup.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { status: "contacted", notes: "called, callback Tue" },
    });
    await updateLead("access", "a1", { notes: "   " });
    expect(prisma.accessRequest.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { notes: null } });
  });

  it("reports a missing row instead of throwing", async () => {
    prisma.accessRequest.update.mockRejectedValue(new Error("P2025"));
    const res = await updateLead("access", "nope", { status: "dismissed" });
    expect(res.ok).toBe(false);
  });
});

describe("leadsList / newLeadsCount", () => {
  it("merges both tables newest-first with a normalised shape", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      { id: "a1", name: "Dr Rao", email: "rao@clinic.in", phoneE164: "+919900000001", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-01") },
    ]);
    prisma.waitlistSignup.findMany.mockResolvedValue([
      { id: "w1", shopName: "Glow Derma", city: "Pune", phoneE164: "+919900000002", vertical: "clinic", source: "landing", status: "weird", notes: "x", createdAt: new Date("2026-09-05") },
    ]);
    const rows = await leadsList();
    expect(rows.map((r) => r.id)).toEqual(["w1", "a1"]);
    expect(rows[0]).toMatchObject({ kind: "waitlist", name: "Glow Derma", secondary: "Pune", vertical: "clinic", status: "new" });
    expect(rows[1]).toMatchObject({ kind: "access", name: "Dr Rao", secondary: "rao@clinic.in", vertical: null });
  });

  it("filters by status server-side and by kind by skipping a table", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    prisma.waitlistSignup.findMany.mockResolvedValue([]);
    await leadsList({ status: "contacted", kind: "access" });
    expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "contacted" } }));
    expect(prisma.waitlistSignup.findMany).not.toHaveBeenCalled();
  });

  it("sums the new count across both tables", async () => {
    prisma.accessRequest.count.mockResolvedValue(3);
    prisma.waitlistSignup.count.mockResolvedValue(1);
    expect(await newLeadsCount()).toBe(4);
  });
});
