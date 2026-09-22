import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Closed signup. Nudge creates workspaces after a demo, so an authenticated
 * stranger must not silently receive one. The gate lives at org creation, not
 * only in the UI, because Supabase can hold an auth user we never invited (an
 * old signup, or a social login).
 *
 * Invited people must keep working: an invite is resolved before any workspace
 * is created, and an OWNER invite also claims the placeholder owner on a
 * founder-created workspace.
 */

const { prisma, claimAcquisitionTrial } = vi.hoisted(() => ({
  prisma: {
    membership: { findFirst: vi.fn(), upsert: vi.fn() },
    org: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    invite: { findFirst: vi.fn(), update: vi.fn() },
    creditGrant: { create: vi.fn() },
  },
  claimAcquisitionTrial: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/trial/claim", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/modules/trial/claim")>(),
  claimAcquisitionTrial,
}));

import { NoWorkspaceError, resolveOrgContext } from "@/modules/orgs/org";
import { PENDING_OWNER_PREFIX } from "@/modules/orgs/pending-owner";
import { parseTrialClaimMetadata } from "@/modules/trial/claim";

const USER = "user-1";
const EMAIL = "owner@aster.in";
const CLAIM = { trialId: "trial_1", claimToken: "a".repeat(43) };
const TRIAL_APP_METADATA = {
  nudge_account_origin: "instant_trial_v1",
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SIGNUP_OPEN;
  prisma.membership.findFirst.mockResolvedValue(null);
  prisma.org.findUnique.mockResolvedValue(null);
  prisma.invite.findFirst.mockResolvedValue(null);
  prisma.membership.upsert.mockResolvedValue({ id: "m1", role: "OWNER" });
  claimAcquisitionTrial.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.SIGNUP_OPEN;
});

describe("closed signup", () => {
  it("refuses to mint a workspace for an uninvited account", async () => {
    await expect(resolveOrgContext(USER, "stranger@example.com")).rejects.toBeInstanceOf(
      NoWorkspaceError
    );
    expect(prisma.org.create).not.toHaveBeenCalled();
  });

  it("still mints one when open signup is explicitly switched on", async () => {
    process.env.SIGNUP_OPEN = "1";
    prisma.org.create.mockResolvedValue({
      id: "org-new",
      memberships: [{ id: "m9" }],
    });

    const res = await resolveOrgContext(USER, "stranger@example.com");

    expect(res.org.id).toBe("org-new");
    expect(prisma.org.create).toHaveBeenCalledTimes(1);
    // The trial's AI credits ride along, expiring with the trial.
    const trialEndsAt = prisma.org.create.mock.calls[0][0].data.trialEndsAt;
    expect(prisma.creditGrant.create.mock.calls[0][0].data).toMatchObject({
      orgId: "org-new",
      kind: "trial",
      expiresAt: trialEndsAt,
    });
  });

  it("lets an invited owner in and claims the placeholder owner", async () => {
    prisma.invite.findFirst.mockResolvedValue({
      id: "inv-1",
      orgId: "org-1",
      role: "OWNER",
      org: { id: "org-1", ownerUserId: `${PENDING_OWNER_PREFIX}abc` },
    });
    prisma.org.update.mockResolvedValue({ id: "org-1", ownerUserId: USER });

    const res = await resolveOrgContext(USER, EMAIL, { trialClaim: CLAIM });

    expect(res.org.ownerUserId).toBe(USER);
    expect(prisma.invite.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "accepted" },
    });
    expect(claimAcquisitionTrial).not.toHaveBeenCalled();
    expect(prisma.org.create).not.toHaveBeenCalled();
  });

  it("allows a provenance-marked identity to claim its valid trial", async () => {
    claimAcquisitionTrial.mockResolvedValue({
      org: { id: "org-trial" },
      membership: { id: "membership-trial", role: "OWNER" },
    });

    const result = await resolveOrgContext(USER, EMAIL, {
      appMetadata: TRIAL_APP_METADATA,
      trialClaim: CLAIM,
    });

    expect(result.org.id).toBe("org-trial");
    expect(claimAcquisitionTrial).toHaveBeenCalledWith({
      userId: USER,
      email: EMAIL,
      claim: CLAIM,
    });
    expect(prisma.invite.findFirst).not.toHaveBeenCalled();
    expect(prisma.org.create).not.toHaveBeenCalled();
  });

  it.each(["AGENT", "ADMIN", "OWNER"] as const)(
    "does not let a provenance-marked trial identity accept a pending %s invite",
    async (role) => {
      prisma.invite.findFirst.mockResolvedValue({
        id: `inv-${role.toLowerCase()}`,
        orgId: "org-real",
        role,
        org: {
          id: "org-real",
          ownerUserId: role === "OWNER"
            ? `${PENDING_OWNER_PREFIX}abc`
            : "someone-real",
        },
      });

      await expect(resolveOrgContext(USER, EMAIL, {
        appMetadata: TRIAL_APP_METADATA,
        trialClaim: CLAIM,
      })).rejects.toBeInstanceOf(NoWorkspaceError);

      expect(claimAcquisitionTrial).toHaveBeenCalledWith({
        userId: USER,
        email: EMAIL,
        claim: CLAIM,
      });
      expect(prisma.invite.findFirst).not.toHaveBeenCalled();
      expect(prisma.membership.upsert).not.toHaveBeenCalled();
      expect(prisma.org.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing", undefined],
    ["malformed", {
      acquisition_trial_id: "../trial",
      acquisition_trial_token: "short",
    }],
    ["tampered", {
      acquisition_trial_id: CLAIM.trialId,
      acquisition_trial_token: "b".repeat(43),
    }],
  ])(
    "fails closed for %s trial user_metadata before invites or open signup",
    async (_label, userMetadata) => {
      process.env.SIGNUP_OPEN = "1";
      prisma.invite.findFirst.mockResolvedValue({
        id: "inv-real",
        orgId: "org-real",
        role: "OWNER",
        org: {
          id: "org-real",
          ownerUserId: `${PENDING_OWNER_PREFIX}abc`,
        },
      });

      await expect(resolveOrgContext(USER, EMAIL, {
        appMetadata: TRIAL_APP_METADATA,
        trialClaim: parseTrialClaimMetadata(userMetadata),
      })).rejects.toBeInstanceOf(NoWorkspaceError);

      expect(prisma.invite.findFirst).not.toHaveBeenCalled();
      expect(prisma.org.create).not.toHaveBeenCalled();
    },
  );

  it("does not touch a real owner when a teammate accepts an invite", async () => {
    prisma.invite.findFirst.mockResolvedValue({
      id: "inv-2",
      orgId: "org-1",
      role: "AGENT",
      org: { id: "org-1", ownerUserId: "someone-real" },
    });

    const res = await resolveOrgContext(USER, "agent@aster.in");

    expect(prisma.org.update).not.toHaveBeenCalled();
    expect(res.org.ownerUserId).toBe("someone-real");
  });

  it("still lets a non-trial admin accept an email-matched invite", async () => {
    prisma.invite.findFirst.mockResolvedValue({
      id: "inv-admin",
      orgId: "org-1",
      role: "ADMIN",
      org: { id: "org-1", ownerUserId: "someone-real" },
    });

    const res = await resolveOrgContext(USER, "admin@aster.in", {
      appMetadata: { provider: "email", providers: ["email"] },
    });

    expect(res.org.id).toBe("org-1");
    expect(prisma.membership.upsert).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: "org-1", userId: USER } },
      create: expect.objectContaining({
        email: "admin@aster.in",
        role: "ADMIN",
      }),
      update: {},
    });
    expect(prisma.invite.update).toHaveBeenCalledWith({
      where: { id: "inv-admin" },
      data: { status: "accepted" },
    });
  });

  it("still lets a provenance-marked trial identity use its claimed membership", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: "m1",
      role: "AGENT",
      email: EMAIL,
      displayName: "Asha",
      org: { id: "org-1" },
    });

    const res = await resolveOrgContext(USER, EMAIL, {
      appMetadata: TRIAL_APP_METADATA,
      trialClaim: null,
    });

    expect(res.org.id).toBe("org-1");
    expect(prisma.invite.findFirst).not.toHaveBeenCalled();
    expect(claimAcquisitionTrial).not.toHaveBeenCalled();
    expect(prisma.org.create).not.toHaveBeenCalled();
  });
});
