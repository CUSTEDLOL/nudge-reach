import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H1 regression: saveAgentProfileAction controls the customer-facing AI
 * auto-reply persona (org-wide). It MUST be gated to ADMIN+ server-side — the
 * nav hiding it from AGENTs is not enforcement. Before the fix it used bare
 * requireOrg() and any AGENT could rewrite or disable the assistant via a
 * direct form POST.
 */

const { requireOrgContext, upsert, orgUpdate, revalidatePath } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  upsert: vi.fn().mockResolvedValue({}),
  // Opening hours are saved on the org alongside the persona (2026-09-17).
  orgUpdate: vi.fn().mockResolvedValue({}),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({
  prisma: { agentProfile: { upsert }, org: { update: orgUpdate } },
}));
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

import {
  saveAgentProfileAction,
  saveBusinessBasicsAction,
} from "@/app/(app)/agent/setup-actions";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const ctx = (role: "OWNER" | "ADMIN" | "AGENT") => ({
  role,
  org: { id: "org1", settings: {} },
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
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("stores valid opening hours on the org and rejects broken ones", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    const hours = { sun: [], mon: [["10:00", "20:00"]], tue: [], wed: [], thu: [], fri: [], sat: [] };
    const ok = await saveAgentProfileAction(
      form({ businessName: "X", openingHours: JSON.stringify(hours) })
    );
    expect(ok.ok).toBe(true);
    expect(orgUpdate.mock.calls[0][0].data.settings).toEqual({ openingHours: hours });

    const bad = await saveAgentProfileAction(
      form({ businessName: "X", openingHours: JSON.stringify({ ...hours, mon: [["20:00", "10:00"]] }) })
    );
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/closes after it opens/);
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

/**
 * The Training page's "Your business" section writes through its OWN action,
 * and that is the whole point of it: `saveAgentProfileAction` rebuilds the
 * profile from its form, so three fields posted to it would blank
 * `businessInfo` (the owner's own instructions) and `doNots`, and switch the
 * AI off. This one touches three columns and no others.
 */
describe("saveBusinessBasicsAction — partial write", () => {
  beforeEach(() => {
    upsert.mockClear();
    requireOrgContext.mockReset();
  });

  it("stores the picked vertical as the token its template is keyed by", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    const r = await saveBusinessBasicsAction({
      businessName: "Aster Hair",
      vertical: "clinic",
      tone: "Warm",
    });

    expect(r.ok).toBe(true);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ orgId: "org1" });
    expect(call.update).toEqual({
      businessName: "Aster Hair",
      vertical: "clinic",
      tone: "Warm",
    });
  });

  it("never touches the business info, the guardrails or the on/off switch", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    await saveBusinessBasicsAction({
      businessName: "Aster Hair",
      vertical: "clinic",
      tone: "",
    });

    const { create, update } = upsert.mock.calls[0][0];
    for (const key of ["businessInfo", "doNots", "enabled"]) {
      expect(update).not.toHaveProperty(key);
      expect(create).not.toHaveProperty(key);
    }
    // An empty tone falls back rather than storing a blank persona.
    expect(update.tone).toBe("Warm, friendly, and concise");
  });

  it("refuses an AGENT and writes nothing", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    const r = await saveBusinessBasicsAction({
      businessName: "Aster Hair",
      vertical: "clinic",
      tone: "Warm",
    });

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/i);
    expect(upsert).not.toHaveBeenCalled();
  });
});
