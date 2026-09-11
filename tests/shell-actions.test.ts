import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOrgContext, membershipUpdate, revalidatePath } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  membershipUpdate: vi.fn().mockResolvedValue({}),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { update: membershipUpdate } },
}));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));

import { saveSidebarCollapsedAction } from "@/app/(app)/shell-actions";

describe("shell preference actions", () => {
  beforeEach(() => {
    requireOrgContext.mockReset();
    membershipUpdate.mockClear();
    revalidatePath.mockClear();
    requireOrgContext.mockResolvedValue({
      org: { id: "org-1" },
      membership: {
        id: "member-1",
        uiPreferences: { sidebarCollapsed: false, pinnedShortcuts: ["inbox"] },
      },
    });
  });

  it("updates only the authenticated member, dropping retired keys", async () => {
    const result = await saveSidebarCollapsedAction(true);

    expect(result.ok).toBe(true);
    expect(membershipUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { uiPreferences: { sidebarCollapsed: true } },
    });
  });

  it("rejects non-boolean values without writing", async () => {
    const result = await saveSidebarCollapsedAction("yes");

    expect(result.ok).toBe(false);
    expect(membershipUpdate).not.toHaveBeenCalled();
  });
});
