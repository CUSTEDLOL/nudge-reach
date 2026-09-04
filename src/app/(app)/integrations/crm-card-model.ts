/** Pure view-model for the CRM card (unit-tested; the card only renders it). */

export const CRM_PROVIDERS = [
  { key: "zoho", label: "Zoho CRM" },
  { key: "salesforce", label: "Salesforce" },
] as const;

export interface CrmCardModel {
  simulated: boolean;
  providers: Array<{
    key: (typeof CRM_PROVIDERS)[number]["key"];
    label: string;
    connected: boolean;
    accountLabel: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
  recent: Array<{ event: string; status: string; when: string; error: string | null }>;
  pendingCount: number;
}

export function crmCardModel(
  connections: Array<{
    provider: string;
    status: string;
    accountLabel: string;
    lastSyncAt: Date | null;
    lastError: string | null;
  }>,
  jobs: Array<{ event: string; status: string; updatedAt: Date; error: string | null }>,
  simulated: boolean
): CrmCardModel {
  return {
    simulated,
    providers: CRM_PROVIDERS.map((p) => {
      const c = connections.find((x) => x.provider === p.key && x.status === "connected");
      return {
        key: p.key,
        label: p.label,
        connected: !!c,
        accountLabel: c?.accountLabel ?? "",
        lastSyncAt: c?.lastSyncAt?.toISOString() ?? null,
        lastError: c?.lastError ?? null,
      };
    }),
    recent: jobs.slice(0, 10).map((j) => ({
      event: j.event,
      status: j.status,
      when: j.updatedAt.toISOString(),
      error: j.error,
    })),
    pendingCount: jobs.filter((j) => j.status === "pending").length,
  };
}
