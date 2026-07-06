import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * MEDIUM regression: updateCampaignAction overwrites content and forces a
 * campaign back to DRAFT (clearing any approval/schedule). It must be
 * ADMIN-gated — an AGENT could otherwise disrupt an admin's approved/scheduled
 * campaign via a direct form POST.
 */

const { requireOrg, requireOrgContext, updateMany } = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  requireOrgContext: vi.fn(),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { campaign: { updateMany } } }));
vi.mock("@/modules/orgs/auth", () => {
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrg,
    requireOrgContext,
    requireRole: (ctx: { role: string }, min: string) => {
      if (ORDER[ctx.role] < ORDER[min]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});

import { updateCampaignAction } from "@/app/(app)/campaigns/actions";

const form = (f: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  return fd;
};
const ctx = (role: "OWNER" | "ADMIN" | "AGENT") => ({
  role,
  org: { id: "org1" },
  userId: "u1",
  email: "e@x.com",
  membership: {},
});

beforeEach(() => {
  updateMany.mockClear();
  requireOrgContext.mockReset();
});

describe("updateCampaignAction — role gate", () => {
  it("refuses an AGENT and never mutates the campaign", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    const r = await updateCampaignAction(
      form({ campaignId: "c1", productName: "X", body: "hi" })
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/i);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
