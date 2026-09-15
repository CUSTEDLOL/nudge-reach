import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx, createServiceRoleClient, createUser } = vi.hoisted(() => {
  const tx = {
    invite: { updateMany: vi.fn() },
    membership: { upsert: vi.fn() },
    org: { updateMany: vi.fn() },
  };
  const createUser = vi.fn();
  return {
    tx,
    createUser,
    createServiceRoleClient: vi.fn(() => ({ auth: { admin: { createUser } } })),
    prisma: {
      invite: { findFirst: vi.fn() },
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient }));

import {
  OWNER_SETUP_TTL_MS,
  completeOwnerSetup,
  createOwnerSetupToken,
  findValidOwnerSetupInvite,
  hashOwnerSetupToken,
  validateOwnerPassword,
} from "@/modules/orgs/owner-setup";

beforeEach(() => {
  vi.clearAllMocks();
  tx.invite.updateMany.mockResolvedValue({ count: 1 });
  tx.membership.upsert.mockResolvedValue({});
  tx.org.updateMany.mockResolvedValue({ count: 1 });
  createUser.mockResolvedValue({ data: { user: { id: "auth_user_1" } }, error: null });
});

describe("owner setup token security", () => {
  it("creates a 32-byte base64url bearer token and stores only its hash", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const issued = createOwnerSetupToken(now);

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.token).not.toBe(issued.hash);
    expect(issued.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.hash).toBe(hashOwnerSetupToken(issued.token));
  });

  it("hashes deterministically with SHA-256", () => {
    expect(hashOwnerSetupToken("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("expires exactly seven days after issuance", () => {
    const now = new Date("2026-09-15T08:15:00.000Z");
    const issued = createOwnerSetupToken(now);

    expect(OWNER_SETUP_TTL_MS).toBe(7 * 24 * 60 * 60 * 1_000);
    expect(issued.expiresAt.getTime()).toBe(now.getTime() + OWNER_SETUP_TTL_MS);
  });
});

describe("owner setup password validation", () => {
  it("requires both blank-by-default fields to match and be at least eight characters", () => {
    expect(validateOwnerPassword("", "")).toMatch(/password/i);
    expect(validateOwnerPassword("short", "short")).toMatch(/8 characters/i);
    expect(validateOwnerPassword("long-enough", "different")).toMatch(/match/i);
    expect(validateOwnerPassword("long-enough", "long-enough")).toBeNull();
  });
});

describe("findValidOwnerSetupInvite", () => {
  it("looks up only an unexpired pending OWNER invite by token hash", async () => {
    const now = new Date("2026-09-15T10:00:00.000Z");
    prisma.invite.findFirst.mockResolvedValue({
      id: "invite_1",
      email: "owner@aster.test",
      org: { id: "org_1", name: "Aster Clinic" },
      setupTokenExpiresAt: new Date("2026-09-22T10:00:00.000Z"),
    });

    const result = await findValidOwnerSetupInvite("raw-token", now);

    expect(result?.email).toBe("owner@aster.test");
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: {
        setupTokenHash: hashOwnerSetupToken("raw-token"),
        setupTokenExpiresAt: { gt: now },
        status: "pending",
        role: "OWNER",
      },
      select: {
        id: true,
        email: true,
        setupTokenExpiresAt: true,
        org: { select: { id: true, name: true } },
      },
    });
  });

  it("returns null for an invalid, expired, accepted, teammate, or superseded token", async () => {
    prisma.invite.findFirst.mockResolvedValue(null);

    await expect(findValidOwnerSetupInvite("not-valid")).resolves.toBeNull();
  });
});

describe("completeOwnerSetup", () => {
  const NOW = new Date("2026-09-15T10:00:00.000Z");
  const INVITE = {
    id: "invite_1",
    email: "owner@aster.test",
    setupTokenExpiresAt: new Date("2026-09-22T10:00:00.000Z"),
    org: { id: "org_1", name: "Aster Clinic" },
  };

  beforeEach(() => {
    prisma.invite.findFirst.mockResolvedValue(INVITE);
  });

  it("creates a confirmed auth user and atomically consumes the owner invite", async () => {
    const result = await completeOwnerSetup("raw-token", "safe-password", NOW);

    expect(result).toEqual({
      ok: true,
      email: "owner@aster.test",
      orgId: "org_1",
    });
    expect(createUser).toHaveBeenCalledWith({
      email: "owner@aster.test",
      password: "safe-password",
      email_confirm: true,
    });
    expect(tx.invite.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        setupTokenHash: hashOwnerSetupToken("raw-token"),
        setupTokenExpiresAt: { gt: NOW },
        status: "pending",
        role: "OWNER",
      },
      data: {
        status: "accepted",
        setupTokenHash: null,
        setupTokenExpiresAt: null,
      },
    });
    expect(tx.membership.upsert).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: "org_1", userId: "auth_user_1" } },
      create: {
        orgId: "org_1",
        userId: "auth_user_1",
        email: "owner@aster.test",
        displayName: "owner",
        role: "OWNER",
      },
      update: {},
    });
    expect(tx.org.updateMany).toHaveBeenCalledWith({
      where: {
        id: "org_1",
        ownerUserId: { startsWith: "pending-owner:" },
      },
      data: { ownerUserId: "auth_user_1" },
    });
  });

  it("does not replace the password when an auth account already exists", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", message: "already registered" },
    });

    const result = await completeOwnerSetup("raw-token", "safe-password", NOW);

    expect(result).toMatchObject({ ok: false, code: "existing_account" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("fails closed when the server-only Supabase credential is missing", async () => {
    createServiceRoleClient.mockImplementationOnce(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    });

    const result = await completeOwnerSetup("raw-token", "safe-password", NOW);

    expect(result).toMatchObject({ ok: false, code: "unavailable" });
    expect(createUser).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a race-lost or reused token without creating membership", async () => {
    tx.invite.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await completeOwnerSetup("raw-token", "safe-password", NOW);

    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(tx.membership.upsert).not.toHaveBeenCalled();
    expect(tx.org.updateMany).not.toHaveBeenCalled();
  });

  it("does not call privileged auth for an invalid or expired link", async () => {
    prisma.invite.findFirst.mockResolvedValueOnce(null);

    const result = await completeOwnerSetup("raw-token", "safe-password", NOW);

    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });
});
