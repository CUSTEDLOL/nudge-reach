import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { auditLog: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  AUDIT_EXPORT_LIMIT,
  auditExportRows,
  auditList,
  auditResult,
  auditWhere,
} from "@/modules/admin/audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.auditLog.findMany.mockResolvedValue([]);
});

describe("audit filtering", () => {
  it("combines organization, actor, action prefix, date range, and result", () => {
    expect(auditWhere({
      orgId: " org-1 ",
      actor: "FOUNDER:",
      action: "admin.",
      result: "failed",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-10",
    })).toEqual({
      orgId: "org-1",
      actorName: { contains: "FOUNDER:", mode: "insensitive" },
      createdAt: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-09-11T00:00:00.000Z"),
      },
      AND: [
        { action: { startsWith: "admin." } },
        { action: { endsWith: "failed" } },
      ],
    });
  });

  it("derives requested, failed, and completed without depending on color", () => {
    expect(auditResult("admin.operation_requested")).toBe("requested");
    expect(auditResult("admin.operation_failed")).toBe("failed");
    expect(auditResult("admin.operation_completed")).toBe("completed");
    expect(auditResult("campaign.sent")).toBe("completed");
  });

  it("keeps screen results paginated", async () => {
    prisma.auditLog.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({ id: `audit-${index}` }))
    );
    const page = await auditList({ actor: "founder:" });
    expect(page.rows).toHaveLength(50);
    expect(page.nextCursor).toBe("audit-49");
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(51);
  });

  it("caps exports at 10,000 rows and uses the same where builder", async () => {
    await auditExportRows({ orgId: "org-1", result: "requested" });
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(AUDIT_EXPORT_LIMIT);
    expect(AUDIT_EXPORT_LIMIT).toBe(10_000);
    expect(args.where).toEqual(auditWhere({ orgId: "org-1", result: "requested" }));
    expect(JSON.stringify(args.select)).not.toContain("settings");
  });
});
