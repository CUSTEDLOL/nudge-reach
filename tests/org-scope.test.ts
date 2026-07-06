import { describe, it, expect, vi } from "vitest";

// callerOrgFilter builds a pure Prisma filter; stub the db so importing the
// module never instantiates a real PrismaClient.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { callerOrgFilter } from "@/modules/orgs/org";

/**
 * M1 regression + tenant-isolation primitive. The lightweight polling routes
 * (campaign stats, template status) scope by this filter instead of a full
 * requireOrgContext(). It must be owner-OR-member: the old owner-only form
 * silently 404'd the poll for non-owner teammates, and any scoping drift
 * between the two routes is a tenant-isolation risk.
 */
describe("callerOrgFilter — org scoping", () => {
  it("scopes to owner OR membership, not owner-only", () => {
    const f = callerOrgFilter("u1");
    expect(f.OR).toEqual([
      { ownerUserId: "u1" },
      { memberships: { some: { userId: "u1" } } },
    ]);
  });

  it("binds strictly to the given user id (no cross-user leakage)", () => {
    const json = JSON.stringify(callerOrgFilter("u2"));
    expect(json).toContain("u2");
    expect(json).not.toContain("u1");
  });
});
