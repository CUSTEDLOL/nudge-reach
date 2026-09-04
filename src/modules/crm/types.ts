/**
 * CRM integrations — one-way sync from Nudge into the client's CRM. The CRM
 * stays the system of record for humans; we write leads, stages and activities.
 */

export type CrmProviderKey = "zoho" | "salesforce" | "sim";

export type CrmEvent =
  | "contact.created"
  | "lead.qualified"
  | "booking.created"
  | "payment.paid"
  | "handoff.requested"
  | "conversation.summary";

export type CrmStage = "new" | "qualified" | "booked" | "paid";

export interface CrmLead {
  phoneE164: string;
  /** Falls back to the phone when the name is unknown. */
  name: string;
  /** "WhatsApp (Nudge)" | "Phone (Nudge)" */
  source: string;
  /** Ad headline / ctwa_clid / first message, when present. */
  description?: string;
}

export interface CrmActivity {
  kind: "note" | "task";
  title: string;
  body: string;
  dueAt?: Date;
  priority?: "high" | "normal";
}

export interface CrmTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSecs: number;
  /** Zoho api_domain / Salesforce instance_url. */
  apiDomain: string;
  /** Zoho accounts-server; "" for Salesforce. */
  accountsServer: string;
  accountLabel: string;
}

/** A decrypted, ready-to-use connection handed to provider calls. */
export interface ConnectionRow {
  id: string;
  orgId: string;
  provider: CrmProviderKey;
  apiDomain: string;
  accountsServer: string;
  accessToken: string;
}

export interface CrmProvider {
  key: CrmProviderKey;
  authUrl(input: { state: string; redirectUri: string; dc?: string }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    /** Extra callback query params (Zoho: `location`, `accounts-server`). */
    meta: Record<string, string>;
  }): Promise<CrmTokens>;
  refresh(input: {
    refreshToken: string;
    accountsServer: string;
  }): Promise<Pick<CrmTokens, "accessToken" | "expiresInSecs">>;
  upsertLead(conn: ConnectionRow, lead: CrmLead): Promise<{ externalId: string }>;
  updateStage(conn: ConnectionRow, externalId: string, stage: CrmStage): Promise<void>;
  logActivity(conn: ConnectionRow, externalId: string, activity: CrmActivity): Promise<void>;
}
