import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    invite: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import {
  OWNER_SETUP_TTL_MS,
  createOwnerSetupToken,
  findValidOwnerSetupInvite,
  hashOwnerSetupToken,
  validateOwnerPassword,
} from "@/modules/orgs/owner-setup";

beforeEach(() => {
  vi.clearAllMocks();
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

