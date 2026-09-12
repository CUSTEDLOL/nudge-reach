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

const { prisma } = vi.hoisted(() => ({
  prisma: {
    membership: { findFirst: vi.fn(), upsert: vi.fn() },
    org: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    invite: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { NoWorkspaceError, resolveOrgContext } from "@/modules/orgs/org";
import { PENDING_OWNER_PREFIX } from "@/modules/orgs/pending-owner";

const USER = "user-1";
const EMAIL = "owner@aster.in";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SIGNUP_OPEN;
  prisma.membership.findFirst.mockResolvedValue(null);
  prisma.org.findUnique.mockResolvedValue(null);
  prisma.invite.findFirst.mockResolvedValue(null);
  prisma.membership.upsert.mockResolvedValue({ id: "m1", role: "OWNER" });
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
  });

  it("lets an invited owner in and claims the placeholder owner", async () => {
    prisma.invite.findFirst.mockResolvedValue({
      id: "inv-1",
      orgId: "org-1",
      role: "OWNER",
      org: { id: "org-1", ownerUserId: `${PENDING_OWNER_PREFIX}abc` },
    });
    prisma.org.update.mockResolvedValue({ id: "org-1", ownerUserId: USER });

    const res = await resolveOrgContext(USER, EMAIL);

    expect(res.org.ownerUserId).toBe(USER);
    expect(prisma.invite.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "accepted" },
    });
    expect(prisma.org.create).not.toHaveBeenCalled();
  });

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

  it("still lets an existing member in — the gate is only about new workspaces", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: "m1",
      role: "AGENT",
      email: EMAIL,
      displayName: "Asha",
      org: { id: "org-1" },
    });

    const res = await resolveOrgContext(USER, EMAIL);

    expect(res.org.id).toBe("org-1");
    expect(prisma.org.create).not.toHaveBeenCalled();
  });
});
