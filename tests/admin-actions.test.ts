import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireFounder, setOrgPlan, updateLead } = vi.hoisted(() => ({
  requireFounder: vi.fn(),
  setOrgPlan: vi.fn(),
  updateLead: vi.fn(),
}));

vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/admin/set-plan", () => ({ setOrgPlan }));
vi.mock("@/modules/admin/leads", () => ({ updateLead }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { runFounderAction } from "@/modules/admin/actions";
import { setPlanAction } from "@/app/admin/orgs/[id]/actions";
import { updateLeadAction } from "@/app/admin/leads/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
});

describe("admin route actions", () => {
  it("normalizes unexpected organization action failures", async () => {
    setOrgPlan.mockRejectedValueOnce(
      new Error("postgres password and internal stack")
    );
    const formData = new FormData();
    formData.set("orgId", "org_123");
    formData.set("plan", "pro");

    await expect(setPlanAction(formData)).resolves.toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
  });

  it("normalizes unexpected lead action failures", async () => {
    updateLead.mockRejectedValueOnce(
      new Error("postgres password and internal stack")
    );
    const formData = new FormData();
    formData.set("kind", "access");
    formData.set("id", "lead_123");
    formData.set("status", "qualified");

    await expect(updateLeadAction(formData)).resolves.toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
  });
});

describe("runFounderAction", () => {
  it("authorizes before invoking the privileged work", async () => {
    const work = vi.fn().mockResolvedValue({ ok: true, message: "Changed." });

    const result = await runFounderAction(work);

    expect(requireFounder).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith({ email: "founder@nudge.test" });
    expect(result).toEqual({ ok: true, message: "Changed." });
  });

  it("does not swallow founder denial", async () => {
    requireFounder.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      runFounderAction(async () => ({ ok: true, message: "Changed." }))
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("returns a stable safe error for unexpected action failures", async () => {
    const result = await runFounderAction(async () => {
      throw new Error("postgres password and internal stack");
    });

    expect(result).toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
    expect(result.message).not.toContain("postgres");
  });
});
