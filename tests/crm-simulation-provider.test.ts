import { describe, expect, it } from "vitest";
import { simulationProvider } from "@/modules/crm/providers/simulation";

const conn = { id: "cc1", orgId: "org1", provider: "sim" as const, apiDomain: "", accountsServer: "", accessToken: "" };

describe("simulation CRM provider", () => {
  it("returns deterministic external ids without network", async () => {
    const lead = { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" };
    const a = await simulationProvider.upsertLead(conn, lead);
    const b = await simulationProvider.upsertLead(conn, lead);
    expect(a.externalId).toBe("sim_lead_919876543210");
    expect(b.externalId).toBe(a.externalId);
    await expect(simulationProvider.updateStage(conn, a.externalId, "qualified")).resolves.toBeUndefined();
    await expect(
      simulationProvider.logActivity(conn, a.externalId, { kind: "note", title: "t", body: "b" })
    ).resolves.toBeUndefined();
  });
});
