import { env } from "@/lib/env";
import type { CrmActivity, CrmLead, CrmProvider, CrmStage } from "@/modules/crm/types";

/**
 * Zoho CRM (API v8). Data-centre aware: the callback tells us the accounts
 * server (`accounts-server`) and the token response the `api_domain`; both are
 * stored on the connection. Pure body builders are unit-tested.
 */

const SCOPES = "ZohoCRM.modules.leads.ALL,ZohoCRM.modules.notes.ALL,ZohoCRM.modules.tasks.ALL";

function splitName(name: string): { First_Name?: string; Last_Name: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { Last_Name: name.trim() || "Unknown" };
  return { First_Name: parts.slice(0, -1).join(" "), Last_Name: parts.at(-1)! };
}

export function zohoLeadBody(lead: CrmLead) {
  const { First_Name, Last_Name } = splitName(lead.name);
  return {
    data: [
      {
        Last_Name,
        ...(First_Name ? { First_Name } : {}),
        Phone: lead.phoneE164,
        Lead_Source: lead.source,
        ...(lead.description ? { Description: lead.description } : {}),
      },
    ],
    duplicate_check_fields: ["Phone"],
  };
}

export function zohoNoteBody(leadId: string, a: CrmActivity) {
  return {
    data: [
      { Note_Title: a.title, Note_Content: a.body, Parent_Id: { module: { api_name: "Leads" }, id: leadId } },
    ],
  };
}

export function zohoTaskBody(leadId: string, a: CrmActivity) {
  return {
    data: [
      {
        Subject: a.title,
        Description: a.body,
        Status: "Not Started",
        Priority: a.priority === "high" ? "High" : "Normal",
        ...(a.dueAt ? { Due_Date: a.dueAt.toISOString().slice(0, 10) } : {}),
        What_Id: { id: leadId },
        $se_module: "Leads",
      },
    ],
  };
}

export function zohoStage(stage: CrmStage): string {
  return { new: "Not Contacted", qualified: "Qualified", booked: "Qualified", paid: "Qualified" }[stage];
}

async function zohoFetch(
  conn: { apiDomain: string; accessToken: string },
  path: string,
  body: unknown,
  method = "POST"
) {
  const res = await fetch(`${conn.apiDomain}/crm/v8/${path}`, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${conn.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{ code?: string; details?: { id?: string }; message?: string }>;
  };
  const first = json.data?.[0];
  if (!res.ok || first?.code !== "SUCCESS") {
    throw new Error(`zoho ${path}: HTTP ${res.status} ${first?.message ?? ""}`.trim());
  }
  return first;
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

export const zohoProvider: CrmProvider = {
  key: "zoho",
  authUrl: ({ state, redirectUri, dc = "in" }) => {
    const q = new URLSearchParams({
      scope: SCOPES,
      client_id: env.ZOHO_CLIENT_ID ?? "",
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      redirect_uri: redirectUri,
      state,
    });
    return `https://accounts.zoho.${dc}/oauth/v2/auth?${q}`;
  },
  async exchangeCode({ code, redirectUri, meta }) {
    const accountsServer = meta["accounts-server"] ?? "https://accounts.zoho.in";
    const res = await fetch(
      `${accountsServer}/oauth/v2/token`,
      form({
        grant_type: "authorization_code",
        client_id: env.ZOHO_CLIENT_ID ?? "",
        client_secret: env.ZOHO_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      })
    );
    const j = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      api_domain?: string;
      expires_in?: number;
      error?: string;
    };
    if (!j.access_token || !j.refresh_token || !j.api_domain) {
      throw new Error(`zoho token: ${j.error ?? res.status}`);
    }
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresInSecs: j.expires_in ?? 3600,
      apiDomain: j.api_domain,
      accountsServer,
      accountLabel: `Zoho CRM (${meta.location ?? "in"})`,
    };
  },
  async refresh({ refreshToken, accountsServer }) {
    const res = await fetch(
      `${accountsServer}/oauth/v2/token`,
      form({
        grant_type: "refresh_token",
        client_id: env.ZOHO_CLIENT_ID ?? "",
        client_secret: env.ZOHO_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
      })
    );
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!j.access_token) throw new Error(`zoho refresh: ${j.error ?? res.status}`);
    return { accessToken: j.access_token, expiresInSecs: j.expires_in ?? 3600 };
  },
  async upsertLead(conn, lead) {
    const first = await zohoFetch(conn, "Leads/upsert", zohoLeadBody(lead));
    return { externalId: first.details?.id ?? "" };
  },
  async updateStage(conn, externalId, stage) {
    await zohoFetch(conn, "Leads", { data: [{ id: externalId, Lead_Status: zohoStage(stage) }] }, "PUT");
  },
  async logActivity(conn, externalId, activity) {
    if (activity.kind === "note") await zohoFetch(conn, "Notes", zohoNoteBody(externalId, activity));
    else await zohoFetch(conn, "Tasks", zohoTaskBody(externalId, activity));
  },
};
