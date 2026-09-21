import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    acquisitionTrial: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    org: { create: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn((callback) => callback(tx)) },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { hashClaimToken } from "@/modules/trial/signup";
import {
  claimAcquisitionTrial,
  parseTrialClaimMetadata,
} from "@/modules/trial/claim";

const NOW = new Date("2026-09-20T00:00:00Z");
const EXPIRES_AT = new Date("2026-09-27T00:00:00Z");
const CLAIM_TOKEN = "a".repeat(43);
const CLAIM = { trialId: "trial_123", claimToken: CLAIM_TOKEN };
const TRIAL = {
  id: "trial_123",
  ownerName: "Asha",
  businessName: "Aster Clinic",
  emailNormalized: "owner@aster.in",
  claimTokenHash: hashClaimToken(CLAIM_TOKEN),
  claimExpiresAt: new Date("2026-09-21T00:00:00Z"),
  claimedAt: null as Date | null,
};

function resolveCandidate(candidate: typeof TRIAL) {
  tx.acquisitionTrial.findFirst.mockImplementation(({ where }) => {
    const matches = candidate.id === where.id
      && candidate.claimTokenHash === where.claimTokenHash
      && candidate.emailNormalized === where.emailNormalized
      && candidate.claimedAt === where.claimedAt
      && candidate.claimExpiresAt > where.claimExpiresAt.gt;
    return Promise.resolve(matches ? candidate : null);
  });
}

describe("trial claim metadata", () => {
  it("accepts only bounded opaque ids and tokens", () => {
    expect(parseTrialClaimMetadata({
      acquisition_trial_id: "trial_123",
      acquisition_trial_token: CLAIM_TOKEN,
    })).toEqual({ trialId: "trial_123", claimToken: CLAIM_TOKEN });
    expect(parseTrialClaimMetadata({
      acquisition_trial_id: "../x",
      acquisition_trial_token: "short",
    })).toBeNull();
  });

  it("hashes the presented token before querying", () => {
    expect(hashClaimToken(CLAIM_TOKEN)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("claimAcquisitionTrial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCandidate(TRIAL);
    tx.acquisitionTrial.updateMany.mockResolvedValue({ count: 1 });
    tx.org.create.mockImplementation(({ data }) => Promise.resolve({
      id: "org_1",
      ...data,
      memberships: [{
        id: "membership_1",
        orgId: "org_1",
        ...data.memberships.create,
      }],
    }));
  });

  it.each([
    ["stale expired token", { ...TRIAL, claimExpiresAt: new Date("2026-09-12T23:59:59Z") }],
    ["wrong email", { ...TRIAL, emailNormalized: "someone-else@aster.in" }],
    ["already claimed token", { ...TRIAL, claimedAt: new Date("2026-09-19T00:00:00Z") }],
  ])("returns no workspace for an %s", async (_reason, candidate) => {
    resolveCandidate(candidate);

    await expect(claimAcquisitionTrial({
      userId: "user_1",
      email: "OWNER@ASTER.IN",
      claim: CLAIM,
      now: NOW,
    })).resolves.toBeNull();

    expect(tx.org.create).not.toHaveBeenCalled();
  });

  it("allows a short recovery grace after email verification", async () => {
    resolveCandidate({
      ...TRIAL,
      claimExpiresAt: new Date("2026-09-19T23:59:59Z"),
    });

    await expect(claimAcquisitionTrial({
      userId: "user_1",
      email: "OWNER@ASTER.IN",
      claim: CLAIM,
      now: NOW,
    })).resolves.toMatchObject({ org: { id: "org_1" } });
  });

  it("creates one simulated free workspace with an owner and expiring 100-credit grant", async () => {
    const result = await claimAcquisitionTrial({
      userId: "user_1",
      email: "OWNER@ASTER.IN",
      claim: CLAIM,
      now: NOW,
    });

    expect(tx.acquisitionTrial.findFirst).toHaveBeenCalledWith({
      where: {
        id: "trial_123",
        claimTokenHash: hashClaimToken(CLAIM_TOKEN),
        emailNormalized: "owner@aster.in",
        claimedAt: null,
        claimExpiresAt: { gt: new Date("2026-09-13T00:00:00.000Z") },
      },
    });
    expect(tx.org.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerUserId: "user_1",
        name: "Aster Clinic",
        plan: "free",
        simulated: true,
        trialEndsAt: EXPIRES_AT,
        memberships: { create: {
          userId: "user_1",
          email: "OWNER@ASTER.IN",
          displayName: "Asha",
          role: "OWNER",
        } },
        creditGrants: { create: {
          kind: "trial",
          sourceKey: "trial",
          amountMicroUsd: 500_000,
          remainingMicroUsd: 500_000,
          expiresAt: EXPIRES_AT,
        } },
      }),
      include: { memberships: true },
    });
    expect(tx.acquisitionTrial.updateMany).toHaveBeenCalledWith({
      where: { id: "trial_123", claimedAt: null },
      data: {
        orgId: "org_1",
        claimedAt: NOW,
        startedAt: NOW,
        expiresAt: EXPIRES_AT,
      },
    });
    expect(result?.org.id).toBe("org_1");
    expect(result?.membership.role).toBe("OWNER");
  });

  it("rejects a losing concurrent claim so its transaction rolls back", async () => {
    tx.acquisitionTrial.updateMany.mockResolvedValue({ count: 0 });

    await expect(claimAcquisitionTrial({
      userId: "user_1",
      email: "owner@aster.in",
      claim: CLAIM,
      now: NOW,
    })).rejects.toThrow("Trial was already claimed.");
  });
});
