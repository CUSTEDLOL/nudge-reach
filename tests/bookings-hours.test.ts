import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Opening hours moved off the retired /agent/setup page into Bookings, where
 * someone configuring availability actually looks. They are booking
 * configuration, not AI persona.
 *
 * The move must be invisible to everything downstream: the same key in
 * `Org.settings`, the same shape, still feeding `isOpenFor`. These tests carry
 * over the assertions that used to live in `agent-profile-auth.test.ts`
 * (valid hours stored on the org, broken ones refused, ADMIN gate) and add the
 * round-trip through `readOpeningHours` → `isOpenFor` that proves booking
 * behaviour is unchanged.
 */

const { requireOrgContext, orgUpdate, revalidatePath } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  orgUpdate: vi.fn().mockResolvedValue({}),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma: { org: { update: orgUpdate } } }));
vi.mock("@/modules/orgs/auth", () => {
  // Faithful stand-in for the pure role gate (roles.test.ts covers the real
  // one); the point here is that the ACTION calls it at all.
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

import { saveOpeningHoursAction } from "@/app/(app)/bookings/actions";
import { readOpeningHours } from "@/modules/calendar/hours-store";
import { isOpenFor } from "@/modules/calendar/hours";

const HOURS = {
  sun: [],
  mon: [["10:00", "20:00"]],
  tue: [["10:00", "20:00"]],
  wed: [["10:00", "20:00"]],
  thu: [["10:00", "20:00"]],
  fri: [["10:00", "20:00"]],
  sat: [["10:00", "14:00"]],
};

const IST = "Asia/Kolkata";
// 4 PM IST on Friday 18 Sep 2026 / 3 AM IST on Sunday 20 Sep 2026.
const FRI_4PM = { start: "2026-09-18T10:30:00.000Z", end: "2026-09-18T11:30:00.000Z" };
const SUN_3AM = { start: "2026-09-19T21:30:00.000Z", end: "2026-09-19T22:30:00.000Z" };

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const ctx = (
  role: "OWNER" | "ADMIN" | "AGENT",
  settings: Record<string, unknown> = {}
) => ({ role, org: { id: "org1", settings }, userId: "u1", email: "e@x.com", membership: {} });

describe("saveOpeningHoursAction (Bookings)", () => {
  beforeEach(() => {
    orgUpdate.mockClear();
    requireOrgContext.mockReset();
  });

  it("stores hours under the same Org.settings key the calendar reads", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));

    const r = await saveOpeningHoursAction(
      form({ openingHours: JSON.stringify(HOURS) })
    );

    expect(r.ok).toBe(true);
    expect(orgUpdate.mock.calls[0][0].where).toEqual({ id: "org1" });
    expect(orgUpdate.mock.calls[0][0].data.settings).toEqual({ openingHours: HOURS });
  });

  it("round-trips into the hours that drive booking availability", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));
    await saveOpeningHoursAction(form({ openingHours: JSON.stringify(HOURS) }));

    // Exactly what a later page load does: read the settings blob back.
    const stored = readOpeningHours(orgUpdate.mock.calls[0][0].data.settings);
    expect(stored).not.toBeNull();
    expect(isOpenFor(stored, FRI_4PM, IST)).toBe(true);
    // 3 AM on a Sunday: a free calendar slot, but the business is shut.
    expect(isOpenFor(stored, SUN_3AM, IST)).toBe(false);
  });

  it("keeps the rest of the settings blob intact", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN", { widget: { enabled: true } }));

    await saveOpeningHoursAction(form({ openingHours: JSON.stringify(HOURS) }));

    expect(orgUpdate.mock.calls[0][0].data.settings).toEqual({
      widget: { enabled: true },
      openingHours: HOURS,
    });
  });

  it("clears the hours when the switch is off, leaving no restriction", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN", { openingHours: HOURS }));

    const r = await saveOpeningHoursAction(form({ openingHours: "" }));

    expect(r.ok).toBe(true);
    expect(orgUpdate.mock.calls[0][0].data.settings).toEqual({});
    expect(readOpeningHours(orgUpdate.mock.calls[0][0].data.settings)).toBeNull();
    // No hours set means every slot is bookable — the behaviour before hours.
    expect(isOpenFor(null, SUN_3AM, IST)).toBe(true);
  });

  it("refuses a day that closes before it opens, and writes nothing", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN"));

    const bad = await saveOpeningHoursAction(
      form({ openingHours: JSON.stringify({ ...HOURS, mon: [["20:00", "10:00"]] }) })
    );

    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/closes after it opens/);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("refuses unparseable JSON rather than wiping the schedule", async () => {
    requireOrgContext.mockResolvedValue(ctx("ADMIN", { openingHours: HOURS }));

    const bad = await saveOpeningHoursAction(form({ openingHours: "{not json" }));

    expect(bad.ok).toBe(false);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("refuses an AGENT server-side, not just in the UI", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));

    const r = await saveOpeningHoursAction(
      form({ openingHours: JSON.stringify(HOURS) })
    );

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/i);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("allows an OWNER", async () => {
    requireOrgContext.mockResolvedValue(ctx("OWNER"));
    const r = await saveOpeningHoursAction(
      form({ openingHours: JSON.stringify(HOURS) })
    );
    expect(r.ok).toBe(true);
  });
});
