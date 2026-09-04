import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { setOrgPlan } from "@/modules/admin/set-plan";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ id: "o1", name: "Spice", plan: "free" });
  prisma.org.update.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});
});

describe("setOrgPlan", () => {
  it("rejects unknown plans without touching the DB", async () => {
    const res = await setOrgPlan("o1", "platinum", "v@x.com");
    expect(res.ok).toBe(false);
    expect(prisma.org.update).not.toHaveBeenCalled();
  });

  it("rejects a no-op change", async () => {
    const res = await setOrgPlan("o1", "free", "v@x.com");
    expect(res.ok).toBe(false);
    expect(prisma.org.update).not.toHaveBeenCalled();
  });

  it("updates the plan AND writes a founder-labeled audit row", async () => {
    const res = await setOrgPlan("o1", "enterprise", "v@x.com");
    expect(res).toEqual({ ok: true, from: "free", to: "enterprise" });
    expect(prisma.org.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { plan: "enterprise" },
    });
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      orgId: "o1",
      action: "admin.plan_changed",
      actorName: "founder:v@x.com",
      detail: "free → enterprise",
    });
  });
});
