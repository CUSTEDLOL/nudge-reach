# Voice Front Desk + CRM Integrations — design

**Date:** 2026-08-29 · **Status:** PROPOSED (founder review) · **Roadmap:** `docs/ROADMAP.md` #5 (CRMs) and #6 (voice) ·
**Builds on:** `src/modules/agent` (tools, knowledge digest, prompt), `src/modules/followup` (reminders), `src/modules/calendar`,
`src/modules/integrations` (api keys, outbound webhooks), per-org test mode (`modules/orgs/mode`).

Two workstreams, two plans:
- `docs/superpowers/plans/2026-08-29-voice-front-desk.md`
- `docs/superpowers/plans/2026-08-29-crm-integrations.md`

---

## Part A — Voice: the employee picks up the phone

### A1. The decision: buy the mouth and ears, keep the hands (and later the brain)

| Option | What it is | Verdict |
|---|---|---|
| **Build our own pipeline** (Twilio/Exotel media streams → STT → our LLM → TTS) | Full control; we own turn-taking, barge-in, endpointing, echo, jitter, latency budgets | **No for v1.** That is 2–3 extra weeks plus permanent tuning of problems the vendors have spent years on, and none of it is a moat. Keep the driver interface so it can be swapped later. |
| **Vapi / Retell** (managed voice-agent platforms) | Orchestration + telephony; bring any LLM/TTS; ~$0.05–0.055/min platform + components; Retell has native SIP | Good, but voice quality and Indian-language tuning come from a third vendor anyway. Second choice. |
| **ElevenLabs Agents** (managed) | Orchestration + best-in-class TTS/ASR, **Hindi + `hinglish_mode`, tuned for noisy Indian calls**; SIP trunking (`sip.rtc.elevenlabs.io:5060`, TLS/SRTP) and native Twilio; inbound **conversation-initiation webhook** (per-call prompt/voice/language override + dynamic variables); **webhook tools** that call our API; **post-call transcription webhook** (HMAC-signed, transcript + summary); **custom LLM** option (OpenAI-compatible SSE endpoint with tool calling). ~$0.08–0.12/min + LLM passthrough. | **Yes — v1.** Everything we need is a webhook into code we already have. |
| **WhatsApp Business Calling API** (calls over WhatsApp itself) | WebRTC/SIP via Meta; customer-initiated calls free; business-initiated per 6-second pulse | **Not available to us yet**: requires a messaging tier of ≥2,000 business-initiated conversations/24 h plus eligibility. Phase 2 — the same brain and tools plug in. |

**Where the brain lives — v1 vs v2.**
- **v1 (this plan): ElevenLabs runs the conversation loop with a Claude model pinned in its config**
  (cheapest Sonnet/Haiku-class it offers; never GPT-4-class or Opus). We inject the business's
  knowledge digest, tone, hours and booking rules per call through the initiation webhook, and
  every *action* (booking, lead, ask-owner, hand-off/transfer, payment link) is a webhook tool that
  hits our API and runs the **same tool handlers** the WhatsApp agent uses. Latency stays
  sub-second (their loop, no cross-Pacific tool round-trips inside the LLM turn).
  Invariant 3 note: the LLM call executes at ElevenLabs, not through `lib/model-router`; the
  model is pinned by env (`ELEVENLABS_LLM`) and the guard's forbidden list is applied to that value
  at setup. Cost stays in the Haiku/Sonnet band.
- **v2: custom LLM endpoint** — `POST /api/voice/llm/v1/chat/completions` streaming SSE, backed by
  `runAgent` on the router with buffer-words for latency. One brain, one eval harness. Do this once
  v1 has real calls and we have measured what latency clinics tolerate.

### A2. Telephony

| Market | Carrier | How it connects |
|---|---|---|
| India | **Exotel vSIP** (UL-VNO licensed; TRAI-compliant numbers; KYC per city; enable trunking via hello@exotel.com) | Exotel DID → SIP INVITE (TLS) → `sip.rtc.elevenlabs.io:5060`; outbound from ElevenLabs → Exotel trunk. ~₹0.3–0.5/min inbound, ~₹0.8–1.0/min outbound. |
| Singapore / Malaysia / UAE | **Twilio** (native ElevenLabs integration) | Twilio number assigned to the agent in the ElevenLabs dashboard; outbound via the same integration. |
| Simulation | none | `drivers/simulation.ts` plays a scripted call so `/demo` and test-mode orgs work with zero keys. |

**India compliance:** inbound answering is unrestricted; outbound *reminder/no-show* calls are
transactional (allowed) but must skip contacts with `optedOutAt` and should be sent inside the
business's hours; promotional outbound calls to DND numbers are prohibited — we never make them.

### A3. How a call flows

**Inbound** — customer dials the clinic's number → carrier → ElevenLabs → `POST /api/voice/initiation`
(`caller_id`, `called_number`, `agent_id`, `conversation_id`) → we resolve `called_number` → `VoiceNumber` → org →
build the per-call config (`dynamic_variables` = org_id, contact phone/name, today's date; `conversation_config_override`
= system prompt from `buildSystemPrompt` + knowledge digest, `first_message`, `language`, `tts.voice_id`) → agent talks →
tools call `POST /api/voice/tools/{name}` with a bearer secret → after hang-up `POST /api/voice/post-call`
(HMAC `elevenlabs-signature`) → we file the call: contact upsert, `Conversation` with `channel = "voice"`, one
`ConversationMessage` per turn, a `VoiceCall` row (duration, summary, outcome), `call.completed` outbound webhook, CRM sync event.

**Outbound** — the follow-up tick finds bookings due in the T-2h window for orgs with voice reminders on →
`POST /v1/convai/sip-trunk/outbound-call` (`agent_id`, `agent_phone_number_id`, `to_number`,
`conversation_initiation_client_data`) → same post-call filing. No-show recovery calls run the same way the day after
a `no_show` booking.

**Hand-off** — the agent's `handoff_to_human` becomes ElevenLabs' `transfer_to_number` system tool pointed at
`VoiceNumber.transferTo` (the owner/receptionist); the transcript still lands in the inbox with status `handoff`.

### A4. Data model (additive)

```prisma
model VoiceNumber {
  id            String   @id @default(cuid())
  orgId         String
  org           Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  phoneE164     String   @unique          // the DID customers dial
  provider      String                    // "exotel" | "twilio" | "sim"
  elevenPhoneId String?                   // ElevenLabs imported phone-number id (agent_phone_number_id)
  label         String   @default("Main line")
  transferTo    String?                   // human transfer target (E.164)
  language      String   @default("en")   // "en" | "hi" (hinglish)
  voiceId       String?                   // ElevenLabs voice id; null = default
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([orgId])
}

model VoiceCall {
  id             String    @id @default(cuid())
  orgId          String
  org            Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId      String?
  conversationId String?
  direction      String                    // "inbound" | "outbound"
  fromE164       String
  toE164         String
  providerCallId String?   @unique         // ElevenLabs conversation_id
  status         String    @default("in_progress") // in_progress | completed | failed | no_answer
  durationSecs   Int?
  transcript     Json?                     // [{ role, message, t }]
  summary        String?
  outcome        String?                   // booked | lead | handoff | info | no_answer
  purpose        String    @default("inbound") // inbound | reminder | no_show
  startedAt      DateTime  @default(now())
  endedAt        DateTime?
  @@index([orgId, startedAt])
}
```
Plus `Conversation.channel String @default("whatsapp")` and `FollowUpConfig.reminderCalls Boolean @default(false)`.

### A5. Module layout — `src/modules/voice/`

| File | Responsibility |
|---|---|
| `types.ts` | `VoiceDriver`, `CallInit`, `PostCall` types |
| `initiation.ts` | pure: `buildCallInit(...)` → ElevenLabs initiation response |
| `transcript.ts` | pure: `parsePostCall(json)`, `outcomeOf(transcript)` |
| `drivers/elevenlabs.ts` | signature verify (HMAC-SHA256, `t=…,v0=…`), outbound call, number import |
| `drivers/simulation.ts` | scripted call for test mode |
| `file-call.ts` | IO: contact/conversation/messages/VoiceCall + webhook + CRM event |
| `reminder-calls.ts` | `tickReminderCalls(now)` for T-2h reminders and no-show recovery |
| `tools.ts` | maps webhook-tool requests → `runTool` from `modules/agent/tools` |

Routes: `src/app/api/voice/{initiation,post-call}/route.ts`, `src/app/api/voice/tools/[tool]/route.ts`.
UI: `src/app/(app)/settings/voice/` (numbers, language, voice, transfer number, reminder calls toggle, "Call your AI"
simulation tester); inbox shows a phone chip + transcript for `channel = "voice"`.
Setup: `scripts/voice-setup.ts` creates the shared ElevenLabs agent (pinned LLM, system tools `end_call` +
`transfer_to_number`, webhook tools with the bearer secret, webhook URLs) and prints the agent id for env.

Env: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_LLM`
(default `claude-haiku-4-5`-class; guard-checked), `VOICE_INITIATION_SECRET`, `VOICE_TOOLS_SECRET`. All optional;
without them every org stays on the simulation driver.

### A6. Pricing (founder decision)

Cost ≈ ₹8.5–12/min all-in (ElevenLabs ₹7–10 + carrier ₹0.3–1 + LLM passthrough). Proposal: **Voice add-on
₹5,999/mo incl. 300 minutes, ₹15/min after** (SG S$199 / MY RM399 / AE AED 299 with the same bundle), sold as
"your front desk also answers the phone and calls no-shows". Keep it an add-on to the flagship, never a standalone.

### A7. Founder actions before implementation
1. ElevenLabs workspace on a plan with SIP trunking + post-call webhooks (confirm with sales that SIP is enabled).
2. Exotel account, KYC for the first client's city, ask hello@exotel.com to enable vSIP trunking, buy one Exophone.
3. Twilio account (SG/MY) when the first non-India client needs voice.
4. Confirm the pricing in A6 in `docs/PRICING.md`.

---

## Part B — CRM integrations: the employee writes to your CRM

### B1. Scope and order
**Zoho CRM first** (Indian SMB default, INR billing, DC-aware OAuth), **Salesforce second**, HubSpot only if a client
asks. Generic case stays the existing outbound webhooks + API keys.

What syncs (one direction: Nudge → CRM; the CRM stays the client's system of record for humans):

| Nudge event | Zoho | Salesforce |
|---|---|---|
| New contact from an inbound conversation | `Leads/upsert` on `Phone` (`Lead_Source` = "WhatsApp (Nudge)"; ad headline/`ctwa_clid` in `Description` when present) | query `Lead` by `Phone`, create if absent (`LeadSource` = "WhatsApp (Nudge)") |
| Lead stage → QUALIFIED | update `Lead_Status` = "Qualified" | `PATCH Lead` `Status` = "Working - Contacted" |
| Booking captured / confirmed | `Tasks` (Subject "Appointment: …", `Due_Date`) + `Notes` | `Task` (`Subject`, `ActivityDate`, `WhoId`) |
| Payment paid | `Notes` ("Deposit ₹… paid via …") | `Task` completed |
| Hand-off requested | `Tasks` for the owner (`Priority` High) | `Task` High priority |
| Conversation summary (daily, from the copilot workstream) | `Notes` | `Task` (Completed, Description = summary) |

### B2. Architecture
`src/modules/crm/` with a provider interface and a job queue processed by the existing cron tick:

```ts
export interface CrmProvider {
  key: "zoho" | "salesforce" | "sim";
  authUrl(state: string, dc?: string): string;
  exchangeCode(code: string, meta: Record<string, string>): Promise<CrmTokens>;   // meta: zoho `location` / `accounts-server`
  refresh(conn: CrmConnectionRow): Promise<CrmTokens>;
  upsertLead(conn: CrmConnectionRow, lead: CrmLead): Promise<{ externalId: string }>;
  updateStage(conn: CrmConnectionRow, externalId: string, stage: CrmStage): Promise<void>;
  logActivity(conn: CrmConnectionRow, externalId: string, activity: CrmActivity): Promise<void>;
}
```
- `CrmConnection` (per org+provider): encrypted refresh token (AES-256-GCM via `lib/crypto`), cached access token +
  expiry, `apiDomain`/`instanceUrl`, `dc`, status, `simulated`.
- `CrmSyncJob` (orgId, provider, event, payload JSON, attempts, nextRunAt, status, externalId, error). Enqueued by
  event hooks in `agent/inbound.ts`, `agent/tools/capture-booking.ts`, `capture-lead.ts`, `handoff.ts`,
  `payments`; drained by `tickCrmSync(now)` inside `/api/cron/process-queue` with exponential backoff (5 attempts).
- Idempotency: `@@unique([orgId, provider, event, entityId])` on the job.
- Simulation provider records to the same tables so Integrations shows a live-looking sync log in test mode.
- OAuth `state` = HMAC of `orgId:provider:nonce` with `TOKEN_ENCRYPTION_KEY`; callback verifies and stores.
- Rate limits: Zoho and Salesforce both throttle per org — jobs are per-org serialised (one in flight per connection).

Env: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`,
`CRM_REDIRECT_BASE` (defaults to `NEXT_PUBLIC_APP_URL`). Zoho's accounts server is per data centre —
`https://accounts.zoho.in` for India — and the token response's `api_domain` is stored on the connection.

UI: Settings → Integrations → **CRM** card: Connect Zoho / Connect Salesforce, connected account, last sync, last
error, "sync now", disconnect. Field mapping is fixed in v1 (name, phone, source, stage, notes); a mapping editor
is not built until a client needs a custom field.

### B3. Founder actions
1. Zoho API console (https://api-console.zoho.in): server-based client, redirect `https://nudgeagent.app/api/integrations/crm/zoho/callback`.
2. Salesforce: a Developer Edition org + Connected App (OAuth web-server flow, scopes `api refresh_token offline_access`),
   callback `https://nudgeagent.app/api/integrations/crm/salesforce/callback`.
3. Put the four env vars in Vercel.

---

## Open decisions for the founder (answer in review)
1. Voice v1 brain: **ElevenLabs-hosted Claude (pinned) + our webhook tools** (recommended) vs. custom-LLM endpoint from day one.
2. Voice pricing (A6).
3. CRM order: Zoho → Salesforce (recommended) vs. Salesforce first.
4. Outbound reminder calls on by default for clinics, or opt-in per client (recommended: opt-in, with WhatsApp reminders remaining the default).
