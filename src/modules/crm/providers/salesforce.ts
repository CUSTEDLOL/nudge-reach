import { env } from "@/lib/env";
import type { CrmActivity, CrmLead, CrmProvider, CrmStage } from "@/modules/crm/types";

/**
 * Salesforce (REST v62.0, Connected App web-server OAuth). Leads are found by
 * phone then created; activities are Tasks (Completed for notes). Access tokens
 * carry no expiry — treated as 2 h and refreshed on demand.
 */

const LOGIN = "https://login.salesforce.com";
const API = "/services/data/v62.0";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2
    ? { LastName: name.trim() || "Unknown" }
    : { FirstName: parts.slice(0, -1).join(" "), LastName: parts.at(-1)! };
}

export function sfLeadBody(lead: CrmLead) {
  return {
    ...splitName(lead.name),
    Phone: lead.phoneE164,
    Company: lead.name.trim() || "Unknown",
    LeadSource: lead.source,
    ...(lead.description ? { Description: lead.description } : {}),
  };
}

export function sfTaskBody(leadId: string, a: CrmActivity) {
  return {
    Subject: a.title,
    Description: a.body,
    ...(a.dueAt ? { ActivityDate: a.dueAt.toISOString().slice(0, 10) } : {}),
    Priority: a.priority === "high" ? "High" : "Normal",
    Status: a.kind === "note" ? "Completed" : "Not Started",
    WhoId: leadId,
  };
}

export function sfStatus(stage: CrmStage): string {
  return {
    new: "Open - Not Contacted",
    qualified: "Working - Contacted",
    booked: "Working - Contacted",
    paid: "Closed - Converted",
  }[stage];
}

export function soqlByPhone(phone: string): string {
  return `SELECT Id FROM Lead WHERE Phone = '${phone.replace(/'/g, "")}' LIMIT 1`;
}

async function sfFetch(
  conn: { apiDomain: string; accessToken: string },
  path: string,
  init: RequestInit = {}
) {
  const res = await fetch(`${conn.apiDomain}${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`salesforce ${path}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json as Record<string, unknown>;
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

export const salesforceProvider: CrmProvider = {
  key: "salesforce",
  authUrl: ({ state, redirectUri }) => {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: env.SALESFORCE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: "api refresh_token offline_access",
      state,
    });
    return `${LOGIN}/services/oauth2/authorize?${q}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(
      `${LOGIN}/services/oauth2/token`,
      form({
        grant_type: "authorization_code",
        client_id: env.SALESFORCE_CLIENT_ID ?? "",
        client_secret: env.SALESFORCE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      })
    );
    const j = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      instance_url?: string;
      error_description?: string;
    };
    if (!j.access_token || !j.refresh_token || !j.instance_url) {
      throw new Error(`salesforce token: ${j.error_description ?? res.status}`);
    }
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresInSecs: 7200,
      apiDomain: j.instance_url,
      accountsServer: "",
      accountLabel: `Salesforce (${new URL(j.instance_url).hostname})`,
    };
  },
  async refresh({ refreshToken }) {
    const res = await fetch(
      `${LOGIN}/services/oauth2/token`,
      form({
        grant_type: "refresh_token",
        client_id: env.SALESFORCE_CLIENT_ID ?? "",
        client_secret: env.SALESFORCE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
      })
    );
    const j = (await res.json()) as { access_token?: string; error_description?: string };
    if (!j.access_token) throw new Error(`salesforce refresh: ${j.error_description ?? res.status}`);
    return { accessToken: j.access_token, expiresInSecs: 7200 };
  },
  async upsertLead(conn, lead) {
    const found = (await sfFetch(conn, `/query?q=${encodeURIComponent(soqlByPhone(lead.phoneE164))}`)) as {
      records?: Array<{ Id: string }>;
    };
    if (found.records?.[0]?.Id) return { externalId: found.records[0].Id };
    const created = (await sfFetch(conn, "/sobjects/Lead", {
      method: "POST",
      body: JSON.stringify(sfLeadBody(lead)),
    })) as { id?: string };
    if (!created.id) throw new Error("salesforce lead create returned no id");
    return { externalId: created.id };
  },
  async updateStage(conn, externalId, stage) {
    await sfFetch(conn, `/sobjects/Lead/${externalId}`, {
      method: "PATCH",
      body: JSON.stringify({ Status: sfStatus(stage) }),
    });
  },
  async logActivity(conn, externalId, activity) {
    await sfFetch(conn, "/sobjects/Task", { method: "POST", body: JSON.stringify(sfTaskBody(externalId, activity)) });
  },
};
