import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E0: recordContactEvent is fire-and-forget (recordAudit pattern) — it must
 * write the row when the DB cooperates and must NEVER throw into the flow
 * that emits it when the DB rejects.
 */

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { contactEvent: { create } } }));

import { recordContactEvent } from "@/modules/contacts/events";

beforeEach(() => {
  create.mockReset();
});

describe("recordContactEvent", () => {
  it("writes an org-scoped row with type, contact and props", async () => {
    create.mockResolvedValue({ id: "ev1" });
    recordContactEvent("org1", "lead_stage_changed", {
      contactId: "c1",
      props: { to: "QUALIFIED", source: "agent" },
    });
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: "org1",
        type: "lead_stage_changed",
        contactId: "c1",
        props: { to: "QUALIFIED", source: "agent" },
      },
    });
  });

  it("defaults contactId to null and props to {}", async () => {
    create.mockResolvedValue({ id: "ev2" });
    recordContactEvent("org1", "widget_click");
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith({
      data: { orgId: "org1", type: "widget_click", contactId: null, props: {} },
    });
  });

  it("never throws to the caller when the write rejects", async () => {
    create.mockRejectedValue(new Error("db down"));
    expect(() => recordContactEvent("org1", "opted_out", { contactId: "c1" }))
      .not.toThrow();
    // Let the rejected promise settle — an unhandled rejection would fail the run.
    await new Promise((r) => setTimeout(r, 0));
  });
});
