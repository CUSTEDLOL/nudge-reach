import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H1 regression: saveAgentProfileAction controls the customer-facing AI
 * auto-reply persona (org-wide). It MUST be gated to ADMIN+ server-side — the
 * nav hiding it from AGENTs is not enforcement. Before the fix it used bare
 * requireOrg() and any AGENT could rewrite or disable the assistant via a
 * direct form POST.
 */

const { requireOrgContext, upsert, revalidatePath } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  upsert: vi.fn().mockResolvedValue({}),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma: { agentProfile: { upsert } } }));
vi.mock("@/modules/orgs/auth", () => {
  // Faithful stand-in for the pure role gate (the real one is covered by
  // roles.test.ts); the point here is that the ACTION calls it at all.
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrgContext,
    requireRole: (ctx: { role: string }, min: string) => {
      if (ORDER[ctx.role] < ORDER[min]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});

import { saveAgentProfileAction } from "@/app/(app)/settings/agent/actions";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const ctx = (role: "OWNER" | "ADMIN" | "AGENT") => ({
  role,
  org: { id: "org1" },
  userId: "u1",
  email: "e@x.com",
  membership: {},
});

describe("saveAgentProfileAction — H1 role gate", () => {
  beforeEach(() => {
    upsert.mockClear();
    requireOrgContext.mockReset();
  });

  it("refuses an AGENT and does NOT write the profile", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    const r = await saveAgentProfileAction(
      form({ businessName: "Spice Garden", enabled: "on" })
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/i);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("allows an ADMIN and writes scoped to the caller's own org", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    const r = await saveAgentProfileAction(
      form({ businessName: "Spice Garden", enabled: "on" })
    );
    expect(r.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    // tenant-scoped write — never a cross-org id.
    expect(upsert.mock.calls[0][0].where).toEqual({ orgId: "org1" });
  });

  it("allows an OWNER too", async () => {
    requireOrgContext.mockResolvedValue(ctx("OWNER"));
    const r = await saveAgentProfileAction(form({ businessName: "X" }));
    expect(r.ok).toBe(true);
  });

  it("still validates required fields for an authorized caller", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    const r = await saveAgentProfileAction(form({ businessName: "" }));
    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
