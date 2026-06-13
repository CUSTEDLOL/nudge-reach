# PROGRESS — Nudge Reach (WhatsApp)

Build log. Newest phase at the top. Each entry: what was done, decisions made,
what's next.

---

## Phase 5 — Polish, demo, deploy (2026-06-13) ✅ DEPLOYED

### Done
- **Live URL: https://nudge-reach.vercel.app** (project `nudge-reach`,
  Vercel account `custedlol`; simulation mode).
- All 12 env vars pushed to Vercel production; `vercel.json` daily cron on
  `/api/cron/process-queue` (dashboard view-ticking covers demo-scale
  sends); `maxDuration: 60` on the generation route segment.
- Demo retailer seed (`scripts/seed-demo.ts`): 5 opted-in contacts,
  "Regular customers (demo)" audience, draft "Banarasi Silk Dupatta"
  campaign — deterministic, re-runnable, no AI call.
- README: deploy + demo-seed docs, live URL.
- 61 unit tests passing; verified against production with a signed-in
  user: dashboard, campaigns list (demo + sent campaign), contacts.

### Post-deploy hotfix (2026-06-13)
- **Photo upload 500'd in production**: Next.js server actions default to a
  1 MB body cap; product photos exceed it. Raised to 6 MB via
  `experimental.serverActions.bodySizeLimit`, plus a friendly client-side
  4 MB pre-check on `/campaigns/new`.
- **White text in input boxes**: the create-next-app scaffold shipped
  `prefers-color-scheme: dark` variables, so dark-mode browsers rendered
  white form text on our white cards. Removed the dark block, set
  `color-scheme: light`, and pinned explicit input/textarea/select colors.
- Redeployed; both fixes verified live (page loads, `color-scheme:light`
  present in shipped CSS, no new runtime errors).

### Founder action still needed (1 minute)
- Supabase → Authentication → URL Configuration: set Site URL to
  https://nudge-reach.vercel.app and add it to Redirect URLs, so NEW
  sign-ups from production get confirmation links that redirect correctly
  (currently they'd bounce to localhost).

### Known limitations / deferred
- Live WhatsApp path (real WABA creds) is code-complete but unverified —
  no Meta Business Account yet. Embedded Signup not built (manual creds
  screen exists at /settings/whatsapp).
- Cost estimator uses the configurable INR rate (₹0.99 default) — verify
  against Meta's current pricing before going live.
- Local `next dev` OOMs on this machine after long idle; use
  `npm run build && npx next start` locally instead.

### MVP definition of done — status
- [x] Sign in → upload product photo → generated compliant campaign
- [x] Edit campaign → WhatsApp-style preview
- [x] Import opted-in contacts → audiences
- [x] Run campaign (simulated) → delivery/read/click stats + estimated cost
- [x] Deployed and reachable on a URL

---

## Phase 4 — Send & track (2026-06-12) ✅ COMPLETE (simulation verified end to end; live driver code-complete, unverified — no Meta credentials)

### Done
- **Models**: `Message` (status QUEUED→SENT→DELIVERED→READ→CLICKED /
  FAILED, metaMessageId, costMinorUnits; unique per campaign+contact),
  `WebhookEvent` (raw payload audit/idempotency), `Campaign.audienceId`.
  RLS enabled.
- **Send queue** (`lib/send/queue.ts`) — Postgres-backed (decision: no
  Inngest account dependency; swappable later). `enqueueCampaign` is
  consent-gated fan-out (rule 2 — non-opted-in members counted + skipped);
  `processQueue` sends batches of 30 through `lib/messaging` (which
  re-checks consent per message), paced ~10/s in live mode; campaign
  auto-completes to SENT when the queue drains.
- **Simulated delivery lifecycle** (`lib/send/sim-progress.ts`, pure +
  unit-tested): deterministic per-message timeline (~93% deliver, 75% read,
  30% click, rest fail), forward-only transitions; cost accrued per
  delivered message at the configured INR rate.
- **Webhook endpoint** (`/api/webhooks/whatsapp`) — GET subscription
  handshake; POST verifies `X-Hub-Signature-256` (timing-safe, unit-tested),
  stores raw event, then idempotently applies: message status updates
  (incl. pricing → actual cost), template APPROVED/REJECTED updates,
  inbound STOP/unsubscribe/opt-out → permanent opt-out scoped to the org's
  phone number. Proxy excludes `/api/webhooks` + `/api/cron` from auth.
- **Queue tick** (`/api/cron/process-queue`) for Vercel Cron; the dashboard
  also ticks server-side on every view so small sends need no cron.
- **UI**: run panel on approved campaigns (audience picker with opted-in
  counts, estimate = recipients × rate, simulation notice); live-updating
  stats dashboard (progress bar, sent/delivered/read/clicked/failed cards,
  estimated vs actual cost), auto-refresh while sending.
- 61 unit tests passing; build + lint green.

### Verified live (scripts/phase4-live.ts + curl)
- 10-person audience (9 opted in, 1 not): consent gate queued 9, skipped 1.
- 9 sends via the simulation driver; statuses progressed over ~30s
  (9 delivered → 5 read → 1 clicked), cost ₹8.91, campaign → SENT;
  dashboard page renders the results.
- Webhook: handshake echoes challenge (bad token → 403); signed STOP
  message permanently opted out the contact; tampered signature → 401;
  event stored with processedAt.

### Decisions
- Postgres queue + on-view/cron ticking instead of Inngest (zero extra
  accounts/keys; the founder can swap later — the queue API is 3 functions).
- Dev-server OOMs on this machine → verification runs against
  `next start` (production server).

### Next
- **Phase 5 — Polish, demo, deploy**: demo seed, Vercel deploy + cron,
  README. Needs founder's Vercel login for the deploy itself.

---

## Phase 3 — Templates & approval (2026-06-12) ✅ COMPLETE (simulation verified; live path code-complete, unverified — no Meta credentials yet)

### Done
- **Template payload builder** (`lib/whatsapp/template.ts`) — campaign
  content → Meta `message_templates` create payload; unit-tested against the
  reference example in docs/WHATSAPP_CLOUD_API.md. `category` forced
  MARKETING. Meta-safe template names via `slugifyTemplateName`.
- **Models**: `Template` (componentsJson, metaStatus PENDING/APPROVED/
  REJECTED, rejectionReason), `WhatsappAccount` (one per org,
  `accessTokenEncrypted`). RLS enabled.
- **Token encryption** (`lib/crypto.ts`) — AES-256-GCM with
  TOKEN_ENCRYPTION_KEY; round-trip + tamper tests.
- **Approval flow** (`lib/whatsapp/approval.ts`) — submit: simulation
  creates the PENDING row with a mock media handle; live POSTs to
  `/<WABA_ID>/message_templates` incl. resumable-upload of the header image.
  Status: polling fallback (`refreshTemplateStatus`); simulation approves
  after a 10s mock review; rejection sets campaign back to DRAFT with the
  reason shown + edit-and-resubmit. Webhook delivery of status arrives with
  the Phase 4 webhook endpoint.
- **UI**: approval panel on the campaign page (submit → live-updating
  pending banner (auto-refresh every 4s) → approved/rejected states);
  `/settings/whatsapp` connection screen (manual WABA/phone/token entry,
  token encrypted; simulation-mode banner). Editing an approved campaign
  resets it to DRAFT — stale approvals can't be sent.
- 49 unit tests passing; build + lint green.

### Verified live (scripts/phase3-live.ts)
- Real flow in simulation: submit → Template row with HEADER/BODY/FOOTER/
  BUTTONS payload → TEMPLATE_PENDING → (11s) → APPROVED →
  campaign TEMPLATE_APPROVED → page renders "Approved — ready to send".

### Decisions
- Meta allows one header per template: with a product photo we use an IMAGE
  header and fold the text headline into the body as a *bold* first line;
  TEXT header otherwise.
- Mock review window: 10 seconds (long enough to demo the pending state).
- One WhatsApp account per org (MVP).

### Next
- **Phase 4 — Send & track**: Message model, consent-gated rate-limited
  send queue, webhook endpoint (signatures, idempotency, STOP → opt-out),
  campaign dashboard with delivery stats + cost.

---

## Phase 2 — Generate, the wedge (2026-06-12) ✅ COMPLETE

### Done
- **Storage**: `product-photos` public bucket (public read is required —
  Meta fetches template header images by URL); authenticated upload/update
  policies via SQL.
- **Models**: `Product`, `Campaign` (status enum per PRD; editable fields
  stored as `content Json` in the §7 shape — Template rows arrive in
  Phase 3). RLS enabled.
- **Generation** (`lib/campaign/`): PRD §7 system prompt verbatim + explicit
  JSON key list; vision path when a photo exists; defensive parsing
  (`extractJson` strips fences/prose) with one strict retry; **guardrails as
  pure unit-tested functions** — `repairPersonalization` ({{1}} exactly
  once), `repairOptOutFooter` (opt-out mandatory, ≤60 chars),
  `repairAndValidate` (zod, Meta length caps, ≤3 buttons).
- **UI**: `/campaigns` list with status badges + empty state,
  `/campaigns/new` (photo upload with thumbnail + optional description),
  `/campaigns/[id]` editor — every field editable with a live generic
  chat-style preview (`components/whatsapp-preview.tsx`, no WhatsApp
  branding), AI tips panel (imageTreatment/notes). Human edits pass through
  the same compliance repairs — the opt-out and {{1}} can't be edited away.
- 40 unit tests passing; build + lint green.

### Verified live (scripts/phase2-live.ts + fetch-as-user.js)
- Real product photo → Haiku vision → valid compliant JSON through the real
  `lib/campaign/generate.ts` path (model demonstrably *saw* the image — its
  photo tip referenced the hanger in the test shot).
- Campaign persisted; `/campaigns/[id]` renders header, body with {{1}}
  substituted ("Hi Priya, …"), opt-out footer, and both buttons; list +
  new pages render.

### Decisions
- Editable campaign fields live on `Campaign.content` (Json, §7 shape)
  rather than a Template row — Template (Meta payload + approval status)
  is a Phase 3 concern built *from* this content.
- Image cap 4 MB before upload (Claude vision limit ~5 MB).
- Preview is deliberately generic chat styling (no Meta/WhatsApp logo).
- Visual (screenshot) check of the preview deferred to the Phase 5 demo
  pass; Phase 2 verified via rendered-HTML assertions.

### Next
- **Phase 3 — Templates & approval**: Meta MARKETING template payload
  builder (unit-tested vs docs example), submit + mock/live approval
  tracking, WhatsApp connection screen (manual creds, token encrypted).

---

## Phase 1 — Platform modules (2026-06-12) ✅ COMPLETE

### Done
- **`lib/model-router`** — `generate({system, prompt, image?, maxTokens})` via
  the official `@anthropic-ai/sdk`. Default model `claude-haiku-4-5`
  (cheapest vision-capable tier, $1/$5 per MTok — verified via the claude-api
  skill), env-configurable. **Rule 3 enforced in code:**
  `assertRuntimeModelAllowed` throws on opus/fable/mythos (unit-tested).
- **`lib/consent`** — pure `canSendMarketing(contact)`; opt-out permanent.
  Unit-tested (rule 2).
- **`lib/messaging`** — channel-agnostic `sendMessage(channel, recipient,
  payload)`; WhatsApp simulation + live (Cloud API) drivers behind one
  interface; consent gate enforced at this lowest layer for MARKETING
  payloads. `buildSendPayload` unit-tested against the docs example.
- **`lib/billing`** — stub: `estimateCampaignCost` (recipients × INR rate,
  labelled estimate), `formatInr`, ledger interface for live reconciliation.
- **Contacts/Audiences** — Prisma models (Contact unique per org+phone,
  Audience, AudienceContact), RLS enabled on all three; `/contacts` page with
  add-one, CSV-paste import (requires explicit consent confirmation —
  compliance checklist), opt-out / delete, audience create/delete.
  `normalizePhoneE164` helper (+91 default) unit-tested.
- 24 unit tests passing; build + lint green; CRUD verified end to end against
  the live app + DB (`scripts/verify-phase1.js`).

### Decisions
- Consent gate enforced **twice**: pure function for queue/UI checks + inside
  `lib/messaging.sendMessage` so no send path can bypass it.
- Runtime model uses the bare alias `claude-haiku-4-5` (canonical per
  current Anthropic docs; no date suffix).
- CSV import never resurrects an opted-out contact (upsert updates name only).
- Audience membership limited to opted-in contacts at the UI level; the send
  path re-checks the gate anyway.

### Acceptance criteria status
- [x] `canSendMarketing` unit-tested
- [x] Contacts/audiences CRUD works (verified live)
- [x] Model-router returns text for a test prompt — verified live with the
      founder's key (`scripts/verify-model-router.js`, claude-haiku-4-5,
      37 in / 33 out tokens).

### Next
- **Phase 2 — Generate (the wedge):** photo upload to Supabase Storage,
  campaign generation per PRD §7, editable fields + WhatsApp-style preview.

---

## Phase 0 — Scaffold (2026-06-12) ✅ COMPLETE — verified against live Supabase

### Done
- Git repo initialized; project docs moved from repo root into `docs/`.
- Next.js 16 (App Router) + TypeScript + Tailwind v4 scaffolded.
- Prisma 6 initialized against Supabase Postgres (`prisma/schema.prisma`) with
  the `Org` model (one org per user). `lib/db.ts` Prisma singleton,
  `lib/org.ts` find-or-create org (race-safe).
- `.env.example` with every variable through Phase 4; `lib/env.ts` validates
  env at boot with Zod (imported from `app/layout.tsx`).
- Supabase Auth wired with `@supabase/ssr`: browser/server clients in
  `lib/supabase/`, session refresh in `proxy.ts` (Next 16's renamed
  middleware), email+password and Google OAuth on `/login`, callback/confirm/
  signout routes under `/auth/*`.
- Protected `/dashboard` page: verifies auth with `getClaims()`, creates the
  Org row on first visit, renders "Hello, {org}" — the auth + DB round-trip.
- Vitest set up; first tests cover the env schema (`tests/env.test.ts`).
- `README.md` with setup instructions.

### Decisions (smallest reversible choice where docs were silent)
- **Docs location:** moved `PRD.md`/`BUILD_PLAN.md`/`WHATSAPP_CLOUD_API.md`
  into `docs/` to match the kickoff prompt's expected layout.
- **Auth method:** email+password as primary (works with zero email/SMTP
  config) + Google OAuth button; magic-link can be added later. Both the
  PKCE `/auth/callback` and token-hash `/auth/confirm` routes exist so
  sign-up works regardless of the project's email-confirmation setting.
- **Next 16 conventions:** `proxy.ts` (middleware was renamed in v16);
  Supabase's current guidance followed — publishable key (not legacy anon),
  `getClaims()` for page protection (never `getSession()` server-side).
- **Env validation & live mode:** `SEND_MODE=live` requires all `WHATSAPP_*`
  vars + `TOKEN_ENCRYPTION_KEY` at boot (enforced in `lib/env.ts`, unit
  tested). Validation is skipped during `next build` so CI needs no secrets.
- **Default runtime model:** `claude-haiku-4-5-20251001` (cheapest
  vision-capable Haiku tier) as `RUNTIME_MODEL` default; will be re-verified
  against current model list when building `lib/model-router` in Phase 1.
- **Prisma connections:** pooled `DATABASE_URL` (pgbouncer) for runtime +
  `DIRECT_URL` for migrations, per Supabase guidance.

### Acceptance criteria status
- [x] App builds
- [x] Env validated at boot; `.env.example` complete
- [x] `PROGRESS.md` + `README.md` created
- [x] User can sign in and an Org row is created — verified end to end
      against the live Supabase project (`lgojsxrljjmkwxawocdk`,
      ap-southeast-1) with test account `visheshjain1705+nudgetest@gmail.com`
      via `scripts/verify-phase0.js`

### Post-verification decisions
- **RLS enabled on `Org`** (and required on every future Prisma table):
  Supabase's Data API exposes `public` tables to the publishable key by
  default; RLS with no policies blocks that while Prisma (table owner)
  retains access.
- **`.env` + `.env.local` split:** Prisma CLI only reads `.env`, Next.js
  reads both — DB URLs live in `.env`, everything in `.env.local`. Both
  git-ignored.
- **Supabase MCP connector abandoned** for now (their OAuth client_id is
  broken); using direct connection strings instead.
- **Google OAuth provider not yet enabled** in the Supabase project — the
  login button exists but the founder must enable the provider in
  Supabase → Authentication → Providers (optional; email works).

### Next
- **Phase 1 — Platform modules**: model-router, channel-agnostic messaging
  interface, contacts/opt-in with consent gate (unit-tested), billing stub.
- Needs from founder: `ANTHROPIC_API_KEY` for the live model-router check.
