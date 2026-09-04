import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SALESFORCE_CLIENT_ID: "cid", SALESFORCE_CLIENT_SECRET: "csec" } }));
import { salesforceProvider, sfLeadBody, sfStatus, sfTaskBody, soqlByPhone } from "@/modules/crm/providers/salesforce";

describe("salesforce builders", () => {
  it("builds lead, task, status, soql", () => {
    expect(sfLeadBody({ phoneE164: "+919876543210", name: "Priya Sharma", source: "WhatsApp (Nudge)", description: "d" })).toEqual({
      FirstName: "Priya", LastName: "Sharma", Phone: "+919876543210", Company: "Priya Sharma", LeadSource: "WhatsApp (Nudge)", Description: "d",
    });
    expect(sfTaskBody("00Q1", { kind: "task", title: "Appointment", body: "tomorrow 5pm", dueAt: new Date("2026-09-02T00:00:00Z"), priority: "high" })).toEqual({
      Subject: "Appointment", Description: "tomorrow 5pm", ActivityDate: "2026-09-02", Priority: "High", Status: "Not Started", WhoId: "00Q1",
    });
    expect(sfTaskBody("00Q1", { kind: "note", title: "Deposit", body: "paid" })).toMatchObject({ Status: "Completed", Priority: "Normal" });
    expect(sfStatus("qualified")).toBe("Working - Contacted");
    expect(soqlByPhone("+919876543210")).toBe("SELECT Id FROM Lead WHERE Phone = '+919876543210' LIMIT 1");
  });
  it("upsertLead queries by phone then creates", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "00Q9", success: true }), { status: 201 }));
    const conn = { id: "c", orgId: "o", provider: "salesforce" as const, apiDomain: "https://acme.my.salesforce.com", accountsServer: "", accessToken: "tok" };
    expect(await salesforceProvider.upsertLead(conn, { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" })).toEqual({ externalId: "00Q9" });
    expect(String(spy.mock.calls[0][0])).toContain("/services/data/v62.0/query?q=");
    expect(String(spy.mock.calls[1][0])).toBe("https://acme.my.salesforce.com/services/data/v62.0/sobjects/Lead");
    spy.mockRestore();
  });
});
