import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "csec" } }));
import { zohoLeadBody, zohoNoteBody, zohoProvider, zohoStage, zohoTaskBody } from "@/modules/crm/providers/zoho";

describe("zoho builders", () => {
  it("builds an upsert-on-phone lead", () => {
    expect(
      zohoLeadBody({ phoneE164: "+919876543210", name: "Priya Sharma", source: "WhatsApp (Nudge)", description: "Ad: Hair PRP" })
    ).toEqual({
      data: [{ Last_Name: "Sharma", First_Name: "Priya", Phone: "+919876543210", Lead_Source: "WhatsApp (Nudge)", Description: "Ad: Hair PRP" }],
      duplicate_check_fields: ["Phone"],
    });
    expect(zohoLeadBody({ phoneE164: "+91", name: "+91", source: "s" }).data[0].Last_Name).toBe("+91");
  });
  it("builds notes, tasks and stages", () => {
    expect(zohoNoteBody("L1", { kind: "note", title: "Deposit", body: "₹500 paid" })).toEqual({
      data: [{ Note_Title: "Deposit", Note_Content: "₹500 paid", Parent_Id: { module: { api_name: "Leads" }, id: "L1" } }],
    });
    const t = zohoTaskBody("L1", { kind: "task", title: "Call back", body: "asked for a human", dueAt: new Date("2026-09-02T00:00:00Z"), priority: "high" });
    expect(t.data[0]).toMatchObject({ Subject: "Call back", Description: "asked for a human", Due_Date: "2026-09-02", Priority: "High", What_Id: { id: "L1" }, $se_module: "Leads" });
    expect(zohoStage("qualified")).toBe("Qualified");
  });
  it("auth url targets the data centre and asks for offline access", () => {
    const url = zohoProvider.authUrl({ state: "st", redirectUri: "https://x/cb", dc: "in" });
    expect(url.startsWith("https://accounts.zoho.in/oauth/v2/auth?")).toBe(true);
    expect(url).toContain("access_type=offline");
    expect(url).toContain("scope=ZohoCRM.modules.leads.ALL%2CZohoCRM.modules.notes.ALL%2CZohoCRM.modules.tasks.ALL");
  });
  it("upsertLead posts to the connection's api domain with the bearer token", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ code: "SUCCESS", details: { id: "L9" } }] }), { status: 200 })
    );
    const r = await zohoProvider.upsertLead(
      { id: "c", orgId: "o", provider: "zoho", apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accessToken: "tok" },
      { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" }
    );
    expect(r).toEqual({ externalId: "L9" });
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://www.zohoapis.in/crm/v8/Leads/upsert");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Zoho-oauthtoken tok" });
    spy.mockRestore();
  });
});
