import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { acquisitionTrial: { updateMany } },
}));

import { markAcquisitionTrialEmailVerified } from "@/modules/trial/email-verification";

const now = new Date("2026-09-22T10:00:00.000Z");

describe("trial email verification proof", () => {
  beforeEach(() => {
    updateMany.mockReset();
  });

  it("requires the normalized email, claimed Org, and authenticated membership", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(
      markAcquisitionTrialEmailVerified({
        userId: "user_1",
        email: "  Owner@Example.COM ",
        now,
      }),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        emailNormalized: "owner@example.com",
        emailVerifiedAt: null,
        claimedAt: { not: null },
        orgId: { not: null },
        org: { memberships: { some: { userId: "user_1" } } },
      },
      data: { emailVerifiedAt: now },
    });
  });

  it.each([undefined, null, "", "   "])(
    "rejects a missing or blank email without querying (%s)",
    async (email) => {
      await expect(
        markAcquisitionTrialEmailVerified({
          userId: "user_1",
          email: email as string,
          now,
        }),
      ).resolves.toBe(false);

      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    "the authenticated user is not a member of the matched Org",
    "the trial has already been verified",
  ])("returns false when %s", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      markAcquisitionTrialEmailVerified({
        userId: "user_1",
        email: "owner@example.com",
        now,
      }),
    ).resolves.toBe(false);
  });

  it("propagates database failures to the route boundary", async () => {
    updateMany.mockRejectedValue(new Error("database unavailable"));

    await expect(
      markAcquisitionTrialEmailVerified({
        userId: "user_1",
        email: "owner@example.com",
        now,
      }),
    ).rejects.toThrow("database unavailable");
  });
});
