import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireFounder, revalidatePath, sendGa4LeadEvent } = vi.hoisted(
  () => ({
    prisma: {
      accessRequest: {
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      waitlistSignup: {
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      demoBooking: {
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    },
    requireFounder: vi.fn(),
    revalidatePath: vi.fn(),
    sendGa4LeadEvent: vi.fn(),
  })
);
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/marketing/ga4", () => ({ sendGa4LeadEvent }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { LeadRowItem } from "@/app/admin/leads/lead-row";
import { updateLeadAction } from "@/app/admin/leads/actions";
import { ToastProvider } from "@/components/ui/toast";
import {
  leadCounts,
  leadsList,
  newLeadsCount,
  updateLead,
} from "@/modules/admin/leads";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.accessRequest.update.mockResolvedValue({});
  prisma.waitlistSignup.update.mockResolvedValue({});
  prisma.demoBooking.update.mockResolvedValue({});
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
  sendGa4LeadEvent.mockResolvedValue("sent");
});

describe("updateLead", () => {
  it("rejects unknown statuses and empty patches", async () => {
    expect((await updateLead("access", "a1", { status: "hot" })).ok).toBe(false);
    expect((await updateLead("access", "a1", {})).ok).toBe(false);
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });

  it("writes status to the right table and trims/clears notes", async () => {
    await updateLead("waitlist", "w1", { status: "contacted", notes: "  called, callback Tue  " });
    expect(prisma.waitlistSignup.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { status: "contacted", notes: "called, callback Tue" },
    });
    await updateLead("access", "a1", { notes: "   " });
    expect(prisma.accessRequest.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { notes: null } });
  });

  it("reports a missing row instead of throwing", async () => {
    prisma.accessRequest.update.mockRejectedValue(new Error("P2025"));
    const res = await updateLead("access", "nope", { status: "dismissed" });
    expect(res.ok).toBe(false);
  });

  it("accepts qualified and derives a booking transition from persisted state", async () => {
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });

    const result = await updateLead("booking", "b1", {
      status: "qualified",
    });

    expect(prisma.demoBooking.findUnique).toHaveBeenCalledWith({
      where: { id: "b1" },
      select: { status: true, gaClientId: true },
    });
    expect(prisma.demoBooking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "qualified" },
    });
    expect(result).toEqual({
      ok: true,
      transition: {
        previous: "contacted",
        current: "qualified",
        gaClientId: "12345.67890",
      },
    });
  });
});

describe("leadsList / newLeadsCount", () => {
  it("merges all three tables newest-first with a normalised shape", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      { id: "a1", name: "Dr Rao", email: "rao@clinic.in", phoneE164: "+919900000001", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-01") },
    ]);
    prisma.waitlistSignup.findMany.mockResolvedValue([
      { id: "w1", shopName: "Glow Derma", city: "Pune", phoneE164: "+919900000002", vertical: "clinic", source: "landing", status: "weird", notes: "x", createdAt: new Date("2026-09-05") },
    ]);
    prisma.demoBooking.findMany.mockResolvedValue([
      {
        id: "b1",
        attendeeName: "Dr Mehta",
        attendeeEmail: "mehta@clinic.in",
        attendeePhoneE164: null,
        startTime: new Date("2026-09-20T10:00:00Z"),
        source: "cal",
        utmSource: "google",
        status: "qualified",
        notes: null,
        createdAt: new Date("2026-09-07"),
      },
    ]);
    const page = await leadsList();
    expect(page.rows.map((r) => r.id)).toEqual(["b1", "w1", "a1"]);
    expect(page.rows[0]).toMatchObject({
      kind: "booking",
      name: "Dr Mehta",
      secondary: "mehta@clinic.in",
      phoneE164: null,
      vertical: "clinic",
      source: "google",
      status: "qualified",
    });
    expect(page.rows[0].scheduledFor).toContain("20 Sept 2026");
    expect(page.rows[1]).toMatchObject({ kind: "waitlist", name: "Glow Derma", secondary: "Pune", vertical: "clinic", status: "new" });
    expect(page.rows[2]).toMatchObject({ kind: "access", name: "Dr Rao", secondary: "rao@clinic.in", vertical: null });
    expect(page).toMatchObject({ page: 1, pageCount: 1, total: 3 });
  });

  it("searches case-insensitively in each source while keeping status server-side", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    prisma.waitlistSignup.findMany.mockResolvedValue([]);
    prisma.demoBooking.findMany.mockResolvedValue([]);
    await leadsList({ status: "contacted", kind: "all", search: "  PuNe  " });
    const accessArgs = prisma.accessRequest.findMany.mock.calls[0][0];
    const waitlistArgs = prisma.waitlistSignup.findMany.mock.calls[0][0];
    const bookingArgs = prisma.demoBooking.findMany.mock.calls[0][0];
    expect(JSON.stringify(accessArgs.where)).toContain("contacted");
    expect(JSON.stringify(accessArgs.where)).toContain("PuNe");
    expect(JSON.stringify(accessArgs.where)).toContain("email");
    expect(JSON.stringify(waitlistArgs.where)).toContain("city");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeeName");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeeEmail");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeePhoneE164");
    expect(accessArgs.take).toBe(500);
    expect(waitlistArgs.take).toBe(500);
    expect(bookingArgs.take).toBe(500);
  });

  it("filters by kind by skipping the other table", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    await leadsList({ kind: "access" });
    expect(prisma.waitlistSignup.findMany).not.toHaveBeenCalled();
    expect(prisma.demoBooking.findMany).not.toHaveBeenCalled();
  });

  it("keeps a booking without a phone valid and renders no WhatsApp link", async () => {
    prisma.demoBooking.findMany.mockResolvedValue([
      {
        id: "b1",
        attendeeName: "Dr Mehta",
        attendeeEmail: "mehta@clinic.in",
        attendeePhoneE164: null,
        startTime: new Date("2026-09-20T10:00:00Z"),
        source: "cal",
        utmSource: null,
        status: "new",
        notes: null,
        createdAt: new Date("2026-09-07"),
      },
      {
        id: "b2",
        attendeeName: null,
        attendeeEmail: null,
        attendeePhoneE164: null,
        startTime: new Date("2026-09-21T10:00:00Z"),
        source: "cal",
        utmSource: null,
        status: "new",
        notes: null,
        createdAt: new Date("2026-09-06"),
      },
    ]);

    const { rows } = await leadsList({ kind: "booking" });
    expect(rows[0]).toMatchObject({ phoneE164: null, duplicateCount: 0 });
    expect(rows[1].secondary).toContain("21 Sept 2026");

    const html = renderToStaticMarkup(
      createElement(ToastProvider, null, createElement(LeadRowItem, { lead: rows[0] }))
    );
    expect(html).toContain('href="mailto:mehta@clinic.in"');
    expect(html).toContain("Scheduled 20 Sept 2026");
    expect(html).not.toContain("wa.me");
  });

  it("flags duplicate phone and email details without double-counting a lead", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      { id: "a1", name: "Dr Rao", email: "RAO@Clinic.in", phoneE164: "+91 99000 00001", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-03") },
      { id: "a2", name: "Rao", email: "rao@clinic.in", phoneE164: "+919800000002", source: "hero", status: "new", notes: null, createdAt: new Date("2026-09-02") },
    ]);
    prisma.waitlistSignup.findMany.mockResolvedValue([
      { id: "w1", shopName: "Glow", city: "Pune", phoneE164: "+919900000001", vertical: "clinic", source: "landing", status: "new", notes: null, createdAt: new Date("2026-09-01") },
    ]);
    prisma.demoBooking.findMany.mockResolvedValue([]);

    const { rows } = await leadsList();
    expect(rows.find((row) => row.id === "a1")).toMatchObject({
      duplicateCount: 2,
      duplicateBy: ["phone", "email"],
    });
    expect(rows.find((row) => row.id === "a2")).toMatchObject({ duplicateCount: 1, duplicateBy: ["email"] });
    expect(rows.find((row) => row.id === "w1")).toMatchObject({ duplicateCount: 1, duplicateBy: ["phone"] });
  });

  it("uses deterministic merged numeric pagination and clamps unsafe pages", async () => {
    const at = new Date("2026-09-05T00:00:00Z");
    prisma.accessRequest.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => ({
        id: `a${String(index + 1).padStart(2, "0")}`,
        name: `Access ${index + 1}`,
        email: `a${index + 1}@example.com`,
        phoneE164: `+9110000${String(index + 1).padStart(5, "0")}`,
        source: "hero",
        status: "new",
        notes: null,
        createdAt: at,
      }))
    );
    prisma.waitlistSignup.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        id: `w${String(index + 1).padStart(2, "0")}`,
        shopName: `Waitlist ${index + 1}`,
        city: "Pune",
        phoneE164: `+9120000${String(index + 1).padStart(5, "0")}`,
        vertical: "clinic",
        source: "landing",
        status: "new",
        notes: null,
        createdAt: at,
      }))
    );
    prisma.demoBooking.findMany.mockResolvedValue([]);

    const second = await leadsList({ page: 2 });
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: 55 });
    expect(second.rows).toHaveLength(5);
    expect((await leadsList({ page: 0 })).page).toBe(1);
    expect((await leadsList({ page: 999 })).page).toBe(2);
  });

  it("sums the new count and pipeline counts across all three tables", async () => {
    prisma.accessRequest.count.mockResolvedValue(3);
    prisma.waitlistSignup.count.mockResolvedValue(1);
    prisma.demoBooking.count.mockResolvedValue(2);
    prisma.accessRequest.groupBy.mockResolvedValue([
      { status: "new", _count: 3 },
    ]);
    prisma.waitlistSignup.groupBy.mockResolvedValue([
      { status: "qualified", _count: 1 },
    ]);
    prisma.demoBooking.groupBy.mockResolvedValue([
      { status: "converted", _count: 2 },
    ]);

    expect(await newLeadsCount()).toBe(6);
    expect(await leadCounts()).toEqual({
      total: 6,
      byStatus: {
        new: 3,
        contacted: 0,
        qualified: 1,
        converted: 2,
        dismissed: 0,
      },
    });
  });
});

function bookingAction(status?: string, notes?: string) {
  const formData = new FormData();
  formData.set("kind", "booking");
  formData.set("id", "b1");
  if (status !== undefined) formData.set("status", status);
  if (notes !== undefined) formData.set("notes", notes);
  return updateLeadAction(formData);
}

describe("booking lead analytics", () => {
  it("sends qualify_lead once after a persisted contacted-to-qualified transition", async () => {
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });

    await expect(bookingAction("qualified")).resolves.toEqual({
      ok: true,
      message: "Marked qualified.",
    });
    expect(sendGa4LeadEvent).toHaveBeenCalledTimes(1);
    expect(sendGa4LeadEvent).toHaveBeenCalledWith({
      name: "qualify_lead",
      clientId: "12345.67890",
      leadId: "b1",
    });
  });

  it("does not send an event for a notes-only save", async () => {
    await expect(bookingAction(undefined, "Call Tuesday")).resolves.toEqual({
      ok: true,
      message: "Note saved.",
    });
    expect(sendGa4LeadEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["dismissed", "disqualify_lead"],
    ["converted", "close_convert_lead"],
  ])("maps %s booking transitions to %s", async (status, name) => {
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });

    await bookingAction(status);

    expect(sendGa4LeadEvent).toHaveBeenCalledWith({
      name,
      clientId: "12345.67890",
      leadId: "b1",
    });
  });

  it("keeps a successful admin result when analytics delivery throws", async () => {
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });
    sendGa4LeadEvent.mockRejectedValueOnce(new Error("analytics unavailable"));

    await expect(bookingAction("qualified")).resolves.toEqual({
      ok: true,
      message: "Marked qualified.",
    });
  });
});
