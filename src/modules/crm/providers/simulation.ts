import type { CrmProvider } from "@/modules/crm/types";

/** Test-mode CRM: everything "succeeds" and leaves an audit trail in CrmSyncJob. */
export const simulationProvider: CrmProvider = {
  key: "sim",
  authUrl: ({ redirectUri, state }) => `${redirectUri}?code=sim&state=${encodeURIComponent(state)}`,
  async exchangeCode() {
    return {
      accessToken: "sim",
      refreshToken: "sim",
      expiresInSecs: 3600,
      apiDomain: "",
      accountsServer: "",
      accountLabel: "Simulated CRM",
    };
  },
  async refresh() {
    return { accessToken: "sim", expiresInSecs: 3600 };
  },
  async upsertLead(_conn, lead) {
    return { externalId: `sim_lead_${lead.phoneE164.replace(/\D/g, "")}` };
  },
  async updateStage() {},
  async logActivity() {},
};
