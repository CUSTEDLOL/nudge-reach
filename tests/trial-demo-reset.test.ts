import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrgContext,
  requireRole,
  isSimulated,
  isRestrictedAcquisitionTrial,
  resetDemoWorkspace,
} = vi.hoisted(() => ({
  prisma: {},
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
  isSimulated: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  resetDemoWorkspace: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/mode", () => ({ isSimulated }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext, requireRole }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/modules/demo/reset", () => ({ resetDemoWorkspace }));
vi.mock("@/modules/trial/capabilities", () => ({
  isRestrictedAcquisitionTrial,
}));

import { resetDemoDataAction } from "@/app/(app)/settings/data/actions";

describe("restricted trial demo reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({
      org: { id: "org_trial", sendMode: "simulation" },
      role: "OWNER",
    });
    isSimulated.mockReturnValue(true);
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    resetDemoWorkspace.mockResolvedValue({
      contacts: 1,
      conversations: 1,
      campaigns: 1,
    });
  });

  it("blocks the server action before demo seeding can create knowledge", async () => {
    await expect(resetDemoDataAction()).resolves.toEqual({
      ok: false,
      message: "Demo reset is not available during a free trial.",
    });

    expect(requireRole).toHaveBeenCalledWith(expect.any(Object), "OWNER");
    expect(resetDemoWorkspace).not.toHaveBeenCalled();
  });
});
