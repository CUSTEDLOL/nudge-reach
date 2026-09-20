import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOrgContext, findUnique, updateMany, revalidatePath } = vi.hoisted(
  () => ({
    requireOrgContext: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    revalidatePath: vi.fn(),
  }),
);

vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/lib/db", () => ({
  prisma: { acquisitionTrial: { findUnique, updateMany } },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  completeTrialTourAction,
  dismissTrialTourAction,
  restartTrialTourAction,
  saveTrialTourStepAction,
} from "@/app/(app)/trial/actions";

describe("trial tour actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({ org: { id: "org_1" } });
    findUnique.mockResolvedValue({ id: "trial_1", convertedAt: null });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("saves a validated step through the trial id and current org", async () => {
    await expect(saveTrialTourStepAction("train")).resolves.toEqual({ ok: true });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", orgId: "org_1", convertedAt: null },
      data: { tourStep: "train" },
    });
  });

  it("rejects an unknown step before reading or writing tenant state", async () => {
    await expect(saveTrialTourStepAction("unknown")).resolves.toEqual({
      ok: false,
      message: "Unknown tour step.",
    });
    expect(requireOrgContext).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["converted", { id: "trial_1", convertedAt: new Date() }],
  ])("does not update a %s trial", async (_case, trial) => {
    findUnique.mockResolvedValue(trial);

    await expect(saveTrialTourStepAction("test")).resolves.toMatchObject({ ok: false });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("dismisses without marking the tour complete", async () => {
    await dismissTrialTourAction();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", orgId: "org_1", convertedAt: null },
      data: { tourDismissedAt: expect.any(Date) },
    });
  });

  it("finishes at the final step", async () => {
    await completeTrialTourAction();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", orgId: "org_1", convertedAt: null },
      data: { tourStep: "finish", tourCompletedAt: expect.any(Date) },
    });
  });

  it("restarts from welcome and clears both terminal timestamps", async () => {
    await restartTrialTourAction();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", orgId: "org_1", convertedAt: null },
      data: {
        tourStep: "welcome",
        tourDismissedAt: null,
        tourCompletedAt: null,
      },
    });
  });
});
