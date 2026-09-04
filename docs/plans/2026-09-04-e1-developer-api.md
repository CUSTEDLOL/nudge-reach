# E1 — Developer API + Webhooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans.
> Head plan: `docs/plans/2026-09-04-enterprise-track.md` §E1. Branch: `e1-developer-api`.

**Goal:** A key-authenticated public REST API (`/api/v1/*`) on the existing `ApiKey`
infrastructure, plus firing the three advertised-but-silent webhook events.

**Architecture:** `resolveApiKeyOrg(request)` is the single auth doorway (Bearer
`nk_live_…` → `verifyApiKey` → org + `publicApi` plan flag → per-key rate limit),
returning JSON errors, never redirects. Route handlers stay thin and reuse the same
module functions the UI actions use — POST /messages mirrors the inbox composer's
send flow exactly (window check, `sendMessage` consent gate, ConversationMessage
persistence). v1 keys are full-org-access; scopes deferred.

**Tasks:**

1. **Auth doorway** — `src/modules/integrations/api-auth.ts`: `resolveApiKeyOrg`
   (+ 120 req/min per-key limit via `checkRateLimit`). Tests first
   (`tests/api-v1-auth.test.ts`): missing/bad/revoked key → 401; plan without
   `publicApi` → 403 naming Growth; over-limit → 429 with Retry-After; good key →
   org returned.
2. **Read routes** — `GET /api/v1/me`, `GET /api/v1/contacts` (cursor pagination),
   `GET /api/v1/contacts/[id]`, `GET /api/v1/conversations`,
   `GET /api/v1/conversations/[id]/messages`, `GET /api/v1/templates`,
   `GET /api/v1/bookings`. All org-scoped via the key's org only.
3. **Write routes** — `POST /api/v1/contacts` (E.164 normalize, contact plan limit,
   **cannot resurrect an opt-out** — invariant 2), `PATCH /api/v1/contacts/[id]`
   (name/email/leadStage; stage change emits `ContactEvent`), `POST /api/v1/messages`
   (free-form: 24h window enforced — invariant 6; template: `metaStatus=APPROVED`
   required; both through `sendMessage` so the consent gate holds — invariant 2;
   persists ConversationMessage + denormalized conversation fields like the inbox).
   Tests: window closed → 422, unapproved template → 422, marketing template to
   non-opted-in → 403 consent, opt-out resurrection attempt → optedIn stays false.
4. **Webhook events** — fire `message.sent` (in `sendMessage` success path, org
   sends only), `conversation.assigned` (assign action), `automation.run` (engine
   COMPLETED/FAILED terminal writes). Test: dispatch called with the right payloads.
5. **Docs + link** — `docs/API.md` (auth, pagination, endpoints, webhook signature
   verification snippet, curl examples); integrations page API-keys card links to it.
   PROGRESS.md entry. Full gates + commit per task.

**Simulation:** every route works with `SEND_MODE=simulation` (sim message ids,
no keys) — invariant 4.
