import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E4b per-number inbox access — server-enforced, not hidden UI:
 *  - owners/admins and unrestricted agents see everything (null)
 *  - a restricted AGENT gets a clause covering their numbers + number-less
 *    conversations (sim, voice, legacy rows)
 *  - granting numbers validates against the org's own accounts
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    membership: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    whatsappAccount: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { allowedNumberIds, numberAccessClause } from "@/modules/inbox/access";

beforeEach(() => vi.clearAllMocks());

describe("allowedNumberIds", () => {
  it("owner without a membership row is unrestricted", async () => {
    prisma.membership.findFirst.mockResolvedValue(null);
    expect(await allowedNumberIds("org1", "owner")).toBeNull();
  });

  it("ADMIN is always unrestricted, even with numbers set", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      role: "ADMIN",
      whatsappAccountIds: ["wa1"],
    });
    expect(await allowedNumberIds("org1", "admin")).toBeNull();
  });

  it("AGENT with an empty list sees all numbers", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      role: "AGENT",
      whatsappAccountIds: [],
    });
    expect(await allowedNumberIds("org1", "agent")).toBeNull();
  });

  it("AGENT with numbers set is restricted to them", async () => {
    prisma.membership.findFirst.mockResolvedValue({
      role: "AGENT",
      whatsappAccountIds: ["wa1", "wa2"],
    });
    expect(await allowedNumberIds("org1", "agent")).toEqual(["wa1", "wa2"]);
  });
});

describe("numberAccessClause", () => {
  it("is a no-op when unrestricted", () => {
    expect(numberAccessClause(null)).toEqual({});
  });

  it("covers the allowed numbers AND number-less conversations", () => {
    expect(numberAccessClause(["wa1"])).toEqual({
      OR: [{ whatsappAccountId: { in: ["wa1"] } }, { whatsappAccountId: null }],
    });
  });
});
