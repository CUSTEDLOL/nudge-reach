import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const orgFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    agentProfile: { findUnique: (...a: unknown[]) => findUnique(...a), upsert: (...a: unknown[]) => upsert(...a) },
    org: { findUnique: (...a: unknown[]) => orgFindUnique(...a) },
  },
}));

import { ensureAgentProfile } from "@/modules/agent/profile";

describe("ensureAgentProfile", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    orgFindUnique.mockReset();
  });

  it("returns the owner's profile untouched when one exists", async () => {
    const profile = { orgId: "o1", enabled: false, businessName: "Glow" };
    findUnique.mockResolvedValue(profile);
    expect(await ensureAgentProfile("o1")).toBe(profile);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("creates an enabled profile named after the business for a fresh org", async () => {
    findUnique.mockResolvedValue(null);
    orgFindUnique.mockResolvedValue({ name: "Flowcheck Dental", vertical: "clinic" });
    upsert.mockImplementation(async (args: { create: unknown }) => args.create);
    const created = (await ensureAgentProfile("o1")) as {
      enabled: boolean;
      vertical: string;
      businessName: string;
    };
    expect(created.enabled).toBe(true);
    expect(created.vertical).toBe("clinic");
    expect(created.businessName).toBe("Flowcheck Dental");
  });

  it("falls back to the generic vertical when the org never picked one", async () => {
    findUnique.mockResolvedValue(null);
    orgFindUnique.mockResolvedValue({ name: "My shop", vertical: null });
    upsert.mockImplementation(async (args: { create: { vertical: string } }) => args.create);
    const created = (await ensureAgentProfile("o1")) as { vertical: string };
    expect(created.vertical).toBe("other");
  });
});
