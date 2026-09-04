import { env } from "@/lib/env";
import { salesforceProvider } from "@/modules/crm/providers/salesforce";
import { zohoProvider } from "@/modules/crm/providers/zoho";
import type { CrmProvider, CrmProviderKey } from "@/modules/crm/types";

/** A real provider only when its keys are configured; otherwise null. */
export function realProvider(key: CrmProviderKey): CrmProvider | null {
  if (key === "zoho" && env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET) return zohoProvider;
  if (key === "salesforce" && env.SALESFORCE_CLIENT_ID && env.SALESFORCE_CLIENT_SECRET) {
    return salesforceProvider;
  }
  return null;
}
