import { describe, expect, it } from "vitest";
import { crmCardModel } from "@/app/(app)/integrations/crm-card-model";

describe("crmCardModel", () => {
  it("lists both providers with connection state and recent jobs", () => {
    const m = crmCardModel(
      [{ provider: "zoho", status: "connected", accountLabel: "Zoho CRM (in)", lastSyncAt: new Date("2026-09-01T00:00:00Z"), lastError: null }],
      [
        { event: "contact.created", status: "done", updatedAt: new Date("2026-09-01T00:00:00Z"), error: null },
        { event: "booking.created", status: "pending", updatedAt: new Date(), error: null },
      ],
      false
    );
    expect(m.providers.map((p) => [p.key, p.connected])).toEqual([["zoho", true], ["salesforce", false]]);
    expect(m.pendingCount).toBe(1);
    expect(m.recent[0].event).toBe("contact.created");
    expect(m.providers[0].lastSyncAt).toBe("2026-09-01T00:00:00.000Z");
  });
});
