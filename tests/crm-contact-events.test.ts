import { describe, expect, it, vi, beforeEach } from "vitest";

const enqueueCrmEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/modules/crm/sync", () => ({ enqueueCrmEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(async () => ({ id: "c1", phoneE164: "+919876543210", name: "Priya" })),
    },
  },
}));

import { crmStageFor, syncContactEventToCrm } from "@/modules/crm/contact-events";

beforeEach(() => vi.clearAllMocks());

describe("crmStageFor", () => {
  it("maps Nudge lead stages onto CRM stages", () => {
    expect(crmStageFor("NEW")).toBe("new");
    expect(crmStageFor("CONTACTED")).toBe("new");
    expect(crmStageFor("QUALIFIED")).toBe("qualified");
    expect(crmStageFor("WON")).toBe("paid");
    expect(crmStageFor("LOST")).toBeNull();
    expect(crmStageFor("SOMETHING_ELSE")).toBeNull();
  });
});

describe("syncContactEventToCrm", () => {
  it("pushes a stage change, keyed so each transition syncs once", async () => {
    await syncContactEventToCrm("org1", "lead_stage_changed", { contactId: "c1", props: { to: "WON" } });
    expect(enqueueCrmEvent).toHaveBeenCalledWith("org1", "lead.stage_changed", "c1:WON", {
      kind: "stage", phoneE164: "+919876543210", stage: "paid",
    });
  });

  it("records an opt-out as a note the client's team will see", async () => {
    await syncContactEventToCrm("org1", "opted_out", { contactId: "c1", props: { source: "manual" } });
    expect(enqueueCrmEvent).toHaveBeenCalledWith("org1", "contact.opted_out", "c1", {
      kind: "activity",
      phoneE164: "+919876543210",
      activity: {
        kind: "note",
        title: "Opted out of messages",
        body: "Priya (+919876543210) opted out via Nudge (manual). Do not message them again.",
      },
    });
  });

  it("ignores events the CRM has no opinion about, and LOST stages", async () => {
    await syncContactEventToCrm("org1", "widget_click", {});
    await syncContactEventToCrm("org1", "lead_stage_changed", { contactId: "c1", props: { to: "LOST" } });
    await syncContactEventToCrm("org1", "lead_stage_changed", { props: { to: "WON" } });
    expect(enqueueCrmEvent).not.toHaveBeenCalled();
  });

  it("never throws when the queue is down", async () => {
    enqueueCrmEvent.mockRejectedValueOnce(new Error("db down"));
    await expect(
      syncContactEventToCrm("org1", "lead_stage_changed", { contactId: "c1", props: { to: "WON" } })
    ).resolves.toBeUndefined();
  });
});
