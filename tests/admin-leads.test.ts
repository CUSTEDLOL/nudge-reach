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
    const page = await leadsList();
    expect(page.rows.map((r) => r.id)).toEqual(["w1", "a1"]);
    expect(page.rows[0]).toMatchObject({ kind: "waitlist", name: "Glow Derma", secondary: "Pune", vertical: "clinic", status: "new" });
    expect(page.rows[1]).toMatchObject({ kind: "access", name: "Dr Rao", secondary: "rao@clinic.in", vertical: null });
    expect(page).toMatchObject({ page: 1, pageCount: 1, total: 2 });
  });

  it("searches case-insensitively in each source while keeping status server-side", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    prisma.waitlistSignup.findMany.mockResolvedValue([]);
    await leadsList({ status: "contacted", kind: "all", search: "  PuNe  " });
    const accessArgs = prisma.accessRequest.findMany.mock.calls[0][0];
    const waitlistArgs = prisma.waitlistSignup.findMany.mock.calls[0][0];
    expect(JSON.stringify(accessArgs.where)).toContain("contacted");
    expect(JSON.stringify(accessArgs.where)).toContain("PuNe");
    expect(JSON.stringify(accessArgs.where)).toContain("email");
    expect(JSON.stringify(waitlistArgs.where)).toContain("city");
    expect(accessArgs.take).toBe(500);
    expect(waitlistArgs.take).toBe(500);
  });

  it("filters by kind by skipping the other table", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    await leadsList({ kind: "access" });
    expect(prisma.waitlistSignup.findMany).not.toHaveBeenCalled();
  });

  it("flags duplicate phone and email details without double-counting a lead", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      { id: "a1", name: "Dr Rao", email: "RAO@Clinic.in", phoneE164: "+91 99000 00001", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-03") },
      { id: "a2", name: "Rao", email: "rao@clinic.in", phoneE164: "+919800000002", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-02") },
    ]);
    prisma.waitlistSignup.findMany.mockResolvedValue([
      { id: "w1", shopName: "Glow", city: "Pune", phoneE164: "+919900000001", vertical: "clinic", source: "landing", status: "new", notes: null, createdAt: new Date("2026-09-01") },
    ]);

    const { rows } = await leadsList();
    expect(rows.find((row) => row.id === "a1")).toMatchObject({
      duplicateCount: 2,
      duplicateBy: ["phone", "email"],
    });
    expect(rows.find((row) => row.id === "a2")).toMatchObject({ duplicateCount: 1, duplicateBy: ["email"] });
    expect(rows.find((row) => row.id === "w1")).toMatchObject({ duplicateCount: 1, duplicateBy: ["phone"] });
  });

  it("uses deterministic merged numeric pagination and clamps unsafe pages", async () => {
    const at = new Date("2026-09-05T00:00:00Z");
    prisma.accessRequest.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => ({
        id: `a${String(index + 1).padStart(2, "0")}`,
        name: `Access ${index + 1}`,
        email: `a${index + 1}@example.com`,
        phoneE164: `+9110000${String(index + 1).padStart(5, "0")}`,
        source: "hero",
        status: "new",
        notes: null,
        createdAt: at,
      }))
    );
    prisma.waitlistSignup.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        id: `w${String(index + 1).padStart(2, "0")}`,
        shopName: `Waitlist ${index + 1}`,
        city: "Pune",
        phoneE164: `+9120000${String(index + 1).padStart(5, "0")}`,
        vertical: "clinic",
        source: "landing",
        status: "new",
        notes: null,
        createdAt: at,
      }))
    );

    const second = await leadsList({ page: 2 });
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: 55 });
    expect(second.rows).toHaveLength(5);
    expect((await leadsList({ page: 0 })).page).toBe(1);
    expect((await leadsList({ page: 999 })).page).toBe(2);
  });

  it("sums the new count across both tables", async () => {
    prisma.accessRequest.count.mockResolvedValue(3);
    prisma.waitlistSignup.count.mockResolvedValue(1);
    expect(await newLeadsCount()).toBe(4);
  });
});
