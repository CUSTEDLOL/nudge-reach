import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Reject all" on the imported-facts review list. The rules that matter:
 * only the caller's own org's DRAFT rows are touched (invariant 5), only
 * admins, and rejected drafts are archived rather than deleted so a bad
 * import stays recoverable and auditable.
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

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { discardAllDraftsAction } from "@/app/(app)/agent/actions";

const CTX = { org: { id: "org1" }, role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue(CTX);
  requireRole.mockImplementation(() => {});
  prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 7 });
});

describe("discardAllDraftsAction", () => {
  it("archives only the caller's own drafts, never another org's", async () => {
    const res = await discardAllDraftsAction();

    expect(res.ok).toBe(true);
    expect(prisma.knowledgeEntry.updateMany).toHaveBeenCalledWith({
      where: { orgId: "org1", status: "draft" },
      data: { status: "archived" },
    });
    expect(res.message).toContain("7");
  });

  it("leaves approved facts alone — it only ever touches drafts", async () => {
    await discardAllDraftsAction();
    const arg = prisma.knowledgeEntry.updateMany.mock.calls[0][0];
    expect(arg.where.status).toBe("draft");
    expect(arg.data.status).toBe("archived");
  });

  it("reports honestly when there was nothing to reject", async () => {
    prisma.knowledgeEntry.updateMany.mockResolvedValue({ count: 0 });
    const res = await discardAllDraftsAction();
    expect(res.ok).toBe(false);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("records the bulk rejection in the audit trail", async () => {
    await discardAllDraftsAction();
    expect(recordAudit).toHaveBeenCalledWith(
      CTX,
      "knowledge.drafts_discarded",
      "7"
    );
  });

  it("fails closed when the role check throws (AGENT seat)", async () => {
    requireRole.mockImplementation(() => {
      throw new Error("Only an admin or above can do this.");
    });
    const res = await discardAllDraftsAction();
    expect(res.ok).toBe(false);
    expect(prisma.knowledgeEntry.updateMany).not.toHaveBeenCalled();
  });
});
