# CRM integrations — Zoho CRM and Salesforce

One-way sync: what the AI Front Desk does lands in the client's CRM. The CRM
stays the system of record for the client's team; Nudge never reads it back.
Design: `docs/superpowers/specs/2026-08-29-voice-and-crm-design.md` (Part B).

## What syncs

| Nudge event | Zoho CRM | Salesforce |
|---|---|---|
| New contact from an inbound WhatsApp message or phone call | `Leads/upsert` on `Phone` (`Lead_Source` = "WhatsApp (Nudge)" / "Phone (Nudge)") | find `Lead` by `Phone`, else create (`LeadSource`) |
| Lead marked QUALIFIED by the agent | `Lead_Status` = Qualified | `Status` = Working - Contacted |
| Booking captured | Task "Appointment: name — when" (+ due date) | Task (Not Started, `ActivityDate`) |
| Payment paid | Note "Payment received" | Task (Completed) |
| Hand-off requested | Task, High priority | Task, High priority |
| Conversation summary (copilot workstream) | Note | Task (Completed) |

## How it works
- Product code enqueues (`modules/crm/events.ts` → `CrmSyncJob`), never calls a
  CRM directly. Idempotent per (org, provider, event, entity).
- The cron tick (`tickCrmSync`) drains jobs: one in-flight job per connection
  per tick, backoff 1 → 5 → 30 → 120 → 480 minutes, then `dead`. The
  Integrations page shows the last ten jobs and a **Sync now** button.
- Tokens are AES-256-GCM encrypted at rest; access tokens refresh just in time.
- Test mode (no keys, or a simulated org) uses the simulation provider: jobs
  complete with `sim_…` ids so the sync log looks real.

## Setup — Zoho CRM
1. https://api-console.zoho.in → **Server-based Applications** → client name
   "Nudge", homepage `https://nudgeagent.app`, redirect
   `https://nudgeagent.app/api/integrations/crm/zoho/callback`.
2. Vercel: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`. Redeploy.
3. Client: Integrations → CRM → **Connect Zoho CRM** (data centre `in`; use
   `?dc=us|eu` in the connect link for other regions) → consent → back to
   Integrations with "connected". Scopes requested:
   `ZohoCRM.modules.leads.ALL, ZohoCRM.modules.notes.ALL, ZohoCRM.modules.tasks.ALL`.

## Setup — Salesforce
1. A Salesforce org → Setup → App Manager → **New Connected App** → enable
   OAuth, callback `https://nudgeagent.app/api/integrations/crm/salesforce/callback`,
   scopes `api`, `refresh_token, offline_access`.
2. Vercel: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`. Redeploy.
3. Client: Integrations → CRM → **Connect Salesforce**.

## Reading the sync log
Integrations → CRM shows the provider status (account, last sync, last error)
and the last ten jobs (event · status · when · error). `dead` jobs stayed
failing after five attempts — fix the cause (usually a revoked token; reconnect)
and click **Sync now**.

## Verify locally
`scripts/crm-live.ts` (command in the file header) runs the whole loop in
simulation against the first org and cleans up after itself.
