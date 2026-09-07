import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bulk fact archiving on the AI Agent tab. The rules that matter: only the
 * caller's own org's ACTIVE facts can be touched (invariant 5), only admins,
 * and the id list is validated + capped so the action can't be abused.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { knowledgeEntry: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma }));

const { requireOrgContext, requireRole } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { archiveFactsAction } from "@/app/(app)/agent/actions";
import { buildFactSheetText } from "@/app/(app)/agent/library";

const CTX = { org: { id: "org1" }, role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue(CTX);
  requireRole.mockImplementation(() => {});
  prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 2 });
});

describe("archiveFactsAction", () => {
  it("archives only the caller's own active facts", async () => {
    const res = await archiveFactsAction(["f1", "f2"]);
    expect(res.ok).toBe(true);
    expect(prisma.knowledgeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1", "f2"] }, orgId: "org1", status: "active" },
      data: { status: "archived" },
    });
    expect(res.message).toContain("2");
  });

  it("rejects an empty selection", async () => {
    const res = await archiveFactsAction([]);
    expect(res.ok).toBe(false);
    expect(prisma.knowledgeEntry.updateMany).not.toHaveBeenCalled();
  });

  it("caps the batch and dedupes ids", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `f${i % 250}`);
    await archiveFactsAction(ids);
    const arg = prisma.knowledgeEntry.updateMany.mock.calls[0][0];
    expect(arg.where.id.in.length).toBeLessThanOrEqual(200);
    expect(new Set(arg.where.id.in).size).toBe(arg.where.id.in.length);
  });

  it("fails closed when the role check throws (AGENT seat)", async () => {
    requireRole.mockImplementation(() => {
      throw new Error("Only an admin or above can do this.");
    });
    const res = await archiveFactsAction(["f1"]);
    expect(res.ok).toBe(false);
    expect(prisma.knowledgeEntry.updateMany).not.toHaveBeenCalled();
  });
});

describe("buildFactSheetText", () => {
  it("groups by category in canonical order with conditions inline", () => {
    const text = buildFactSheetText([
      { id: "1", category: "pricing", fact: "Haircut ₹500", condition: null, source: "manual" },
      { id: "2", category: "hours", fact: "Open 10-7", condition: "not Sundays", source: "manual" },
      { id: "3", category: "pricing", fact: "Beard trim ₹200", condition: null, source: "manual" },
    ]);
    expect(text.indexOf("PRICING")).toBeLessThan(text.indexOf("HOURS"));
    expect(text).toContain("- Haircut ₹500");
    expect(text).toContain("- Open 10-7 (only: not Sundays)");
    expect(buildFactSheetText([])).toBe("");
  });
});
