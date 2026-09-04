# Enterprise Track — Head Plan (Orchestrator + Sub-Agent Prompts)

> **For Claude:** This is a PROGRAM-level plan. Each workstream below is executed by a
> dedicated sub-agent session using its kickoff prompt. Inside each sub-agent session,
> REQUIRED SUB-SKILLS: superpowers:writing-plans (to produce the detailed task plan for
> that workstream) then superpowers:executing-plans / TDD. The head session (this chat)
> reviews between workstreams.
>
> **Status: E0–E6 SHIPPED 2026-09-04** (E5 as wa.me button per F6; E4 sticky-routing variant). Remaining: E4b (per-number staff access + campaign number picker), E7 superseded — a voice front desk (ElevenLabs) shipped via origin/main on 2026-09-04.
> **Originally: APPROVED 2026-09-04.** Founder decisions F1–F3 resolved (below). The
> self-serve plan's WS3–WS7 (PLAN.md) are **PAUSED** — this track is the active roadmap.

**Goal:** Make Nudge enterprise-grade by adding, one careful workstream at a time: a
Developer API + webhooks, custom agent actions (agent calls the customer's backend),
BYO-LLM (OpenAI/Claude/Gemini on the customer's key), multiple WhatsApp numbers per org,
an embeddable website WhatsApp widget, predictive lead scoring + churn risk, and (after a
research spike) a WhatsApp voice agent.

**Architecture:** Every feature extends an existing choke point rather than adding a new
system: the API rides the existing `ApiKey` + `verifyApiKey` module; custom actions plug
into the agent tool registry and reuse the SSRF-hardened webhook `deliver()` guards;
BYO-LLM splits `lib/model-router` into a driver interface (same pattern as
`messaging/drivers` and `calendar/drivers`); multi-number relaxes one `@unique`; scoring
is deterministic RFM math over data that already exists, fed by a new append-only
`ContactEvent` table that starts recording in E0 so history accrues before E6 needs it.

**Tech stack:** unchanged — Next.js App Router, Prisma + Supabase (RLS), Postgres-backed
queue + cron, vitest. New deps only in E3 (`openai`, `@google/genai`).

---

## Founder decisions (resolved 2026-09-04)

- **F1 — Sequencing:** Enterprise track first; PLAN.md WS3–WS7 paused (E0 marks them so).
- **F2 — BYO-LLM & invariant 3:** Invariant 3 is AMENDED (in E3, not before): platform-paid
  AI stays Haiku/Sonnet via the single model-router with the expensive-model guard;
  Enterprise orgs may bring their own OpenAI / Google / Anthropic API key (their cost,
  AES-encrypted like calendar tokens) routed through the same single model-router. Never
  platform-paid Opus/Fable at runtime, unchanged.
- **F3 — API scope:** Both directions, as two workstreams: E1 Developer API (their code →
  Nudge) and E2 Custom Agent Actions (Nudge's agent → their backend).

**Proposed defaults (F4–F6 — head session flags these before the relevant WS starts; if
unchallenged, sub-agents build them as written):**

- **F4 — Entitlements by tier:** Developer API + outbound webhooks → Growth and up
  (Growth's marketing copy already promises "Webhooks + API access"; today nothing
  enforces any plan gate on them — E0 closes that). Website widget → all paid tiers.
  Lead scoring → Pro and up. BYO-LLM, custom actions, multi-number, voice → Enterprise
  (and `front_desk`) only.
- **F5 — Enterprise tier:** new `enterprise` plan id, all numeric limits unlimited, all
  feature flags true. NOT self-serve purchasable — no checkout path; founder assigns it
  via script. Pricing page shows "Contact us". (Hand-set anchor prices can come later.)
- **F6 — Website chat scope:** Phase 1 is a wa.me **button widget** (copy-paste `<script>`
  snippet, per-org config, click tracking). A full live web-chat channel (web visitors
  chatting with the agent in-page) is explicitly deferred — it needs a channel concept on
  `Conversation` and is its own future workstream.

---

## Order, and why

| # | Workstream | Branch | Why this position |
|---|---|---|---|
| E0 | Enterprise foundation | `e0-enterprise-foundation` | Tier + feature flags every later WS gates on; `ContactEvent` must start logging ASAP so E6 has history. Small. |
| E1 | Developer API + webhooks | `e1-developer-api` | Biggest ready-made foothold (`verifyApiKey` exists, tested, unused; outbound webhooks fully built). Low risk, loud enterprise signal. |
| E2 | Custom agent actions | `e2-custom-actions` | Reuses E1-adjacent plumbing (SSRF guards, HMAC signing) while it's fresh. |
| E3 | BYO-LLM + eval matrix | `e3-byo-llm` | Router driver split is self-contained; eval harness extension lets us compare providers before customers do. |
| E4 | Multi-number WhatsApp | `e4-multi-number` | Riskiest schema change (conversation routing); do it with a stable base, not concurrently with anything. |
| E5 | Website widget | `e5-web-widget` | Independent, small, ships fast after the risky one. |
| E6 | Lead scoring + churn | `e6-lead-scoring` | Wants weeks of `ContactEvent` history from E0; purely additive. |
| E7 | Voice agent spike | `e7-voice-spike` | User-flagged "future weeks". Research spike only; go/no-go doc, zero product code. |

Strictly **one workstream at a time** (founder's "one by one, carefully"). Merge gate for
every branch: `npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build` all green,
plus `npm run eval:agent` ≥ 90% whenever agent behavior was touched (E2, E3). Schema
changes ship via `npm run db:push` + an idempotent backfill script (house style — no
migrations dir), then `npm run db:rls` for any new table.

## How the head/sub-agent loop works

1. Head session (this chat) hands you the kickoff prompt for the next workstream.
2. You open a **fresh chat** (Fable for dev speed — dev-time only; runtime AI stays
   Sonnet/Haiku per invariant 3), paste the prompt. The sub-agent reads `AGENTS.md` + its
   section here, writes its own detailed TDD plan (`docs/plans/2026-MM-DD-eN-….md`),
   gets your nod on that plan, then implements on its branch.
3. Sub-agent finishes → posts a summary (what shipped, test evidence, founder-manual
   steps, open questions). You paste that summary back into the head session.
4. Head session reviews (code-review pass on the branch), orders fixes if needed, then
   approves merge to `main` + a `PROGRESS.md` entry. Only then does the next WS start.

**Every sub-agent obeys the 7 invariants** (AGENTS.md), especially: #4 every new feature
works end-to-end in `SEND_MODE=simulation` with zero external keys; #5 every new
query/route org-scoped + RLS on new tables; #2/#6 any new outbound-message path goes
through `sendMessage` and checks consent + the 24h window.

---

## E0 — Enterprise foundation (branch `e0-enterprise-foundation`)

**What exists (grounded):** Plans live in `src/modules/billing/plans.ts` — 5 tiers
(`free|starter|growth|pro|front_desk`), `PlanLimits` = 4 numeric caps + a single feature
boolean `aiFrontDesk` (the precedent to copy). Enforcement helpers in
`src/modules/billing/limits.ts` return `{allowed, message, used, limit}`. `Org.plan` is a
plain string. `createApiKeyAction` and the webhook actions in
`src/app/(app)/integrations/actions.ts` check only `requireRole(ctx,"ADMIN")` — **no plan
gate**, despite Growth's copy promising API access. There is **no event-history table**
anywhere (analytics `leadFunnel` is a current-state groupBy, not a time series).

**Scope:**
1. Add `enterprise` to `PlanId`; extend `PlanLimits` with `publicApi`, `customActions`,
   `byoLlm`, `multiNumber`, `webWidget`, `leadScoring` booleans (F4 matrix). Add
   `checkFeature`-style helpers in `limits.ts` following `checkAiFrontDesk` exactly.
2. Gate the existing API-key + webhook-endpoint server actions on `publicApi` (closes the
   live gap).
3. New append-only `ContactEvent` model: `{id, orgId, contactId?, type, props Json,
   createdAt}` with `@@index([orgId, type, createdAt])` + RLS. Fire-and-forget
   `recordContactEvent()` helper (same pattern as `recordAudit`). Instrument now:
   lead-stage transitions (`capture-lead` tool + contact actions), opt-out, booking
   status changes (`confirmed|no_show|completed`), payment `paid`, inbound/outbound
   message counters are NOT events (too hot — derive from existing tables).
4. `scripts/set-plan.ts` founder script (assign any org any plan, incl. `enterprise`).
5. Mark PLAN.md WS3–WS7 header as paused referencing this file; PROGRESS.md entry.

**Tests:** plan-matrix unit test (every flag × every tier), gated-action test, ContactEvent
write test. **Est: small (1 session).**

**Kickoff prompt (paste into a fresh chat):**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E0 (Enterprise foundation). Work ONLY on branch e0-enterprise-foundation.
Use the superpowers:writing-plans skill to turn section E0 into a detailed TDD task plan
(save as docs/plans/2026-09-04-e0-enterprise-foundation.md), show it to me for approval,
then execute it with superpowers:executing-plans. Scope is exactly E0's 5 items — no
drive-bys. New table gets RLS via npm run db:rls. Merge gate: npm test, npx tsc
--noEmit, npm run lint, npm run build all green. Finish with a summary I can paste back
to the head session: what shipped, test evidence, founder-manual steps, open questions.
```

---

## E1 — Developer API + outbound webhooks (branch `e1-developer-api`)

**What exists (grounded):** `verifyApiKey()` in `src/modules/integrations/api-keys.ts` is
written, sha256-hash-stored, tested (`tests/api-keys.test.ts`) and **unreferenced** —
built for exactly this. Keys are mintable today from the integrations UI
(`api-keys-card.tsx`), format `nk_live_` + 24 random chars, revoke-never-delete.
Outbound webhooks are **fully built** (`src/modules/integrations/outbound-webhooks.ts`):
HMAC `X-Nudge-Signature`, `whsec_` secrets, SSRF guard, delivery log — but only 4 of the
7 advertised events actually fire (`message.sent`, `conversation.assigned`,
`automation.run` never dispatch). Session auth (`requireOrgContext`) `redirect()`s on
failure — wrong for an API; the model to copy is `resolveApiOrg()` in
`src/modules/inbox/api-auth.ts` (cheap, null-on-failure).

**Scope:**
1. `resolveApiKeyOrg(request)` in `src/modules/integrations/api-auth.ts`: reads
   `Authorization: Bearer nk_live_…`, calls `verifyApiKey`, touches `lastUsedAt`, returns
   `{org}` or null → JSON 401. Plan-gated on `publicApi` (E0). Simple in-memory
   per-key rate limit (e.g. 120 req/min) with 429 + `Retry-After`.
2. REST routes under `src/app/api/v1/`: `contacts` (GET list w/ cursor pagination, POST
   create, GET/PATCH by id), `conversations` (GET list, GET messages), `messages` (POST
   send — **MUST route through `sendMessage`** so consent + template gates hold, and
   free-form sends check `isWithinServiceWindow` per invariant 6; template sends require
   `metaStatus === "APPROVED"`), `templates` (GET), `bookings` (GET). v1 keys are
   full-org-access; scopes deferred (documented in the response of `GET /api/v1/me`).
   POST /contacts must NOT be able to resurrect an opt-out (invariant 2).
3. Fire the 3 missing webhook events at their natural sites (`message.sent` in
   `sendMessage`'s success path, `conversation.assigned` in inbox assign action,
   `automation.run` in `automation/engine.ts`).
4. Docs: `docs/API.md` (endpoints, auth, signature verification example, curl per route)
   + link from the integrations page. Everything works in simulation (sim message ids).

**Tests:** auth (bad key, revoked key, wrong plan → 401/403), one test per route family,
window/consent enforcement on POST /messages (the critical ones), rate-limit test,
webhook-event firing tests. **Est: 1–2 sessions.**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E1 (Developer API + webhooks). Branch: e1-developer-api. E0 is already
merged; use its publicApi plan flag. Use superpowers:writing-plans to expand section E1
into a detailed TDD plan (docs/plans/2026-09-04-e1-developer-api.md), get my approval,
then execute. Non-negotiables: every send goes through sendMessage; POST /messages
enforces the 24h window for free-form and consent for marketing templates; POST
/contacts cannot resurrect an opt-out; all routes org-scoped via the API key's org only;
API-auth failures return JSON 401, never redirect; whole API works in
SEND_MODE=simulation. Merge gate: npm test, npx tsc --noEmit, npm run lint, npm run
build. Finish with a paste-back summary (shipped, evidence, founder steps, questions).
```

---

## E2 — Custom agent actions (branch `e2-custom-actions`)

**What exists (grounded):** A real tool registry — `src/modules/agent/tools/index.ts`
holds a compile-time `TOOLS` array + `BY_NAME` map, exports `toolDefs()` / `runTool()`.
The `defineTool` factory (`tools/types.ts`) Zod-validates model args and converts every
failure into a model-recoverable `isError` string. `ToolContext` carries
`{orgId, contactId, conversationId, contactName, contactPhone}`. The SSRF-hardened HTTP
layer to reuse **verbatim** lives in `outbound-webhooks.ts` (`assertPublicHttpsUrl`,
`isBlockedIp`, `redirect:"error"`, 8s timeout, HMAC signing; tests in
`tests/ssrf-guard.test.ts`). `prompt.ts` appends a hand-written `TOOL_GUIDANCE` block —
it must become registry-generated so custom tools are described to the model. Agent loop
is `maxSteps=5` in `runAgent`.

**Scope:**
1. Model `CustomAction { id, orgId, name (slug, must not collide with built-ins),
   description, inputSchema Json, url, method (GET|POST), secretEncrypted, timeoutMs
   default 8000, enabled, createdAt/updatedAt }` + `@@unique([orgId, name])` + RLS.
   Secret via `encryptSecret` (crypto.ts pattern).
2. Registry becomes org-aware: `toolDefs(orgId)` / `runTool(ctx, call)` merge built-ins
   with enabled `CustomAction` rows (plan-gated `customActions`). Executor: validate args
   against the stored JSON Schema (light structural validation — types + required; no new
   heavy dep), then HTTP call with the SSRF guards + `X-Nudge-Signature` HMAC + per-action
   timeout; response body truncated (~4KB) before being fed back to the model; any
   failure → `isError` recoverable string, never a throw.
3. `TOOL_GUIDANCE` generated from the merged registry (names + descriptions).
4. **Simulation (invariant 4):** for simulated orgs the executor never makes a network
   call — it returns a canned echo (`{simulated:true, input}`) so demos work keyless.
5. UI: settings → "Custom actions" (ADMIN, enterprise-gated) — CRUD + a "test run" button
   that calls the executor with sample input and shows the response.

**Tests:** schema-validation test, SSRF reuse test (private IP blocked), timeout test,
truncation test, sim-mode test, agent-loop integration with mocked fetch, name-collision
rejection. **Merge gate adds `npm run eval:agent` ≥ 90%** (prompt changed).
**Est: 2 sessions.**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E2 (Custom agent actions). Branch: e2-custom-actions (E0+E1 merged). Use
superpowers:writing-plans to expand section E2 into a detailed TDD plan
(docs/plans/2026-09-04-e2-custom-actions.md), get approval, execute. Non-negotiables:
reuse the SSRF guards from src/modules/integrations/outbound-webhooks.ts verbatim (no
second implementation); executor never throws into the agent loop; simulated orgs never
make network calls; secrets AES-encrypted via src/lib/crypto.ts; TOOL_GUIDANCE becomes
registry-generated. Merge gate: full green suite PLUS npm run eval:agent >= 90%. Finish
with a paste-back summary.
```

---

## E3 — BYO-LLM: OpenAI / Claude / Gemini (branch `e3-byo-llm`)

**What exists (grounded):** `src/lib/model-router/` is the single doorway (`generate`,
`chat`, `runAgent`; 7 production call sites; Anthropic SDK only; module-level `_client`
singleton). The abstraction leaks Anthropic types: `AgentToolDef.input_schema` is
`Anthropic.Tool.InputSchema` (ripples into `tools/types.ts` + 5 tool files whose schema
literals are already plain JSON Schema — mechanical fix). Guard is a substring deny-list
(`opus|fable|mythos`) that would silently pass any OpenAI/Gemini id — it must become a
provider-aware allow-list. `usage.ts` prices by `model.includes("haiku")` — must become a
`{provider, model} → price` table. The per-org secret pattern to copy is
`src/modules/calendar/accounts.ts` (encrypt on write, decrypt on read, `"sim"` sentinel
for simulated orgs). Driver-split precedents: `messaging/drivers/`, `calendar/drivers/`.
**Automated AI evaluation already exists**: `scripts/agent-eval.ts` (`npm run eval:agent`)
— 14 scenarios, pass-rate based, CI-gateable at ≥90%, with anti-hallucination and
anti-lying checks. It cannot yet compare providers.

**Scope:**
1. Provider-neutral `ToolSchema` (plain JSON Schema type) in the router's public surface;
   update `tools/types.ts` + the 5 tool files.
2. Split `model-router/index.ts` into a `LlmDriver` interface +
   `drivers/anthropic.ts` / `drivers/openai.ts` / `drivers/gemini.ts` (official SDKs:
   `openai`, `@google/genai`). Only the tool-call marshalling and stop-reason logic are
   provider-specific. Keyed client cache replaces the `_client` singleton.
3. `LlmAccount { orgId @unique, provider ("anthropic"|"openai"|"google"), model,
   apiKeyEncrypted, createdAt/updatedAt }` + `accounts.ts` mirroring calendar's +
   `getLlmCredentials(orgId)`. Simulated orgs: `"sim"` sentinel, no key needed.
4. Resolution order in the router: org has enterprise-gated `LlmAccount` → BYO driver +
   key; else platform default (`RUNTIME_MODEL` on `ANTHROPIC_API_KEY`). Guard v2:
   platform-paid path keeps the deny-list AND anthropic-only; BYO path checks against a
   **curated allow-list per provider** (hand-set: e.g. gpt-5.2/gpt-5-mini,
   gemini-3-flash/pro, claude-sonnet-5/haiku — junk ids rejected at save time with a
   live "test key" call). AiUsage rows gain `byok Boolean` (cost still computed for
   visibility; priced from the new table; unknown → warn).
5. UI: settings → AI (enterprise-gated): provider select, model select, key input
   (write-only, shows prefix), "test connection".
6. Eval matrix: `EVAL_PROVIDER` / `EVAL_MODEL` env overrides in `agent-eval.ts` + a
   summary table comparing runs, so we can benchmark GPT vs Gemini vs Sonnet on the same
   14 scenarios before telling customers anything.
7. **Amend AGENTS.md invariant 3** to the F2 wording. This is the only AGENTS.md change.

**Tests:** driver-selection test, guard-v2 tests (platform path still blocks
opus/fable/mythos AND non-anthropic; BYO path rejects unlisted models), key
encrypt/decrypt, per-provider tool-marshalling unit tests (mocked SDKs), pricing-table
test, sim-mode keyless test. **Merge gate adds `npm run eval:agent` ≥ 90%** on the
platform path. **Est: 2–3 sessions (biggest one).**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E3 (BYO-LLM). Branch: e3-byo-llm (E0–E2 merged). Use
superpowers:writing-plans to expand section E3 into a detailed TDD plan
(docs/plans/2026-09-04-e3-byo-llm.md), get approval, execute. Non-negotiables: all 7
call sites keep calling the same generate/chat/runAgent surface (no call-site rewrites
beyond types); platform-paid path remains Anthropic Haiku/Sonnet with the guard;
customer keys AES-encrypted, "sim" sentinel for simulated orgs, zero keys needed in
simulation; curated model allow-list per provider; AGENTS.md invariant 3 amended exactly
per F2 in the head plan. Merge gate: full green suite PLUS npm run eval:agent >= 90% on
the platform path. Finish with a paste-back summary including the eval matrix numbers.
```

---

## E4 — Multiple WhatsApp numbers per org (branch `e4-multi-number`)

**What exists (grounded):** `WhatsappAccount` (`prisma/schema.prisma:369`) has
`orgId @unique` ("one connected number per org (MVP)") — the `Org` relation is already
plural, so dropping `@unique` is the only schema change *for the account itself*. But
**nothing routes by number**: `Conversation` has `@@unique([orgId, contactId])` and no
`whatsappAccountId`; `Template`/`Campaign`/`Message` never reference a sending number;
~12 files key the whole API off `orgId` (inventory in the table below — from the scout).
Inbound webhook already resolves org by `phone_number_id` via `findFirst` (no index —
add one). `processTemplateUpdate` already handles multiple orgs per WABA.

Files that assume one number (all must take an account id): `modules/whatsapp/accounts.ts`
(entire API), `modules/messaging/index.ts` (`SendOptions`), `modules/whatsapp/approval.ts`,
`modules/whatsapp/meta-templates.ts`, `modules/dashboard/queries.ts`,
`app/(app)/settings/whatsapp/{page,actions,go-live-checklist}`,
`app/(app)/integrations/{page,actions}`, `app/(app)/inbox/try/page.tsx`.

**Scope:**
1. Schema: drop `@unique` on `WhatsappAccount.orgId`; add `@@unique([phoneNumberId])`;
   add `isDefault Boolean` (exactly one per org, enforced in code); add
   `whatsappAccountId String?` to `Conversation` and `Campaign`, `wabaId`-awareness to
   `Template` (templates are per-WABA at Meta). Conversation uniqueness becomes
   `@@unique([orgId, contactId, whatsappAccountId])`. Idempotent backfill script: point
   every existing conversation/campaign at the org's single account, set it default.
2. `accounts.ts` API becomes account-id-keyed with org-scoped list/get/default helpers;
   `SendOptions` gains optional `whatsappAccountId` (default = conversation's account,
   else org default). Webhook inbound stamps the account onto the conversation.
   Agent/inbox/followup replies go out via the conversation's own account.
3. UI: settings → WhatsApp lists numbers (add/label/set-default/disconnect); inbox
   thread header shows which number; campaign create gets a sending-number picker.
4. Simulation supports N sim numbers (invariant 4). `Org.simulated` stays org-level
   (live/test is still one switch — per-number mode is out of scope, noted for later).

**Tests:** routing test (two numbers, same contact → two separate conversations, replies
leave from the right number), webhook resolution test, default-account fallback,
backfill idempotency, template-per-WABA test. **Est: 2–3 sessions. Riskiest WS — no
other work in flight while this merges.**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E4 (multi-number WhatsApp). Branch: e4-multi-number (E0–E3 merged). Use
superpowers:writing-plans to expand section E4 into a detailed TDD plan
(docs/plans/2026-09-04-e4-multi-number.md) — the plan MUST enumerate every one-number
assumption from the file inventory in section E4 and say what happens to each — get
approval, then execute. Non-negotiables: idempotent backfill script; replies always
leave from the conversation's own number; simulation supports multiple sim numbers with
zero keys; every new query org-scoped. This is the riskiest workstream: work in the
smallest possible commits, each green. Merge gate: full green suite. Finish with a
paste-back summary.
```

---

## E5 — Website WhatsApp widget (branch `e5-web-widget`)

**What exists (grounded):** Nothing — the scout confirmed no embeddable widget, no
`wa.me` link generation, no public chat surface anywhere in `src/` or `public/`. The
closest surface (`/inbox/try`) is auth-gated and simulation-only. So this is greenfield,
but small under F6 (button widget only).

**Scope:**
1. `WidgetConfig` on `Org.settings` JSON (house pattern for per-org config): enabled,
   greeting text, pre-filled message, button color/position, `widgetKey` (random public
   id — never the org id).
2. Public route `GET /api/widget/[widgetKey]/config` (no auth — returns only the public
   display config + the org's WhatsApp number in wa.me form; 404 for unknown/disabled
   keys; cache headers). Public `GET /widget.js` (static, self-contained, no framework):
   reads `data-nudge-key` from its script tag, fetches config, renders a floating
   WhatsApp button → opens `https://wa.me/<number>?text=<prefill>`. Fires a
   click beacon → `POST /api/widget/[widgetKey]/event` → `recordContactEvent`
   (`type:"widget_click"`, no contact) with a per-IP rate limit.
3. Settings → "Website widget" page (paid tiers per F4): toggle, customization, live
   preview, copy-paste snippet
   (`<script src="https://nudgeagent.app/widget.js" data-nudge-key="…" async></script>`).
4. Simulation orgs get a sim number in the preview so the flow demos keyless; the
   snippet page explains a live number is needed for the real button.

**Tests:** config route (unknown key 404, disabled 404, no private data leaked), widget
key rotation, click-event rate limit, snippet renders in a bare HTML fixture (jsdom).
**Est: 1 session.**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E5 (website WhatsApp widget, BUTTON scope per decision F6 — no live
web-chat). Branch: e5-web-widget (E0–E4 merged). Use superpowers:writing-plans to expand
section E5 into a detailed TDD plan (docs/plans/2026-09-04-e5-web-widget.md), get
approval, execute. Non-negotiables: the public config route must leak nothing beyond
display config + the wa.me number; widgetKey is random and unrelated to org id;
widget.js is dependency-free and tiny; click events rate-limited; demos keyless in
simulation. Merge gate: full green suite. Finish with a paste-back summary.
```

---

## E6 — Predictive lead scoring + churn risk (branch `e6-lead-scoring`)

**What exists (grounded):** Strong raw signals, no history. `Contact.leadStage`
(`NEW|CONTACTED|QUALIFIED|WON|LOST`), `Conversation.lastInboundAt`,
`ConversationMessage` volumes + response gaps (`analytics/compute.ts:firstResponseGaps`),
campaign `Message.status` (`READ|CLICKED` — richest engagement signal),
`BookingRequest.status` (`no_show|completed` — ready-made labels),
`PaymentRequest.paidAt` (revenue labels), `optedOutAt`. The temporal gap is closed by
E0's `ContactEvent` (weeks of stage-transition/booking/payment history by the time this
WS starts). House rule applies: **prefer deterministic code over runtime AI** — this is
explainable RFM math, not an ML pipeline and not an LLM call.

**Scope:**
1. Pure scoring module `src/modules/scoring/`: `computeLeadScore(features) → {score
   0–100, reasons: string[]}` from hand-weighted, unit-tested features — recency of last
   inbound, message frequency + inbound/outbound ratio, campaign READ/CLICKED history,
   booking outcomes (completed ↑, no_show ↓), payments paid, stage. Every score carries
   human-readable reasons ("replied yesterday", "2 no-shows") — explainability is the
   feature.
2. Churn risk (for WON/repeat contacts): days-since-last-interaction vs that contact's
   own historical cadence (from `ContactEvent` + message timestamps) → `low|medium|high`
   with reasons.
3. Storage: `Contact.leadScore Int?`, `leadScoreReasons Json?`, `churnRisk String?`,
   `scoredAt`. Recompute: batched in the cron tick (bounded batch per tick) +
   opportunistic on inbound message (fire-and-forget, same pattern as `recordAudit`).
4. UI (Pro+ per F4): score chip + reasons tooltip on contact profile, sortable score
   column + churn filter in contacts list, "at risk" card on the dashboard.
5. Explicitly out: any model training, any LLM-based scoring, any auto-messaging based
   on score (follow-ups remain the existing followup module's job).

**Tests:** scoring is pure → exhaustive unit tests per feature + monotonicity checks
(more no-shows never raises the score), churn cadence test, batch-recompute idempotency.
**Est: 1–2 sessions.**

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E6 (lead scoring + churn). Branch: e6-lead-scoring (E0–E5 merged). Use
superpowers:writing-plans to expand section E6 into a detailed TDD plan
(docs/plans/2026-09-04-e6-lead-scoring.md), get approval, execute. Non-negotiables:
scoring is a pure deterministic function with unit-tested weights and human-readable
reasons — no LLM calls, no ML deps; recompute is fire-and-forget and bounded per cron
tick; no auto-messaging triggered by scores. Merge gate: full green suite. Finish with
a paste-back summary.
```

---

## E7 — WhatsApp voice agent — RESEARCH SPIKE ONLY (branch `e7-voice-spike`)

**Why a spike:** Meta's WhatsApp Business Calling API (GA mid-2025) lets businesses
receive VoIP calls on their WhatsApp number via the Cloud API (SIP/WebRTC) — but
availability, per-market rollout, WABA eligibility, pricing, and the realtime
voice stack (streaming STT → LLM → TTS latency budget) are all unverified for our
setup. Building product code before verifying these would burn weeks. The founder
flagged this as "future weeks" — so E7 produces a **go/no-go design doc, zero product
code**.

**Spike deliverable** (`docs/plans/2026-09-XX-voice-agent-design.md`): Calling API
eligibility for our WABAs (India/MY/SG/UAE), permission/App Review requirements,
SIP vs WebRTC recommendation, candidate voice stack with latency + per-minute cost
model at our runtime-model policy, how a voice session maps onto our
Conversation/Contact model, what simulation mode means for voice (invariant 4 story),
and a phased build plan sized in sessions. Head session + founder then decide go/no-go.

**Kickoff prompt:**

```text
Read AGENTS.md, then docs/plans/2026-09-04-enterprise-track.md — you are the sub-agent
for workstream E7 (voice agent RESEARCH SPIKE — no product code). Branch: e7-voice-spike.
Research the current state of Meta's WhatsApp Business Calling API (use web search; do
not trust training data — verify against Meta's developer docs as of today) and realtime
voice-AI stacks compatible with our runtime-model policy. Deliver ONLY the design doc
described in section E7, with sources, a latency/cost model, and a phased build plan.
End with a clear go/no-go recommendation and open founder decisions.
```

---

## Known platform debts this track exposes (tracked, not in scope)

- **The cron is daily** (`vercel.json`: `0 3 * * *`) and the queue is really ticked from
  request paths (campaign page views / stats polls) with no lock or fairness. Fine for
  today's volume; an enterprise customer doing real campaign volume needs a
  minute-level tick + locked worker. Revisit after E4.
- Per-number live/test mode (E4 keeps `Org.simulated` org-level).
- API key scopes + live web-chat channel (deferred by design, noted in E1/E5).
- Eval harness still mutates the first org in the DB (`agent-eval.ts`) — the old plan's
  WS3 fix (dedicated eval orgs) is paused with it; E3's matrix work should not make
  this worse.
