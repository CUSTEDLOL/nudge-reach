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
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      acquisitionTrial: {
        update: vi.fn(),
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
import AdminLeadsPage from "@/app/admin/leads/page";
import { ToastProvider } from "@/components/ui/toast";
import {
  formatBookingStart,
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
  prisma.demoBooking.updateMany.mockResolvedValue({ count: 1 });
  prisma.acquisitionTrial.update.mockResolvedValue({});
  prisma.acquisitionTrial.findMany.mockResolvedValue([]);
  prisma.acquisitionTrial.groupBy.mockResolvedValue([]);
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
  sendGa4LeadEvent.mockResolvedValue("sent");
});

function mockConcurrentBookingUpdates() {
  let booking = { status: "contacted", gaClientId: "12345.67890" };
  let observedReads = 0;
  let releaseReads!: () => void;
  const bothObserved = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });
  prisma.demoBooking.findUnique.mockImplementation(async () => {
    const snapshot = { ...booking };
    if (observedReads < 2) {
      observedReads += 1;
      if (observedReads === 2) releaseReads();
      await bothObserved;
    }
    return snapshot;
  });
  prisma.demoBooking.updateMany.mockImplementation(async ({ where, data }) => {
    if (booking.status !== where.status) return { count: 0 };
    booking = { ...booking, ...data };
    return { count: 1 };
  });
  return () => booking;
}

describe("updateLead", () => {
  it("rejects runtime-invalid lead kinds and opaque IDs before database access", async () => {
    const call = updateLead as unknown as (
      kind: string,
      id: string,
      patch: { status?: string }
    ) => ReturnType<typeof updateLead>;

    await expect(call("patient", "lead_123", { status: "qualified" })).resolves.toEqual({
      ok: false,
      error: "Bad lead reference.",
    });
    await expect(
      call("booking", "person@example.com", { status: "qualified" })
    ).resolves.toEqual({ ok: false, error: "Bad lead reference." });
    await expect(
      call("booking", "a".repeat(129), { status: "qualified" })
    ).resolves.toEqual({ ok: false, error: "Bad lead reference." });
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    expect(prisma.waitlistSignup.update).not.toHaveBeenCalled();
    expect(prisma.demoBooking.update).not.toHaveBeenCalled();
    expect(prisma.demoBooking.updateMany).not.toHaveBeenCalled();
    expect(prisma.demoBooking.findUnique).not.toHaveBeenCalled();
  });

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

  it("maps trial pipeline fields to leadStatus and founderNotes", async () => {
    await updateLead("trial", "t1", {
      status: "qualified",
      notes: "  wants a demo Tuesday  ",
    });

    expect(prisma.acquisitionTrial.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: {
        leadStatus: "qualified",
        founderNotes: "wants a demo Tuesday",
      },
    });
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
    expect(prisma.demoBooking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", status: "contacted" },
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

  it("allows only one transition when same-target updates race", async () => {
    const currentBooking = mockConcurrentBookingUpdates();

    const results = await Promise.all([
      updateLead("booking", "b1", { status: "qualified" }),
      updateLead("booking", "b1", { status: "qualified" }),
    ]);

    expect(currentBooking().status).toBe("qualified");
    expect(results.filter((result) => result.ok && result.transition)).toHaveLength(1);
    expect(results.filter((result) => result.ok && !result.transition)).toHaveLength(1);
  });

  it("rejects a stale competing update without reporting a transition", async () => {
    const currentBooking = mockConcurrentBookingUpdates();

    const results = await Promise.all([
      updateLead("booking", "b1", { status: "qualified" }),
      updateLead("booking", "b1", { status: "dismissed" }),
    ]);

    expect(currentBooking().status).toBe("qualified");
    expect(results[0]).toMatchObject({
      ok: true,
      transition: { previous: "contacted", current: "qualified" },
    });
    expect(results[1]).toEqual({
      ok: false,
      error: "Lead changed while you were editing. Refresh and try again.",
    });
  });
});

describe("leadsList / newLeadsCount", () => {
  it("formats stored booking instants in the configured operator time zone", () => {
    const instant = new Date("2026-09-20T10:00:00.000Z");

    expect(formatBookingStart(instant, "Asia/Kolkata")).toContain(
      "20 Sept 2026, 15:30 (Asia/Kolkata)"
    );
    expect(formatBookingStart(instant, "America/New_York")).toContain(
      "20 Sept 2026, 06:00 (America/New_York)"
    );
  });

  it("shows and accepts the demo-booking source filter", async () => {
    prisma.demoBooking.findMany.mockResolvedValue([]);
    prisma.accessRequest.groupBy.mockResolvedValue([]);
    prisma.waitlistSignup.groupBy.mockResolvedValue([]);
    prisma.demoBooking.groupBy.mockResolvedValue([]);

    const page = await AdminLeadsPage({
      searchParams: Promise.resolve({ kind: "booking", status: "all" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Demo bookings");
    expect(html).toContain("kind=booking");
    expect(prisma.demoBooking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.waitlistSignup.findMany).not.toHaveBeenCalled();
  });

  it("shows and accepts the free-trial source filter", async () => {
    prisma.acquisitionTrial.findMany.mockResolvedValue([]);
    prisma.accessRequest.groupBy.mockResolvedValue([]);
    prisma.waitlistSignup.groupBy.mockResolvedValue([]);
    prisma.demoBooking.groupBy.mockResolvedValue([]);
    prisma.acquisitionTrial.groupBy.mockResolvedValue([]);

    const page = await AdminLeadsPage({
      searchParams: Promise.resolve({ kind: "trial", status: "all" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Free trials");
    expect(html).toContain("free-trial signups");
    expect(html).toContain("kind=trial");
    expect(prisma.acquisitionTrial.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.waitlistSignup.findMany).not.toHaveBeenCalled();
    expect(prisma.demoBooking.findMany).not.toHaveBeenCalled();
  });

  it("lists unclaimed free trials with their phone and renders a WhatsApp link", async () => {
    prisma.acquisitionTrial.findMany.mockResolvedValue([
      {
        id: "t1",
        orgId: null,
        claimedAt: null,
        ownerName: "Riya Shah",
        businessName: "Cedar Studio",
        email: "riya@example.com",
        phoneE164: "+91 98765 43210",
        source: "free-trial",
        leadStatus: "contacted",
        founderNotes: "Requested a callback",
        createdAt: new Date("2026-09-22T08:00:00Z"),
      },
    ]);

    const { rows } = await leadsList({ kind: "trial" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "t1",
      kind: "trial",
      name: "Riya Shah",
      secondary: "Cedar Studio",
      email: "riya@example.com",
      phoneE164: "+91 98765 43210",
      status: "contacted",
      notes: "Requested a callback",
      orgId: null,
      claimedAt: null,
    });

    const html = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(LeadRowItem, { lead: rows[0] })
      )
    );
    expect(html).toContain("free trial");
    expect(html).toContain("Cedar Studio");
    expect(html).toContain('href="https://wa.me/919876543210"');
  });

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
    expect(page.rows[0].scheduledFor).toContain(
      "20 Sept 2026, 15:30 (Asia/Kolkata)"
    );
    expect(page.rows[1]).toMatchObject({ kind: "waitlist", name: "Glow Derma", secondary: "Pune", vertical: "clinic", status: "new" });
    expect(page.rows[2]).toMatchObject({ kind: "access", name: "Dr Rao", secondary: "rao@clinic.in", vertical: null });
    expect(page).toMatchObject({ page: 1, pageCount: 1, total: 3 });
  });

  it("searches case-insensitively in each source while keeping status server-side", async () => {
    prisma.accessRequest.findMany.mockResolvedValue([]);
    prisma.waitlistSignup.findMany.mockResolvedValue([]);
    prisma.demoBooking.findMany.mockResolvedValue([]);
    prisma.acquisitionTrial.findMany.mockResolvedValue([]);
    await leadsList({ status: "contacted", kind: "all", search: "  PuNe  " });
    const accessArgs = prisma.accessRequest.findMany.mock.calls[0][0];
    const waitlistArgs = prisma.waitlistSignup.findMany.mock.calls[0][0];
    const bookingArgs = prisma.demoBooking.findMany.mock.calls[0][0];
    const trialArgs = prisma.acquisitionTrial.findMany.mock.calls[0][0];
    expect(JSON.stringify(accessArgs.where)).toContain("contacted");
    expect(JSON.stringify(accessArgs.where)).toContain("PuNe");
    expect(JSON.stringify(accessArgs.where)).toContain("email");
    expect(JSON.stringify(waitlistArgs.where)).toContain("city");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeeName");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeeEmail");
    expect(JSON.stringify(bookingArgs.where)).toContain("attendeePhoneE164");
    expect(JSON.stringify(trialArgs.where)).toContain("leadStatus");
    expect(JSON.stringify(trialArgs.where)).toContain("ownerName");
    expect(JSON.stringify(trialArgs.where)).toContain("businessName");
    expect(JSON.stringify(trialArgs.where)).toContain("email");
    expect(JSON.stringify(trialArgs.where)).toContain("phoneE164");
    expect(accessArgs.take).toBe(500);
    expect(waitlistArgs.take).toBe(500);
    expect(bookingArgs.take).toBe(500);
    expect(trialArgs.take).toBe(500);
  });

  it("searches free-trial phones directly without requiring an org", async () => {
    prisma.acquisitionTrial.findMany.mockResolvedValue([]);

    await leadsList({ kind: "trial", search: "+9198765" });

    expect(prisma.acquisitionTrial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { phoneE164: { contains: "+9198765", mode: "insensitive" } },
          ]),
        },
      })
    );
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
    expect(html).toContain(
      "Scheduled 20 Sept 2026, 15:30 (Asia/Kolkata)"
    );
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

  it("sums the new count and pipeline counts across all four tables", async () => {
    prisma.accessRequest.count.mockResolvedValue(3);
    prisma.waitlistSignup.count.mockResolvedValue(1);
    prisma.demoBooking.count.mockResolvedValue(2);
    prisma.acquisitionTrial.count.mockResolvedValue(4);
    prisma.accessRequest.groupBy.mockResolvedValue([
      { status: "new", _count: 3 },
    ]);
    prisma.waitlistSignup.groupBy.mockResolvedValue([
      { status: "qualified", _count: 1 },
    ]);
    prisma.demoBooking.groupBy.mockResolvedValue([
      { status: "converted", _count: 2 },
    ]);
    prisma.acquisitionTrial.groupBy.mockResolvedValue([
      { leadStatus: "new", _count: 2 },
      { leadStatus: "contacted", _count: 2 },
    ]);

    expect(await newLeadsCount()).toBe(10);
    expect(await leadCounts()).toEqual({
      total: 10,
      byStatus: {
        new: 5,
        contacted: 2,
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
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not send an event for a notes-only save", async () => {
    await expect(bookingAction(undefined, "Call Tuesday")).resolves.toEqual({
      ok: true,
      message: "Note saved.",
    });
    expect(sendGa4LeadEvent).not.toHaveBeenCalled();
  });

  it("does not report a deliberately skipped GA4 delivery as a failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });
    sendGa4LeadEvent.mockResolvedValueOnce("skipped");

    await expect(bookingAction("qualified")).resolves.toEqual({
      ok: true,
      message: "Marked qualified.",
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("reports a failed GA4 delivery without lead, client, Cal, or landing identifiers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });
    sendGa4LeadEvent.mockResolvedValueOnce("failed");

    await expect(bookingAction("qualified")).resolves.toEqual({
      ok: true,
      message: "Marked qualified.",
    });
    expect(error).toHaveBeenCalledWith(
      "[analytics] GA4 lead-event delivery failed",
      { event: "qualify_lead" }
    );
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain("b1");
    expect(logged).not.toContain("12345.67890");
    expect(logged).not.toContain("calUid");
    expect(logged).not.toContain("landing");
    error.mockRestore();
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
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.demoBooking.findUnique.mockResolvedValue({
      status: "contacted",
      gaClientId: "12345.67890",
    });
    sendGa4LeadEvent.mockRejectedValueOnce(new Error("analytics unavailable"));

    await expect(bookingAction("qualified")).resolves.toEqual({
      ok: true,
      message: "Marked qualified.",
    });
    expect(error).toHaveBeenCalledWith(
      "[analytics] GA4 lead-event delivery failed",
      { event: "qualify_lead" }
    );
    error.mockRestore();
  });

  it("emits once when two same-target booking actions race", async () => {
    mockConcurrentBookingUpdates();

    const results = await Promise.all([
      bookingAction("qualified"),
      bookingAction("qualified"),
    ]);

    expect(results).toEqual([
      { ok: true, message: "Marked qualified." },
      { ok: true, message: "Marked qualified." },
    ]);
    expect(sendGa4LeadEvent).toHaveBeenCalledTimes(1);
  });

  it("emits only the committed event when competing booking actions race", async () => {
    const currentBooking = mockConcurrentBookingUpdates();

    const results = await Promise.all([
      bookingAction("qualified"),
      bookingAction("dismissed"),
    ]);

    expect(currentBooking().status).toBe("qualified");
    expect(results).toEqual([
      { ok: true, message: "Marked qualified." },
      {
        ok: false,
        message: "Lead changed while you were editing. Refresh and try again.",
      },
    ]);
    expect(sendGa4LeadEvent).toHaveBeenCalledTimes(1);
    expect(sendGa4LeadEvent).toHaveBeenCalledWith({
      name: "qualify_lead",
      clientId: "12345.67890",
      leadId: "b1",
    });
  });
});
