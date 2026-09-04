# CRM Integrations (Zoho, Salesforce) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (founder mandate: inline execution by Fable, NO subagent delegation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lead, booking, payment, hand-off and conversation summary the AI Front Desk produces is written into the client's CRM (Zoho CRM first, Salesforce second) automatically, with a connect button in Settings → Integrations.

**Architecture:** New module `src/modules/crm/` with a `CrmProvider` interface (Zoho, Salesforce, simulation), per-org `CrmConnection` rows holding encrypted OAuth tokens, and a `CrmSyncJob` queue drained by the existing cron tick with retries. Product code never calls a CRM directly — it enqueues events; the tick maps events to provider calls. Pure request builders are unit-tested; IO is thin.

**Tech Stack:** Existing only — Next.js 16, Prisma 6, zod, vitest, `lib/crypto` (AES-256-GCM), `fetch`. No new npm deps. New env: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`.

**Spec:** `docs/superpowers/specs/2026-08-29-voice-and-crm-design.md` (Part B)

## Global Constraints

- All 7 `AGENTS.md` invariants hold; sync is one-way Nudge → CRM; no message send paths are added.
- Tenant isolation: `CrmConnection` and `CrmSyncJob` are `orgId`-scoped; the OAuth `state` is an HMAC over `orgId:provider:nonce` with `TOKEN_ENCRYPTION_KEY`; callbacks reject unknown/forged state.
- Tokens at rest are encrypted with `encryptSecret` from `@/lib/crypto`; never logged.
- Simulation: with no provider keys, or for a simulated org, the `sim` provider is used and writes only to `CrmSyncJob` (status `done`, `externalId: "sim_…"`), so Integrations shows a working sync log in test mode.
- Rate limits: one in-flight job per connection per tick; failed jobs retry with backoff 1, 5, 30, 120, 480 minutes then `status: "dead"`.
- Green at every commit: `npx vitest run`, `npm run lint`, `npx tsc --noEmit`; `npm run build` before the final commit. Schema tasks end with `npm run db:push && npm run db:rls`.
- Commit author: `git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit …`.

---

### Task 1: Schema + env

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/env-schema.ts:36-60`
- Modify: `.env.example`
- Test: `tests/crm-env.test.ts`

**Interfaces:**
- Produces Prisma models:
```prisma
model CrmConnection {
  id                    String   @id @default(cuid())
  orgId                 String
  org                   Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  provider              String            // "zoho" | "salesforce" | "sim"
  accountLabel          String   @default("")
  apiDomain             String   @default("") // Zoho api_domain / Salesforce instance_url
  accountsServer        String   @default("") // Zoho accounts-server for refresh; "" for Salesforce
  refreshTokenEncrypted String
  accessTokenEncrypted  String?
  accessTokenExpiresAt  DateTime?
  status                String   @default("connected") // connected | error | disconnected
  lastError             String?
  lastSyncAt            DateTime?
  simulated             Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([orgId, provider])
}

model CrmSyncJob {
  id         String    @id @default(cuid())
  orgId      String
  org        Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  provider   String
  event      String    // contact.created | lead.qualified | booking.created | payment.paid | handoff.requested | conversation.summary
  entityId   String    // the Nudge id the event is about (contactId / bookingId / paymentId / conversationId)
  payload    Json
  status     String    @default("pending") // pending | done | dead
  attempts   Int       @default(0)
  nextRunAt  DateTime  @default(now())
  externalId String?
  error      String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([orgId, provider, event, entityId])
  @@index([status, nextRunAt])
}
```
Plus `crmConnections CrmConnection[]` and `crmSyncJobs CrmSyncJob[]` on `model Org`. Env keys: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` (all `z.string().optional()`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-env.test.ts
import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env-schema";

describe("crm env", () => {
  it("keeps CRM keys optional", () => {
    const parsed = envSchema.parse({ SEND_MODE: "simulation" });
    expect(parsed.ZOHO_CLIENT_ID).toBeUndefined();
    expect(parsed.SALESFORCE_CLIENT_ID).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-env.test.ts`
Expected: FAIL — type error / property does not exist on the parsed env.

- [ ] **Step 3: Add schema + env**

Append the two models above to `prisma/schema.prisma`; add the two relation arrays to `model Org`. In `src/lib/env-schema.ts` after the Google keys:

```ts
    // CRM integrations (optional — without keys the simulation provider is used)
    ZOHO_CLIENT_ID: z.string().optional(),
    ZOHO_CLIENT_SECRET: z.string().optional(),
    SALESFORCE_CLIENT_ID: z.string().optional(),
    SALESFORCE_CLIENT_SECRET: z.string().optional(),
```
`.env.example`:
```
# CRM integrations (optional)
ZOHO_CLIENT_ID=""          # Zoho API console → Server-based client; redirect {APP_URL}/api/integrations/crm/zoho/callback
ZOHO_CLIENT_SECRET=""
SALESFORCE_CLIENT_ID=""    # Salesforce Connected App (web server flow; scopes: api refresh_token offline_access)
SALESFORCE_CLIENT_SECRET=""
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-env.test.ts && npx prisma validate`
Expected: PASS; schema valid.

- [ ] **Step 5: Push + commit**

```bash
npm run db:push && npm run db:rls
git add prisma/schema.prisma src/lib/env-schema.ts .env.example tests/crm-env.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): CrmConnection + CrmSyncJob models, provider env keys"
```

---

### Task 2: Provider interface, event types, simulation provider

**Files:**
- Create: `src/modules/crm/types.ts`
- Create: `src/modules/crm/providers/simulation.ts`
- Test: `tests/crm-simulation-provider.test.ts`

**Interfaces:**
- Produces (exact, used by every later task):
```ts
export type CrmProviderKey = "zoho" | "salesforce" | "sim";
export type CrmEvent =
  | "contact.created" | "lead.qualified" | "booking.created"
  | "payment.paid" | "handoff.requested" | "conversation.summary";
export type CrmStage = "new" | "qualified" | "booked" | "paid";

export interface CrmLead {
  phoneE164: string;
  name: string;              // last name fallback = phone
  source: string;            // "WhatsApp (Nudge)" | "Phone (Nudge)"
  description?: string;      // ad headline / ctwa_clid / first message
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
  apiDomain: string;       // Zoho api_domain / Salesforce instance_url
  accountsServer: string;  // Zoho accounts-server; "" for Salesforce
  accountLabel: string;
}
export interface ConnectionRow {
  id: string; orgId: string; provider: CrmProviderKey;
  apiDomain: string; accountsServer: string; accessToken: string;
}
export interface CrmProvider {
  key: CrmProviderKey;
  authUrl(input: { state: string; redirectUri: string; dc?: string }): string;
  exchangeCode(input: { code: string; redirectUri: string; meta: Record<string, string> }): Promise<CrmTokens>;
  refresh(input: { refreshToken: string; accountsServer: string }): Promise<Pick<CrmTokens, "accessToken" | "expiresInSecs">>;
  upsertLead(conn: ConnectionRow, lead: CrmLead): Promise<{ externalId: string }>;
  updateStage(conn: ConnectionRow, externalId: string, stage: CrmStage): Promise<void>;
  logActivity(conn: ConnectionRow, externalId: string, activity: CrmActivity): Promise<void>;
}
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-simulation-provider.test.ts
import { describe, expect, it } from "vitest";
import { simulationProvider } from "@/modules/crm/providers/simulation";

const conn = { id: "cc1", orgId: "org1", provider: "sim" as const, apiDomain: "", accountsServer: "", accessToken: "" };

describe("simulation CRM provider", () => {
  it("returns deterministic external ids without network", async () => {
    const a = await simulationProvider.upsertLead(conn, { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" });
    const b = await simulationProvider.upsertLead(conn, { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" });
    expect(a.externalId).toBe("sim_lead_919876543210");
    expect(b.externalId).toBe(a.externalId);
    await expect(simulationProvider.updateStage(conn, a.externalId, "qualified")).resolves.toBeUndefined();
    await expect(simulationProvider.logActivity(conn, a.externalId, { kind: "note", title: "t", body: "b" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-simulation-provider.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`src/modules/crm/types.ts` — paste the interfaces from the block above verbatim.

```ts
// src/modules/crm/providers/simulation.ts
import type { CrmProvider } from "@/modules/crm/types";

/** Test-mode CRM: everything "succeeds" and leaves an audit trail in CrmSyncJob. */
export const simulationProvider: CrmProvider = {
  key: "sim",
  authUrl: ({ redirectUri, state }) => `${redirectUri}?code=sim&state=${encodeURIComponent(state)}`,
  async exchangeCode() {
    return { accessToken: "sim", refreshToken: "sim", expiresInSecs: 3600, apiDomain: "", accountsServer: "", accountLabel: "Simulated CRM" };
  },
  async refresh() { return { accessToken: "sim", expiresInSecs: 3600 }; },
  async upsertLead(_conn, lead) { return { externalId: `sim_lead_${lead.phoneE164.replace(/\D/g, "")}` }; },
  async updateStage() {},
  async logActivity() {},
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-simulation-provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/types.ts src/modules/crm/providers/simulation.ts tests/crm-simulation-provider.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): provider interface + simulation provider"
```

---

### Task 3: OAuth state signing

**Files:**
- Create: `src/modules/crm/oauth-state.ts`
- Test: `tests/crm-oauth-state.test.ts`

**Interfaces:**
- Produces: `signState(orgId: string, provider: CrmProviderKey, secret: string, nonce?: string): string`; `verifyState(state: string, secret: string): { orgId: string; provider: CrmProviderKey } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-oauth-state.test.ts
import { describe, expect, it } from "vitest";
import { signState, verifyState } from "@/modules/crm/oauth-state";

describe("oauth state", () => {
  it("round-trips and rejects tampering", () => {
    const s = signState("org1", "zoho", "k".repeat(32));
    expect(verifyState(s, "k".repeat(32))).toEqual({ orgId: "org1", provider: "zoho" });
    expect(verifyState(s.replace("org1", "org2"), "k".repeat(32))).toBeNull();
    expect(verifyState(s, "x".repeat(32))).toBeNull();
    expect(verifyState("garbage", "k".repeat(32))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-oauth-state.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/oauth-state.ts
import crypto from "node:crypto";
import type { CrmProviderKey } from "@/modules/crm/types";

const PROVIDERS: CrmProviderKey[] = ["zoho", "salesforce", "sim"];

export function signState(orgId: string, provider: CrmProviderKey, secret: string, nonce = crypto.randomBytes(8).toString("hex")): string {
  const payload = `${orgId}:${provider}:${nonce}`;
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${mac}`).toString("base64url");
}

export function verifyState(state: string, secret: string): { orgId: string; provider: CrmProviderKey } | null {
  let decoded: string;
  try { decoded = Buffer.from(state, "base64url").toString("utf8"); } catch { return null; }
  const parts = decoded.split(":");
  if (parts.length !== 4) return null;
  const [orgId, provider, nonce, mac] = parts;
  if (!PROVIDERS.includes(provider as CrmProviderKey)) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${orgId}:${provider}:${nonce}`).digest("hex");
  if (expected.length !== mac.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(mac, "hex"))) return null;
  return { orgId, provider: provider as CrmProviderKey };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-oauth-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/oauth-state.ts tests/crm-oauth-state.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): HMAC-signed OAuth state"
```

---

### Task 4: Zoho CRM provider

**Files:**
- Create: `src/modules/crm/providers/zoho.ts`
- Test: `tests/crm-zoho.test.ts`

**Interfaces:**
- Consumes: `CrmProvider` types (Task 2).
- Produces: `zohoProvider: CrmProvider`; pure builders `zohoLeadBody(lead: CrmLead)`, `zohoNoteBody(leadId: string, a: CrmActivity)`, `zohoTaskBody(leadId: string, a: CrmActivity)`, `zohoStage(stage: CrmStage): string`.

Zoho facts used: scopes `ZohoCRM.modules.leads.ALL,ZohoCRM.modules.notes.ALL,ZohoCRM.modules.tasks.ALL`; auth URL `https://accounts.zoho.{dc}/oauth/v2/auth` with `access_type=offline&prompt=consent`; callback query carries `code`, `location` (`in|us|eu|au|jp|ca|sa`), `accounts-server`; token endpoint `{accounts-server}/oauth/v2/token`; token response has `access_token`, `refresh_token`, `api_domain`, `expires_in`; refresh uses `grant_type=refresh_token`; API v8: `POST {api_domain}/crm/v8/Leads/upsert` with `duplicate_check_fields: ["Phone"]`; `POST /crm/v8/Notes` with `Parent_Id: { module: { api_name: "Leads" }, id }`; `POST /crm/v8/Tasks` with `What_Id: { id }` and `$se_module: "Leads"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-zoho.test.ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "csec" } }));
import { zohoLeadBody, zohoNoteBody, zohoProvider, zohoStage, zohoTaskBody } from "@/modules/crm/providers/zoho";

describe("zoho builders", () => {
  it("builds an upsert-on-phone lead", () => {
    expect(zohoLeadBody({ phoneE164: "+919876543210", name: "Priya Sharma", source: "WhatsApp (Nudge)", description: "Ad: Hair PRP" })).toEqual({
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
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ code: "SUCCESS", details: { id: "L9" } }] }), { status: 200 }));
    const r = await zohoProvider.upsertLead({ id: "c", orgId: "o", provider: "zoho", apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accessToken: "tok" },
      { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" });
    expect(r).toEqual({ externalId: "L9" });
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://www.zohoapis.in/crm/v8/Leads/upsert");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Zoho-oauthtoken tok" });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-zoho.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/providers/zoho.ts
import { env } from "@/lib/env";
import type { CrmActivity, CrmLead, CrmProvider, CrmStage } from "@/modules/crm/types";

const SCOPES = "ZohoCRM.modules.leads.ALL,ZohoCRM.modules.notes.ALL,ZohoCRM.modules.tasks.ALL";

function splitName(name: string): { First_Name?: string; Last_Name: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { Last_Name: name.trim() || "Unknown" };
  return { First_Name: parts.slice(0, -1).join(" "), Last_Name: parts.at(-1)! };
}

export function zohoLeadBody(lead: CrmLead) {
  const { First_Name, Last_Name } = splitName(lead.name);
  return {
    data: [{ Last_Name, ...(First_Name ? { First_Name } : {}), Phone: lead.phoneE164, Lead_Source: lead.source, ...(lead.description ? { Description: lead.description } : {}) }],
    duplicate_check_fields: ["Phone"],
  };
}
export function zohoNoteBody(leadId: string, a: CrmActivity) {
  return { data: [{ Note_Title: a.title, Note_Content: a.body, Parent_Id: { module: { api_name: "Leads" }, id: leadId } }] };
}
export function zohoTaskBody(leadId: string, a: CrmActivity) {
  return {
    data: [{
      Subject: a.title, Description: a.body, Status: "Not Started",
      Priority: a.priority === "high" ? "High" : "Normal",
      ...(a.dueAt ? { Due_Date: a.dueAt.toISOString().slice(0, 10) } : {}),
      What_Id: { id: leadId }, $se_module: "Leads",
    }],
  };
}
export function zohoStage(stage: CrmStage): string {
  return { new: "Not Contacted", qualified: "Qualified", booked: "Qualified", paid: "Qualified" }[stage];
}

async function zohoFetch(conn: { apiDomain: string; accessToken: string }, path: string, body: unknown, method = "POST") {
  const res = await fetch(`${conn.apiDomain}/crm/v8/${path}`, {
    method, headers: { Authorization: `Zoho-oauthtoken ${conn.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: Array<{ code?: string; details?: { id?: string }; message?: string }> };
  const first = json.data?.[0];
  if (!res.ok || first?.code !== "SUCCESS") throw new Error(`zoho ${path}: HTTP ${res.status} ${first?.message ?? ""}`.trim());
  return first;
}

export const zohoProvider: CrmProvider = {
  key: "zoho",
  authUrl: ({ state, redirectUri, dc = "in" }) => {
    const q = new URLSearchParams({ scope: SCOPES, client_id: env.ZOHO_CLIENT_ID ?? "", response_type: "code", access_type: "offline", prompt: "consent", redirect_uri: redirectUri, state });
    return `https://accounts.zoho.${dc}/oauth/v2/auth?${q}`;
  },
  async exchangeCode({ code, redirectUri, meta }) {
    const accountsServer = meta["accounts-server"] ?? "https://accounts.zoho.in";
    const res = await fetch(`${accountsServer}/oauth/v2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: env.ZOHO_CLIENT_ID ?? "", client_secret: env.ZOHO_CLIENT_SECRET ?? "", redirect_uri: redirectUri, code }),
    });
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; api_domain?: string; expires_in?: number; error?: string };
    if (!j.access_token || !j.refresh_token || !j.api_domain) throw new Error(`zoho token: ${j.error ?? res.status}`);
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresInSecs: j.expires_in ?? 3600, apiDomain: j.api_domain, accountsServer, accountLabel: `Zoho CRM (${meta.location ?? "in"})` };
  },
  async refresh({ refreshToken, accountsServer }) {
    const res = await fetch(`${accountsServer}/oauth/v2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: env.ZOHO_CLIENT_ID ?? "", client_secret: env.ZOHO_CLIENT_SECRET ?? "", refresh_token: refreshToken }),
    });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-zoho.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/providers/zoho.ts tests/crm-zoho.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): Zoho CRM provider (OAuth, upsert lead, notes, tasks, stage)"
```

---

### Task 5: Salesforce provider

**Files:**
- Create: `src/modules/crm/providers/salesforce.ts`
- Test: `tests/crm-salesforce.test.ts`

**Interfaces:**
- Produces: `salesforceProvider: CrmProvider`; pure `sfLeadBody(lead: CrmLead)`, `sfTaskBody(leadId: string, a: CrmActivity)`, `sfStatus(stage: CrmStage): string`, `soqlByPhone(phone: string): string`.

Salesforce facts used: authorize `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=…&redirect_uri=…&scope=api refresh_token offline_access&state=…`; token `POST https://login.salesforce.com/services/oauth2/token` (`grant_type=authorization_code` / `refresh_token`) → `access_token`, `refresh_token`, `instance_url`; REST `GET {instance_url}/services/data/v62.0/query?q=…`, `POST …/sobjects/Lead`, `PATCH …/sobjects/Lead/{id}`, `POST …/sobjects/Task` (`WhoId` = Lead id). Access tokens have no `expires_in` — treat as 2 hours and refresh on 401.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-salesforce.test.ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SALESFORCE_CLIENT_ID: "cid", SALESFORCE_CLIENT_SECRET: "csec" } }));
import { salesforceProvider, sfLeadBody, sfStatus, sfTaskBody, soqlByPhone } from "@/modules/crm/providers/salesforce";

describe("salesforce builders", () => {
  it("builds lead, task, status, soql", () => {
    expect(sfLeadBody({ phoneE164: "+919876543210", name: "Priya Sharma", source: "WhatsApp (Nudge)", description: "d" }))
      .toEqual({ FirstName: "Priya", LastName: "Sharma", Phone: "+919876543210", Company: "Priya Sharma", LeadSource: "WhatsApp (Nudge)", Description: "d" });
    expect(sfTaskBody("00Q1", { kind: "task", title: "Appointment", body: "tomorrow 5pm", dueAt: new Date("2026-09-02T00:00:00Z"), priority: "high" }))
      .toEqual({ Subject: "Appointment", Description: "tomorrow 5pm", ActivityDate: "2026-09-02", Priority: "High", Status: "Not Started", WhoId: "00Q1" });
    expect(sfTaskBody("00Q1", { kind: "note", title: "Deposit", body: "paid" })).toMatchObject({ Status: "Completed", Priority: "Normal" });
    expect(sfStatus("qualified")).toBe("Working - Contacted");
    expect(soqlByPhone("+919876543210")).toBe("SELECT Id FROM Lead WHERE Phone = '+919876543210' LIMIT 1");
  });
  it("upsertLead queries by phone then creates", async () => {
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "00Q9", success: true }), { status: 201 }));
    const conn = { id: "c", orgId: "o", provider: "salesforce" as const, apiDomain: "https://acme.my.salesforce.com", accountsServer: "", accessToken: "tok" };
    expect(await salesforceProvider.upsertLead(conn, { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" })).toEqual({ externalId: "00Q9" });
    expect(String(spy.mock.calls[0][0])).toContain("/services/data/v62.0/query?q=");
    expect(String(spy.mock.calls[1][0])).toBe("https://acme.my.salesforce.com/services/data/v62.0/sobjects/Lead");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-salesforce.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/providers/salesforce.ts
import { env } from "@/lib/env";
import type { CrmActivity, CrmLead, CrmProvider, CrmStage } from "@/modules/crm/types";

const LOGIN = "https://login.salesforce.com";
const API = "/services/data/v62.0";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? { LastName: name.trim() || "Unknown" } : { FirstName: parts.slice(0, -1).join(" "), LastName: parts.at(-1)! };
}
export function sfLeadBody(lead: CrmLead) {
  return { ...splitName(lead.name), Phone: lead.phoneE164, Company: lead.name.trim() || "Unknown", LeadSource: lead.source, ...(lead.description ? { Description: lead.description } : {}) };
}
export function sfTaskBody(leadId: string, a: CrmActivity) {
  return {
    Subject: a.title, Description: a.body,
    ...(a.dueAt ? { ActivityDate: a.dueAt.toISOString().slice(0, 10) } : {}),
    Priority: a.priority === "high" ? "High" : "Normal",
    Status: a.kind === "note" ? "Completed" : "Not Started",
    WhoId: leadId,
  };
}
export function sfStatus(stage: CrmStage): string {
  return { new: "Open - Not Contacted", qualified: "Working - Contacted", booked: "Working - Contacted", paid: "Closed - Converted" }[stage];
}
export function soqlByPhone(phone: string): string {
  return `SELECT Id FROM Lead WHERE Phone = '${phone.replace(/'/g, "")}' LIMIT 1`;
}

async function sfFetch(conn: { apiDomain: string; accessToken: string }, path: string, init: RequestInit = {}) {
  const res = await fetch(`${conn.apiDomain}${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${conn.accessToken}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`salesforce ${path}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json as Record<string, unknown>;
}

export const salesforceProvider: CrmProvider = {
  key: "salesforce",
  authUrl: ({ state, redirectUri }) => {
    const q = new URLSearchParams({ response_type: "code", client_id: env.SALESFORCE_CLIENT_ID ?? "", redirect_uri: redirectUri, scope: "api refresh_token offline_access", state });
    return `${LOGIN}/services/oauth2/authorize?${q}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(`${LOGIN}/services/oauth2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: env.SALESFORCE_CLIENT_ID ?? "", client_secret: env.SALESFORCE_CLIENT_SECRET ?? "", redirect_uri: redirectUri, code }),
    });
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; instance_url?: string; error_description?: string };
    if (!j.access_token || !j.refresh_token || !j.instance_url) throw new Error(`salesforce token: ${j.error_description ?? res.status}`);
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresInSecs: 7200, apiDomain: j.instance_url, accountsServer: "", accountLabel: `Salesforce (${new URL(j.instance_url).hostname})` };
  },
  async refresh({ refreshToken }) {
    const res = await fetch(`${LOGIN}/services/oauth2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: env.SALESFORCE_CLIENT_ID ?? "", client_secret: env.SALESFORCE_CLIENT_SECRET ?? "", refresh_token: refreshToken }),
    });
    const j = (await res.json()) as { access_token?: string; error_description?: string };
    if (!j.access_token) throw new Error(`salesforce refresh: ${j.error_description ?? res.status}`);
    return { accessToken: j.access_token, expiresInSecs: 7200 };
  },
  async upsertLead(conn, lead) {
    const found = (await sfFetch(conn, `/query?q=${encodeURIComponent(soqlByPhone(lead.phoneE164))}`)) as { records?: Array<{ Id: string }> };
    if (found.records?.[0]?.Id) return { externalId: found.records[0].Id };
    const created = (await sfFetch(conn, "/sobjects/Lead", { method: "POST", body: JSON.stringify(sfLeadBody(lead)) })) as { id?: string };
    if (!created.id) throw new Error("salesforce lead create returned no id");
    return { externalId: created.id };
  },
  async updateStage(conn, externalId, stage) {
    await sfFetch(conn, `/sobjects/Lead/${externalId}`, { method: "PATCH", body: JSON.stringify({ Status: sfStatus(stage) }) });
  },
  async logActivity(conn, externalId, activity) {
    await sfFetch(conn, "/sobjects/Task", { method: "POST", body: JSON.stringify(sfTaskBody(externalId, activity)) });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-salesforce.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/providers/salesforce.ts tests/crm-salesforce.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): Salesforce provider (OAuth, find-or-create lead, tasks, status)"
```

---

### Task 6: Connections — store, refresh, resolve provider

**Files:**
- Create: `src/modules/crm/connections.ts`
- Create: `src/modules/crm/providers/index.ts`
- Test: `tests/crm-connections.test.ts`

**Interfaces:**
- Produces: `providerFor(key: CrmProviderKey, org: { simulated: boolean }): CrmProvider` (sim when simulated or provider keys missing); `saveConnection(orgId, key, tokens: CrmTokens, simulated: boolean)`; `withAccessToken(connId: string): Promise<ConnectionRow>` (decrypts, refreshes if `accessTokenExpiresAt` < now+60s, persists the new token); `disconnect(orgId, key)`; `listConnections(orgId)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-connections.test.ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "live", ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "s", TOKEN_ENCRYPTION_KEY: "k".repeat(40) } }));
const rows = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => { const row = { id: "cc1", ...create }; rows.set("cc1", row); return row; }),
      findUniqueOrThrow: vi.fn(async () => rows.get("cc1")),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { rows.set("cc1", { ...rows.get("cc1")!, ...data }); return rows.get("cc1"); }),
    },
  },
}));
const refresh = vi.hoisted(() => vi.fn(async () => ({ accessToken: "new-access", expiresInSecs: 3600 })));
vi.mock("@/modules/crm/providers/zoho", () => ({ zohoProvider: { key: "zoho", refresh } }));

import { providerFor, saveConnection, withAccessToken } from "@/modules/crm/connections";
import { simulationProvider } from "@/modules/crm/providers/simulation";

describe("connections", () => {
  it("uses the simulation provider for simulated orgs", () => {
    expect(providerFor("zoho", { simulated: true })).toBe(simulationProvider);
    expect(providerFor("salesforce", { simulated: false })).toBe(simulationProvider); // no SALESFORCE keys in env
    expect(providerFor("zoho", { simulated: false }).key).toBe("zoho");
  });
  it("stores tokens encrypted and refreshes an expired access token", async () => {
    await saveConnection("org1", "zoho", { accessToken: "old", refreshToken: "r", expiresInSecs: -10, apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accountLabel: "Zoho" }, false);
    const stored = rows.get("cc1")!;
    expect(String(stored.refreshTokenEncrypted)).not.toContain("r");
    const conn = await withAccessToken("cc1");
    expect(refresh).toHaveBeenCalledWith({ refreshToken: "r", accountsServer: "https://accounts.zoho.in" });
    expect(conn.accessToken).toBe("new-access");
    expect(conn.apiDomain).toBe("https://www.zohoapis.in");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-connections.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/providers/index.ts
import { env } from "@/lib/env";
import { salesforceProvider } from "@/modules/crm/providers/salesforce";
import { simulationProvider } from "@/modules/crm/providers/simulation";
import { zohoProvider } from "@/modules/crm/providers/zoho";
import type { CrmProvider, CrmProviderKey } from "@/modules/crm/types";

export function realProvider(key: CrmProviderKey): CrmProvider | null {
  if (key === "zoho" && env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET) return zohoProvider;
  if (key === "salesforce" && env.SALESFORCE_CLIENT_ID && env.SALESFORCE_CLIENT_SECRET) return salesforceProvider;
  return null;
}
```

```ts
// src/modules/crm/connections.ts
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { realProvider } from "@/modules/crm/providers";
import { simulationProvider } from "@/modules/crm/providers/simulation";
import type { ConnectionRow, CrmProvider, CrmProviderKey, CrmTokens } from "@/modules/crm/types";

const REFRESH_SKEW_MS = 60_000;

export function providerFor(key: CrmProviderKey, org: { simulated: boolean }): CrmProvider {
  if (env.SEND_MODE === "simulation" || org.simulated) return simulationProvider;
  return realProvider(key) ?? simulationProvider;
}

export async function saveConnection(orgId: string, key: CrmProviderKey, tokens: CrmTokens, simulated: boolean) {
  const data = {
    accountLabel: tokens.accountLabel, apiDomain: tokens.apiDomain, accountsServer: tokens.accountsServer,
    refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
    accessTokenEncrypted: encryptSecret(tokens.accessToken),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresInSecs * 1000),
    status: "connected", lastError: null, simulated,
  };
  return prisma.crmConnection.upsert({
    where: { orgId_provider: { orgId, provider: key } },
    create: { orgId, provider: key, ...data },
    update: data,
  });
}

/** Decrypt the connection and make sure the access token is fresh. */
export async function withAccessToken(connId: string): Promise<ConnectionRow> {
  const row = await prisma.crmConnection.findUniqueOrThrow({ where: { id: connId } });
  const key = row.provider as CrmProviderKey;
  const provider = realProvider(key);
  let accessToken = row.accessTokenEncrypted ? decryptSecret(row.accessTokenEncrypted) : "";
  const expired = !row.accessTokenExpiresAt || row.accessTokenExpiresAt.getTime() < Date.now() + REFRESH_SKEW_MS;
  if (provider && (expired || !accessToken)) {
    const fresh = await provider.refresh({ refreshToken: decryptSecret(row.refreshTokenEncrypted), accountsServer: row.accountsServer });
    accessToken = fresh.accessToken;
    await prisma.crmConnection.update({
      where: { id: row.id },
      data: { accessTokenEncrypted: encryptSecret(fresh.accessToken), accessTokenExpiresAt: new Date(Date.now() + fresh.expiresInSecs * 1000) },
    });
  }
  return { id: row.id, orgId: row.orgId, provider: key, apiDomain: row.apiDomain, accountsServer: row.accountsServer, accessToken };
}

export async function disconnect(orgId: string, key: CrmProviderKey) {
  await prisma.crmConnection.updateMany({ where: { orgId, provider: key }, data: { status: "disconnected" } });
}

export async function listConnections(orgId: string) {
  return prisma.crmConnection.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-connections.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/connections.ts src/modules/crm/providers/index.ts tests/crm-connections.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): encrypted connections with automatic token refresh"
```

---

### Task 7: Sync queue — enqueue + tick with retries

**Files:**
- Create: `src/modules/crm/sync.ts`
- Modify: `src/app/api/cron/process-queue/route.ts` (call `tickCrmSync()` after automations; add `crmSynced` to the JSON)
- Test: `tests/crm-sync.test.ts`

**Interfaces:**
- Consumes: `providerFor`, `withAccessToken`, `listConnections`.
- Produces: `enqueueCrmEvent(orgId: string, event: CrmEvent, entityId: string, payload: CrmPayload): Promise<void>` (no-op when the org has no connected CRM; one job per connected provider; unique per event+entity); `tickCrmSync(now?: Date): Promise<{ done: number; failed: number; dead: number }>`; pure `backoffMinutes(attempt: number): number` = `[1, 5, 30, 120, 480][attempt-1]`, dead after 5.
```ts
export type CrmPayload =
  | { kind: "lead"; lead: CrmLead }
  | { kind: "stage"; phoneE164: string; stage: CrmStage }
  | { kind: "activity"; phoneE164: string; activity: CrmActivity };
```
Lead resolution: every job carries `phoneE164`; the tick calls `upsertLead` first when it has no `externalId` for that contact yet (cached on the `contact.created` job's `externalId` — looked up by `{ orgId, provider, event: "contact.created", entityId: contactId }`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-sync.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation" } }));

const state = vi.hoisted(() => ({ jobs: [] as Record<string, unknown>[], connections: [{ id: "cc1", orgId: "org1", provider: "sim", status: "connected", simulated: true }] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: { findMany: vi.fn(async () => state.connections), findUniqueOrThrow: vi.fn(async () => state.connections[0]), update: vi.fn(async () => ({})) },
    org: { findUnique: vi.fn(async () => ({ id: "org1", simulated: true })) },
    crmSyncJob: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => { const j = { id: `j${state.jobs.length + 1}`, status: "pending", attempts: 0, externalId: null, ...create }; state.jobs.push(j); return j; }),
      findMany: vi.fn(async ({ where }: { where: { status: string } }) => state.jobs.filter((j) => j.status === where.status)),
      findFirst: vi.fn(async ({ where }: { where: { event: string; entityId: string } }) => state.jobs.find((j) => j.event === where.event && j.entityId === where.entityId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const j = state.jobs.find((x) => x.id === where.id)!; Object.assign(j, data); return j; }),
    },
  },
}));

import { backoffMinutes, enqueueCrmEvent, tickCrmSync } from "@/modules/crm/sync";

beforeEach(() => { state.jobs.length = 0; });

describe("backoffMinutes", () => {
  it("grows 1,5,30,120,480", () => expect([1, 2, 3, 4, 5].map(backoffMinutes)).toEqual([1, 5, 30, 120, 480]));
});

describe("enqueue + tick", () => {
  it("creates a lead job then an activity job and drains them", async () => {
    await enqueueCrmEvent("org1", "contact.created", "c1", { kind: "lead", lead: { phoneE164: "+919876543210", name: "Priya", source: "WhatsApp (Nudge)" } });
    await enqueueCrmEvent("org1", "booking.created", "b1", { kind: "activity", phoneE164: "+919876543210", activity: { kind: "task", title: "Appointment", body: "tomorrow 5pm" } });
    expect(state.jobs).toHaveLength(2);
    const r = await tickCrmSync(new Date());
    expect(r).toEqual({ done: 2, failed: 0, dead: 0 });
    expect(state.jobs.every((j) => j.status === "done")).toBe(true);
    expect(state.jobs[0].externalId).toBe("sim_lead_919876543210");
  });
  it("is a no-op for orgs without a CRM", async () => {
    state.connections = [];
    await enqueueCrmEvent("org2", "contact.created", "c9", { kind: "lead", lead: { phoneE164: "+91", name: "x", source: "s" } });
    expect(state.jobs).toHaveLength(0);
    state.connections = [{ id: "cc1", orgId: "org1", provider: "sim", status: "connected", simulated: true }];
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-sync.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/sync.ts
import { prisma } from "@/lib/db";
import { listConnections, providerFor, withAccessToken } from "@/modules/crm/connections";
import type { ConnectionRow, CrmActivity, CrmEvent, CrmLead, CrmProviderKey, CrmStage } from "@/modules/crm/types";

export type CrmPayload =
  | { kind: "lead"; lead: CrmLead }
  | { kind: "stage"; phoneE164: string; stage: CrmStage }
  | { kind: "activity"; phoneE164: string; activity: CrmActivity };

const BACKOFF = [1, 5, 30, 120, 480];
export function backoffMinutes(attempt: number): number {
  return BACKOFF[Math.min(Math.max(attempt, 1), BACKOFF.length) - 1];
}

export async function enqueueCrmEvent(orgId: string, event: CrmEvent, entityId: string, payload: CrmPayload): Promise<void> {
  const connections = (await listConnections(orgId)).filter((c) => c.status === "connected");
  for (const c of connections) {
    await prisma.crmSyncJob.upsert({
      where: { orgId_provider_event_entityId: { orgId, provider: c.provider, event, entityId } },
      create: { orgId, provider: c.provider, event, entityId, payload },
      update: {},
    });
  }
}

async function leadIdFor(orgId: string, provider: string, phoneE164: string, conn: ConnectionRow, org: { simulated: boolean }, fallback: CrmLead): Promise<string> {
  const contactJob = await prisma.crmSyncJob.findFirst({ where: { orgId, provider, event: "contact.created", status: "done", payload: { path: ["lead", "phoneE164"], equals: phoneE164 } } });
  if (contactJob?.externalId) return contactJob.externalId;
  const p = providerFor(provider as CrmProviderKey, org);
  return (await p.upsertLead(conn, fallback)).externalId;
}

export async function tickCrmSync(now: Date = new Date()): Promise<{ done: number; failed: number; dead: number }> {
  const result = { done: 0, failed: 0, dead: 0 };
  const jobs = await prisma.crmSyncJob.findMany({ where: { status: "pending", nextRunAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: 100 });
  const seen = new Set<string>(); // one in-flight job per connection per tick
  for (const job of jobs) {
    const lane = `${job.orgId}:${job.provider}`;
    if (seen.has(lane)) continue;
    seen.add(lane);
    try {
      const org = await prisma.org.findUnique({ where: { id: job.orgId }, select: { id: true, simulated: true } });
      if (!org) throw new Error("org missing");
      const connRow = (await listConnections(job.orgId)).find((c) => c.provider === job.provider && c.status === "connected");
      if (!connRow) throw new Error("connection missing");
      const conn: ConnectionRow = org.simulated || connRow.simulated
        ? { id: connRow.id, orgId: job.orgId, provider: job.provider as CrmProviderKey, apiDomain: "", accountsServer: "", accessToken: "" }
        : await withAccessToken(connRow.id);
      const provider = providerFor(job.provider as CrmProviderKey, org);
      const payload = job.payload as CrmPayload;
      let externalId: string | null = null;
      if (payload.kind === "lead") {
        externalId = (await provider.upsertLead(conn, payload.lead)).externalId;
      } else {
        const fallback: CrmLead = { phoneE164: payload.phoneE164, name: payload.phoneE164, source: "WhatsApp (Nudge)" };
        externalId = await leadIdFor(job.orgId, job.provider, payload.phoneE164, conn, org, fallback);
        if (payload.kind === "stage") await provider.updateStage(conn, externalId, payload.stage);
        else await provider.logActivity(conn, externalId, payload.activity);
      }
      await prisma.crmSyncJob.update({ where: { id: job.id }, data: { status: "done", externalId, error: null, attempts: job.attempts + 1 } });
      await prisma.crmConnection.update({ where: { id: connRow.id }, data: { lastSyncAt: now, lastError: null } });
      result.done += 1;
    } catch (e) {
      const attempts = job.attempts + 1;
      const dead = attempts >= BACKOFF.length;
      await prisma.crmSyncJob.update({
        where: { id: job.id },
        data: { attempts, error: (e as Error).message.slice(0, 500), status: dead ? "dead" : "pending", nextRunAt: new Date(now.getTime() + backoffMinutes(attempts) * 60_000) },
      });
      if (dead) result.dead += 1; else result.failed += 1;
    }
  }
  return result;
}
```
Cron: in `src/app/api/cron/process-queue/route.ts` after `tickAutomationRuns()` add `const crmSynced = await tickCrmSync();` (import from `@/modules/crm/sync`) and return it in the JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-sync.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/sync.ts src/app/api/cron/process-queue/route.ts tests/crm-sync.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): sync queue with per-connection lanes and backoff, drained by the cron tick"
```

---

### Task 8: Event hooks in product code

**Files:**
- Create: `src/modules/crm/events.ts`
- Modify: `src/modules/agent/inbound.ts` (after the contact upsert — only when `contact` was just created)
- Modify: `src/modules/agent/tools/capture-booking.ts` (after the `BookingRequest` is created)
- Modify: `src/modules/agent/tools/capture-lead.ts` (after `leadStage` becomes `QUALIFIED`)
- Modify: `src/modules/agent/tools/handoff.ts` (after the conversation flips to `handoff`)
- Modify: `src/modules/payments/index.ts:177` (where `status: "paid"` is written)
- Modify: `src/modules/voice/file-call.ts` (after a call is filed — source "Phone (Nudge)")
- Test: `tests/crm-events.test.ts`

**Interfaces:**
- Produces thin helpers (each `void`-called, never throws, never blocks the caller):
```ts
export function crmContactCreated(orgId: string, contact: { id: string; phoneE164: string; name: string }, source: "WhatsApp (Nudge)" | "Phone (Nudge)", description?: string): Promise<void>;
export function crmLeadQualified(orgId: string, contact: { id: string; phoneE164: string }): Promise<void>;
export function crmBookingCreated(orgId: string, booking: { id: string; name: string; requestedFor: string; scheduledFor: Date | null }, contact: { phoneE164: string }): Promise<void>;
export function crmPaymentPaid(orgId: string, payment: { id: string; amountMinorUnits: number; currency: string; purpose: string }, contact: { phoneE164: string }): Promise<void>;
export function crmHandoffRequested(orgId: string, conversationId: string, contact: { phoneE164: string }, reason: string): Promise<void>;
export function crmConversationSummary(orgId: string, conversationId: string, contact: { phoneE164: string }, summary: string): Promise<void>;
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-events.test.ts
import { describe, expect, it, vi } from "vitest";
const enqueueCrmEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/modules/crm/sync", () => ({ enqueueCrmEvent }));
import { crmBookingCreated, crmContactCreated, crmHandoffRequested, crmLeadQualified, crmPaymentPaid } from "@/modules/crm/events";

describe("crm events", () => {
  it("maps product events to queue payloads", async () => {
    await crmContactCreated("o", { id: "c1", phoneE164: "+91", name: "+91" }, "WhatsApp (Nudge)", "Ad: PRP");
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "contact.created", "c1", { kind: "lead", lead: { phoneE164: "+91", name: "+91", source: "WhatsApp (Nudge)", description: "Ad: PRP" } });
    await crmLeadQualified("o", { id: "c1", phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "lead.qualified", "c1", { kind: "stage", phoneE164: "+91", stage: "qualified" });
    await crmBookingCreated("o", { id: "b1", name: "Priya", requestedFor: "tomorrow 5pm", scheduledFor: new Date("2026-09-02T11:30:00Z") }, { phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "booking.created", "b1", { kind: "activity", phoneE164: "+91", activity: { kind: "task", title: "Appointment: Priya — tomorrow 5pm", body: "Booked via Nudge.", dueAt: new Date("2026-09-02T11:30:00Z"), priority: "normal" } });
    await crmPaymentPaid("o", { id: "p1", amountMinorUnits: 50000, currency: "INR", purpose: "deposit" }, { phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "payment.paid", "p1", { kind: "activity", phoneE164: "+91", activity: { kind: "note", title: "Payment received", body: "INR 500.00 — deposit (via Nudge)" } });
    await crmHandoffRequested("o", "cv1", { phoneE164: "+91" }, "wants a human");
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "handoff.requested", "cv1", { kind: "activity", phoneE164: "+91", activity: { kind: "task", title: "Customer asked for a person", body: "wants a human", priority: "high" } });
  });
  it("never throws when the queue fails", async () => {
    enqueueCrmEvent.mockRejectedValueOnce(new Error("db down"));
    await expect(crmLeadQualified("o", { id: "c", phoneE164: "+91" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-events.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/crm/events.ts
import { enqueueCrmEvent, type CrmPayload } from "@/modules/crm/sync";
import type { CrmEvent } from "@/modules/crm/types";

async function safe(orgId: string, event: CrmEvent, entityId: string, payload: CrmPayload): Promise<void> {
  try { await enqueueCrmEvent(orgId, event, entityId, payload); }
  catch (e) { console.warn(`[crm] enqueue ${event} failed: ${(e as Error).message}`); }
}

export function crmContactCreated(orgId: string, contact: { id: string; phoneE164: string; name: string }, source: "WhatsApp (Nudge)" | "Phone (Nudge)", description?: string) {
  return safe(orgId, "contact.created", contact.id, { kind: "lead", lead: { phoneE164: contact.phoneE164, name: contact.name, source, ...(description ? { description } : {}) } });
}
export function crmLeadQualified(orgId: string, contact: { id: string; phoneE164: string }) {
  return safe(orgId, "lead.qualified", contact.id, { kind: "stage", phoneE164: contact.phoneE164, stage: "qualified" });
}
export function crmBookingCreated(orgId: string, booking: { id: string; name: string; requestedFor: string; scheduledFor: Date | null }, contact: { phoneE164: string }) {
  return safe(orgId, "booking.created", booking.id, {
    kind: "activity", phoneE164: contact.phoneE164,
    activity: { kind: "task", title: `Appointment: ${booking.name} — ${booking.requestedFor}`, body: "Booked via Nudge.", ...(booking.scheduledFor ? { dueAt: booking.scheduledFor } : {}), priority: "normal" },
  });
}
export function crmPaymentPaid(orgId: string, payment: { id: string; amountMinorUnits: number; currency: string; purpose: string }, contact: { phoneE164: string }) {
  const amount = (payment.amountMinorUnits / 100).toFixed(2);
  return safe(orgId, "payment.paid", payment.id, { kind: "activity", phoneE164: contact.phoneE164, activity: { kind: "note", title: "Payment received", body: `${payment.currency} ${amount} — ${payment.purpose} (via Nudge)` } });
}
export function crmHandoffRequested(orgId: string, conversationId: string, contact: { phoneE164: string }, reason: string) {
  return safe(orgId, "handoff.requested", conversationId, { kind: "activity", phoneE164: contact.phoneE164, activity: { kind: "task", title: "Customer asked for a person", body: reason, priority: "high" } });
}
export function crmConversationSummary(orgId: string, conversationId: string, contact: { phoneE164: string }, summary: string) {
  return safe(orgId, "conversation.summary", `${conversationId}:${new Date().toISOString().slice(0, 10)}`, { kind: "activity", phoneE164: contact.phoneE164, activity: { kind: "note", title: "Conversation summary", body: summary } });
}
```
Wiring (each a single `void crm…(…)` line, placed right after the write it describes):
- `agent/inbound.ts`: change the contact `upsert` to detect creation — replace `update: {}` with `update: { updatedAt: new Date() }` is NOT enough to know; instead do `const existing = await prisma.contact.findUnique({ where: { orgId_phoneE164: { orgId, phoneE164 } } })` before the upsert and after it: `if (!existing) void crmContactCreated(orgId, contact, "WhatsApp (Nudge)");`
- `capture-booking.ts`: after `prisma.bookingRequest.create(...)` → `void crmBookingCreated(ctx.orgId, booking, { phoneE164: ctx.contactPhone });`
- `capture-lead.ts`: after the `leadStage: "QUALIFIED"` update → `void crmLeadQualified(ctx.orgId, { id: ctx.contactId, phoneE164: ctx.contactPhone });`
- `handoff.ts`: after the conversation status update → `void crmHandoffRequested(ctx.orgId, ctx.conversationId, { phoneE164: ctx.contactPhone }, input.reason ?? "asked for a person");`
- `payments/index.ts` where `status: "paid"` is set: load the payment's contact phone and → `void crmPaymentPaid(orgId, { id, amountMinorUnits, currency, purpose }, { phoneE164 });`
- `voice/file-call.ts`: when the contact was created by the call → `void crmContactCreated(orgId, contact, "Phone (Nudge)");`

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/crm-events.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; whole suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm/events.ts src/modules/agent src/modules/payments/index.ts src/modules/voice/file-call.ts tests/crm-events.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): product events enqueue CRM sync (contact, qualified, booking, payment, handoff)"
```

---

### Task 9: OAuth routes

**Files:**
- Create: `src/app/api/integrations/crm/[provider]/start/route.ts`
- Create: `src/app/api/integrations/crm/[provider]/callback/route.ts`
- Test: `tests/crm-oauth-routes.test.ts`

**Interfaces:**
- Consumes: `signState`, `verifyState`, `providerFor`, `saveConnection`, `requireOrgContext`.
- Produces: `GET /api/integrations/crm/{zoho|salesforce}/start` → 302 to the provider (or, for simulated orgs, straight to the callback with `code=sim`); `GET …/callback?code&state[&location&accounts-server]` → stores the connection and 302s to `/integrations?crm=connected`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-oauth-routes.test.ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "live", TOKEN_ENCRYPTION_KEY: "k".repeat(40), NEXT_PUBLIC_APP_URL: "https://nudgeagent.app", ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "s" } }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext: vi.fn(async () => ({ org: { id: "org1", simulated: false }, role: "OWNER", userId: "u", email: "e" })), requireRole: vi.fn() }));
const saveConnection = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/modules/crm/connections", async (orig) => ({ ...(await orig<typeof import("@/modules/crm/connections")>()), saveConnection }));
vi.mock("@/modules/crm/providers/zoho", () => ({
  zohoProvider: { key: "zoho", authUrl: () => "https://accounts.zoho.in/oauth/v2/auth?x=1", exchangeCode: vi.fn(async () => ({ accessToken: "a", refreshToken: "r", expiresInSecs: 3600, apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accountLabel: "Zoho" })) },
}));

import { GET as start } from "@/app/api/integrations/crm/[provider]/start/route";
import { GET as callback } from "@/app/api/integrations/crm/[provider]/callback/route";
import { signState } from "@/modules/crm/oauth-state";

describe("crm oauth routes", () => {
  it("start redirects to the provider", async () => {
    const res = await start(new Request("http://localhost/api/integrations/crm/zoho/start"), { params: Promise.resolve({ provider: "zoho" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("accounts.zoho.in");
  });
  it("callback verifies state, exchanges the code and stores the connection", async () => {
    const state = signState("org1", "zoho", "k".repeat(40));
    const res = await callback(new Request(`http://localhost/api/integrations/crm/zoho/callback?code=abc&state=${state}&location=in&accounts-server=https%3A%2F%2Faccounts.zoho.in`), { params: Promise.resolve({ provider: "zoho" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/integrations?crm=connected");
    expect(saveConnection).toHaveBeenCalledWith("org1", "zoho", expect.objectContaining({ apiDomain: "https://www.zohoapis.in" }), false);
  });
  it("callback rejects a forged state", async () => {
    const res = await callback(new Request("http://localhost/api/integrations/crm/zoho/callback?code=abc&state=bad"), { params: Promise.resolve({ provider: "zoho" }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-oauth-routes.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement**

```ts
// src/app/api/integrations/crm/[provider]/start/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { providerFor } from "@/modules/crm/connections";
import { signState } from "@/modules/crm/oauth-state";
import type { CrmProviderKey } from "@/modules/crm/types";

const KEYS: CrmProviderKey[] = ["zoho", "salesforce"];

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!KEYS.includes(provider as CrmProviderKey)) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const org = ctx.org;
  const base = env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${base}/api/integrations/crm/${provider}/callback`;
  const state = signState(org.id, provider as CrmProviderKey, env.TOKEN_ENCRYPTION_KEY ?? "");
  const dc = new URL(request.url).searchParams.get("dc") ?? "in";
  const url = providerFor(provider as CrmProviderKey, org).authUrl({ state, redirectUri, dc });
  return NextResponse.redirect(url, 307);
}
```

```ts
// src/app/api/integrations/crm/[provider]/callback/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { providerFor, saveConnection } from "@/modules/crm/connections";
import { verifyState } from "@/modules/crm/oauth-state";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const verified = verifyState(state, env.TOKEN_ENCRYPTION_KEY ?? "");
  if (!code || !verified || verified.provider !== provider) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }
  const org = await prisma.org.findUnique({ where: { id: verified.orgId }, select: { id: true, simulated: true } });
  if (!org) return NextResponse.json({ error: "org missing" }, { status: 404 });
  const base = env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const meta: Record<string, string> = {};
  for (const [k, v] of url.searchParams) meta[k] = v;
  const p = providerFor(verified.provider, org);
  try {
    const tokens = await p.exchangeCode({ code, redirectUri: `${base}/api/integrations/crm/${provider}/callback`, meta });
    await saveConnection(org.id, verified.provider, tokens, p.key === "sim");
    return NextResponse.redirect(`${base}/integrations?crm=connected`, 307);
  } catch (e) {
    return NextResponse.redirect(`${base}/integrations?crm=error&reason=${encodeURIComponent((e as Error).message.slice(0, 120))}`, 307);
  }
}
```
Add `/api/integrations/crm` to the proxy `PUBLIC_PATHS` only for the **callback** path (the provider redirects the browser there; the browser still carries the Supabase session, so the start route stays protected). Follow the pattern already used for `/api/integrations/google/callback`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crm-oauth-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/integrations/crm" src/lib/supabase/proxy-session.ts tests/crm-oauth-routes.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): OAuth start/callback routes (Zoho DC-aware, Salesforce)"
```
Note the skip-worktree rule for `proxy-session.ts` (memory: back up, clear flag, strip the dev-bypass hunk, commit, restore, re-flag).

---

### Task 10: Integrations UI — CRM card + sync log

**Files:**
- Modify: `src/app/(app)/integrations/page.tsx` (add the card below API keys / webhooks)
- Create: `src/app/(app)/integrations/crm-card.tsx`
- Create: `src/app/(app)/integrations/crm-actions.ts` (`disconnectCrm(provider)`, `syncNow()` → runs `tickCrmSync()` for this org only)
- Test: `tests/crm-card-model.test.ts`

**Interfaces:**
- Produces pure `crmCardModel(connections, jobs, simulated)` → `{ providers: Array<{ key, label, connected, accountLabel, lastSyncAt, lastError }>, recent: Array<{ event, status, when, error }> , pendingCount }` used by the card.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crm-card-model.test.ts
import { describe, expect, it } from "vitest";
import { crmCardModel } from "@/app/(app)/integrations/crm-card-model";

describe("crmCardModel", () => {
  it("lists both providers with connection state and recent jobs", () => {
    const m = crmCardModel(
      [{ provider: "zoho", status: "connected", accountLabel: "Zoho CRM (in)", lastSyncAt: new Date("2026-09-01T00:00:00Z"), lastError: null }],
      [{ event: "contact.created", status: "done", updatedAt: new Date("2026-09-01T00:00:00Z"), error: null }, { event: "booking.created", status: "pending", updatedAt: new Date(), error: null }],
      false
    );
    expect(m.providers.map((p) => [p.key, p.connected])).toEqual([["zoho", true], ["salesforce", false]]);
    expect(m.pendingCount).toBe(1);
    expect(m.recent[0].event).toBe("contact.created");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crm-card-model.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/app/(app)/integrations/crm-card-model.ts
export const CRM_PROVIDERS = [
  { key: "zoho", label: "Zoho CRM" },
  { key: "salesforce", label: "Salesforce" },
] as const;

export function crmCardModel(
  connections: Array<{ provider: string; status: string; accountLabel: string; lastSyncAt: Date | null; lastError: string | null }>,
  jobs: Array<{ event: string; status: string; updatedAt: Date; error: string | null }>,
  simulated: boolean
) {
  return {
    simulated,
    providers: CRM_PROVIDERS.map((p) => {
      const c = connections.find((x) => x.provider === p.key && x.status === "connected");
      return { key: p.key, label: p.label, connected: !!c, accountLabel: c?.accountLabel ?? "", lastSyncAt: c?.lastSyncAt ?? null, lastError: c?.lastError ?? null };
    }),
    recent: jobs.slice(0, 10).map((j) => ({ event: j.event, status: j.status, when: j.updatedAt, error: j.error })),
    pendingCount: jobs.filter((j) => j.status === "pending").length,
  };
}
```
`crm-card.tsx`: a `Card` (same primitive the API-keys card uses) titled **CRM** with one row per provider: label, `Badge` (Connected / Not connected), account label + "last sync 3m ago" (`formatRelativeTime`), buttons: `<a href="/api/integrations/crm/zoho/start">Connect</a>` (Zoho gets a small DC select `in|us|eu` → `?dc=`), **Sync now**, **Disconnect** (form actions). Below: a 10-row table of recent jobs (event · status pill · when · error). In test mode show the info banner "Test mode — connections are simulated; jobs still flow so you can see what will be written."

`page.tsx`: load `listConnections(org.id)`, `prisma.crmSyncJob.findMany({ where: { orgId }, orderBy: { updatedAt: "desc" }, take: 10 })`, `isSimulated(org)` → `<CrmCard model={crmCardModel(...)} />`.

- [ ] **Step 4: Run tests + gates**

Run: `npx vitest run tests/crm-card-model.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/integrations" tests/crm-card-model.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): Integrations → CRM card with connect, sync now, disconnect and sync log"
```

---

### Task 11: Live verification script, docs, gates

**Files:**
- Create: `scripts/crm-live.ts` (simulation): connects the sim provider for the first org, fires the five events through `handleInboundMessage` + tools, runs `tickCrmSync`, asserts every job `done` with a `sim_` external id, then deletes the jobs and connection it created.
- Create: `docs/CRM_INTEGRATIONS.md`: what syncs (table from spec §B1), Zoho API console setup, Salesforce Connected App setup, env vars, DC note, test-mode behaviour, retry policy, how to read the sync log.
- Modify: `PROGRESS.md` (entry at top), `.env.example` (already done in Task 1 — verify).

- [ ] **Step 1: Write the script**

```ts
// scripts/crm-live.ts — run like phase7-live: bundle with esbuild, PROJECT_ROOT=$PWD node .next/crm-live.cjs
import fs from "node:fs";
import path from "node:path";
const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.SEND_MODE = "simulation";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { saveConnection } = await import("@/modules/crm/connections");
  const { tickCrmSync } = await import("@/modules/crm/sync");
  const { handleInboundMessage } = await import("@/modules/agent/inbound");
  const prisma = new PrismaClient();
  const org = await prisma.org.findFirstOrThrow();
  await saveConnection(org.id, "sim", { accessToken: "sim", refreshToken: "sim", expiresInSecs: 3600, apiDomain: "", accountsServer: "", accountLabel: "Simulated CRM" }, true);
  const phone = "+919810009777";
  await prisma.contact.deleteMany({ where: { orgId: org.id, phoneE164: phone } });
  await handleInboundMessage(org.id, phone, "I'd like to book a table for 4 tomorrow at 8pm, under Rahul. Yes please book it.");
  const r = await tickCrmSync();
  const jobs = await prisma.crmSyncJob.findMany({ where: { orgId: org.id, provider: "sim" } });
  console.log("tick:", r, "jobs:", jobs.map((j) => `${j.event}=${j.status}:${j.externalId}`));
  const ok = jobs.length >= 1 && jobs.every((j) => j.status === "done" && j.externalId?.startsWith("sim_"));
  console.log(ok ? "✅ CRM sync verified in simulation" : "❌ CRM sync failed");
  await prisma.crmSyncJob.deleteMany({ where: { orgId: org.id, provider: "sim" } });
  await prisma.crmConnection.deleteMany({ where: { orgId: org.id, provider: "sim" } });
  await prisma.contact.deleteMany({ where: { orgId: org.id, phoneE164: phone } });
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it + full gates**

Run:
```bash
npx esbuild scripts/crm-live.ts --bundle --platform=node --format=cjs --outfile=.next/crm-live.cjs --external:@prisma/client --external:@anthropic-ai/sdk && PROJECT_ROOT=$PWD node .next/crm-live.cjs
npx vitest run && npm run lint && npx tsc --noEmit && npm run build
```
Expected: `✅ CRM sync verified in simulation`; all gates green.

- [ ] **Step 3: Docs + commit + push**

```bash
git add scripts/crm-live.ts docs/CRM_INTEGRATIONS.md PROGRESS.md
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(crm): live verification script + CRM_INTEGRATIONS.md"
git pull --rebase origin main && git push origin main
```

---

## Self-review notes
- Spec §B1 table → Task 8 hooks + Task 4/5 builders (`zohoTaskBody`/`sfTaskBody` for bookings and hand-offs, notes for payments and summaries, `updateStage` for QUALIFIED). Conversation summaries are wired by `crmConversationSummary` and will be called by the copilot/summaries workstream when it lands.
- Spec §B2: provider interface (Task 2), encrypted connections + refresh (Task 6), queue + lanes + backoff (Task 7), OAuth state (Task 3), routes (Task 9), UI (Task 10), simulation (Task 2/6/7).
- HubSpot deliberately absent (spec: only if a client asks); adding it is one more `providers/hubspot.ts` implementing `CrmProvider`.
- Names used consistently: `CrmProvider`, `ConnectionRow`, `CrmTokens`, `providerFor`, `saveConnection`, `withAccessToken`, `enqueueCrmEvent`, `tickCrmSync`, `backoffMinutes`, `crmCardModel`.
