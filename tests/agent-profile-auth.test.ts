import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H1 regression: the actions behind the Training page control the
 * customer-facing AI (its persona, and whether it answers at all) for the whole
 * org. They MUST be gated to ADMIN+ server-side — the nav hiding a page from an
 * AGENT is not enforcement. Before the fix the profile writer used a bare
 * requireOrg() and any AGENT could rewrite or disable the assistant with a
 * direct form POST.
 *
 * The page these used to live on (/agent/setup) is retired; its opening-hours
 * half now belongs to Bookings and is covered by `bookings-hours.test.ts`,
 * which carries over the same role and validation assertions.
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

import {
  saveBusinessBasicsAction,
  setAutoReplyAction,
} from "@/app/(app)/agent/setup-actions";

const ctx = (role: "OWNER" | "ADMIN" | "AGENT") => ({
  role,
  org: { id: "org1", name: "Aster Hair", vertical: "clinic", settings: {} },
  userId: "u1",
  email: "e@x.com",
  membership: {},
});

/**
 * The Training page's "Your business" section writes through its OWN action,
 * and that is the whole point of it: the retired Setup action rebuilt the
 * profile from one form, so three fields posted to it would have blanked
 * `businessInfo` (the owner's own instructions) and `doNots`, and switched the
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
    // tenant-scoped write — never a cross-org id.
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

  it("still validates required fields for an authorized caller", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    const r = await saveBusinessBasicsAction({
      businessName: "  ",
      vertical: "clinic",
      tone: "Warm",
    });

    expect(r.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
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

  it("allows an OWNER too", async () => {
    requireOrgContext.mockResolvedValue(ctx("OWNER"));
    const r = await saveBusinessBasicsAction({
      businessName: "Aster Hair",
      vertical: "clinic",
      tone: "Warm",
    });
    expect(r.ok).toBe(true);
  });
});

/**
 * The on/off switch, both ways. Retiring Setup took away the only place an
 * owner could stop the AI answering, so the switch moved to Training — and it
 * has to be the same gate the rest of the persona has.
 */
describe("setAutoReplyAction — the AI's on/off switch", () => {
  beforeEach(() => {
    upsert.mockClear();
    requireOrgContext.mockReset();
  });

  it("switches the AI off without disturbing anything else on the profile", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));

    const r = await setAutoReplyAction(false);

    expect(r.ok).toBe(true);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ orgId: "org1" });
    expect(call.update).toEqual({ enabled: false });
    expect(r.message).toMatch(/off/i);
  });

  it("switches it back on", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));

    const r = await setAutoReplyAction(true);

    expect(r.ok).toBe(true);
    expect(upsert.mock.calls[0][0].update).toEqual({ enabled: true });
  });

  it("refuses an AGENT server-side, not just in the UI", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));

    const r = await setAutoReplyAction(false);

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/i);
    expect(upsert).not.toHaveBeenCalled();
  });
});
