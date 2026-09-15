import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireFounder, createWorkspace, revalidatePath } = vi.hoisted(() => ({
  requireFounder: vi.fn(),
  createWorkspace: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/admin/create-workspace", () => ({ createWorkspace }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createWorkspaceAction } from "@/app/admin/orgs/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
});

describe("createWorkspaceAction", () => {
  it("returns structured setup-link data only to the authorized founder form", async () => {
    const setupLink = {
      url: `https://nudgeagent.app/invite/${"a".repeat(43)}`,
      email: "owner@aster.test",
      expiresAt: "2026-09-22T12:00:00.000Z",
    };
    createWorkspace.mockResolvedValue({
      ok: true,
      orgId: "org_1",
      message: "Created Aster Clinic.",
      setupLink,
    });
    const form = new FormData();
    form.set("name", "Aster Clinic");
    form.set("country", "IN");
    form.set("plan", "growth");
    form.set("ownerEmail", "owner@aster.test");

    await expect(createWorkspaceAction(form)).resolves.toEqual({
      ok: true,
      message: "Created Aster Clinic.",
      setupLink,
    });
    expect(requireFounder).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orgs");
  });
});

