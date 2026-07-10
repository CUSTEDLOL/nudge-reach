# PROGRESS — Nudge Reach (WhatsApp)

Build log. Newest phase at the top. Each entry: what was done, decisions made,
what's next.

---

## Agent Knowledge Memory — "the employee that trains itself" (2026-07-10) ✅

Branch `feat/agent-knowledge` (spec:
`docs/superpowers/specs/2026-07-10-agent-knowledge-memory-design.md`). The
agent's knowledge is now structured, categorized, conditional, and
self-growing — no fine-tuning (Meta policy + Haiku economics), all prompt
grounding.

### Done
- **Structured memory**: `KnowledgeEntry` (category / fact / optional
  condition, org-scoped + RLS). The prompt reads a categorized digest
  (`modules/knowledge/digest.ts`, capped, pure) — never the raw blob.
- **Time-aware conditions**: prompt carries `TODAY: <org-local weekday/time>`;
  "weekends only" facts answer correctly per day (verified live: asked for
  weekend-only kebabs on a Friday → agent said "today is Friday, weekends
  only").
- **Learn-on-the-job**: new `ask_owner` agent tool. Unknown in-scope question
  → "checking with the team" + deduped `OwnerQuestion` (10 phrasings = 1
  question via `questionKey`). Owner answers on **/knowledge** → Haiku
  distills to facts (keyless fallback: raw answer as one fact) → every
  waiting customer still inside the 24h window gets an automatic follow-up
  through `sendMessage`. Known-fact short-circuit stops the agent asking
  what it already knows.
- **Any-business identity**: prompt introduces the agent from the org's OWN
  vertical ("a jewellery business") — the silent restaurant fallback is dead.
- **/knowledge page**: answer queue + fact library (add/edit/archive,
  ADMIN-gated server-side) + one-click "structure my existing info" blob
  migration. Sidebar entry, dashboard nudge banner, audit-log actions.
- **Questionnaire** (`/knowledge/questionnaire`): one deterministic
  20-question script (per-vertical wording), two modes — premade form and
  chat-style interview — both distilling into the same memory. New
  "Teach your AI the business" onboarding-checklist step (now 6 steps);
  concierge counts structured knowledge as a configured KB.
- **Inbox suggest-reply** reads the same digest.
- Demo seed: 10 categorized facts (2 conditional) + 1 pending owner question.
- **E2E verified live** (`scripts/knowledge-live.ts`, real code paths, Haiku,
  simulation sends): ask-unknown → queue → answer → distill → auto follow-up
  → re-ask answered from memory with the condition applied. Cleans up after
  itself.
- **422 tests / 52 files** (was 372/45); tsc, lint, build green.

### Decisions
- No embeddings/RAG — an SMB's 50–500 facts fit Haiku's context; the digest
  is deterministic and testable. Revisit if a client passes ~1,000 facts.
- Prompt hardened against closed-world reading: "business information may be
  INCOMPLETE — absence ≠ no; ask_owner instead of denying" (the E2E caught
  the agent saying "we don't have kebabs" before this rule).

### Known limitations
- Haiku can still name invented alternatives when being helpful (observed:
  fictional dishes offered alongside a correct answer). Mitigations: the
  never-invent/verbatim rules, the `not_offered` questionnaire item, and the
  fact base growing with real traffic. Watch in production transcripts.
- Follow-ups outside the 24h window are memory-only (template re-open is a
  documented v2).
- Owner is asked in-app only (WhatsApp-to-owner is v2).

### Founder TODO
- Production: `npm run db:push` + `npm run db:rls` (two new tables) before
  deploying this branch; then merge to main.

## Landing v2 — "The Night Shift" (2026-07-06) ✅

The landing page rebuilt as an immersive 3D scroll experience on branch
`landing-v2` (spec: `docs/superpowers/specs/2026-07-06-landing-3d-design.md`):

- **One persistent R3F world** behind the whole page — sky grades night → dawn
  → morning (`world/palette.ts`), a keyframed camera path (`world/path.ts`),
  and three chapter scenes: chat-bubble flythrough, calendar assembly, lead
  orbit. Scroll is time: 11:47 PM → 9:00 AM on the DayRail shift clock.
- **Pinned chapter story** (`chapters/night-shift.tsx`) synced to the same
  `CHAPTERS` spans the 3D scenes use; morning payoff with counters; daylight
  sections full-bleed (features → salary → compare → industries → reseller);
  pricing and FAQ live on their own routes (`/pricing`, `/faq`).
- **Adaptive quality on desktop AND mobile**: device tiering + live frame
  governor (`world/quality.ts`, tested), dpr/particle step-down, no drei.
- **Fallbacks structural**: no-JS / reduced-motion / no-WebGL get the complete
  static story on the `.v2-page` night→day gradient; all copy is server HTML.
- Deleted dead v1 landing components (hero, social-proof, agent-conversation)
  and the superseded `nightfield.tsx`; pricing-tiers/roi-calculator stay (used
  by the Pricing section).
- New unit tests: progress spine, quality tiers, sky palette, camera path
  (372 total green). Build + lint green throughout.

## Course correction — AI Front Desk (2026-07-05) ✅

Strategic pivot from "WhatsApp CRM" to **AI Front Desk** (see `docs/STRATEGY.md`),
executed as an 8-phase branch chain. Highlights:

- **Restructure** (`phase-2-structure`): root `app/lib/components` → `src/` with
  `src/modules/*` domain modules, `src/lib` cross-cutting only; `@/*`→`src/*`.
  `docs/ARCHITECTURE.md`. Pure moves, green at every commit.
- **Hardening** (`phase-4-hardening`): fixed H1 (agent-profile role gate) + M1
  (stats scoping) + a 23-agent adversarial security re-audit's findings — HIGH
  billing payment-integrity (plan bound to the paid order, not client input),
  SSRF guard on outbound webhooks, open-redirect guards, whatsapp template-status
  tenant isolation, campaign-edit + export + integrations role gates, timing-safe
  compares, x-real-ip rate-limit keying. +23 regression tests. `docs/SECURITY.md`.
- **Purge** (`phase-3-purge`): depcheck/ts-prune-verified dead-code removal;
  `docs/CHANGELOG_CLEANUP.md`.
- **The moat** (`phase-5-product`): Google Calendar booking (sim|live driver
  split, `src/modules/calendar`), the Revenue-Recovery follow-up engine
  (`src/modules/followup`: reminders/no-show/review + quiet-lead nudge, all
  consent+template gated), concierge onboarding (`src/modules/concierge`), and
  the **AI Front Desk flagship tier** (₹14,999) + MYR + the `checkAiFrontDesk`
  gate. Everything demoable in `SEND_MODE=simulation`.
- **Landing** (`phase-6-landing`): rebuilt around the AI-employee USP — animated
  agent conversation, Meta-vs-Nudge comparison, salary calculator, reseller CTA,
  flagship-first pricing. Dep-free (no 3D lib), reduced-motion-safe.
- **Docs** (`phase-7-docs`): `AGENTS.md`/`CLAUDE.md` carry the strategy + 7
  invariants + architecture rules; `docs/STRATEGY.md`, README, DEMO_SCRIPT,
  DEPLOYMENT refreshed.

**Founder TODO after this branch:** `npm run db:push` + `npm run db:rls` (new
tables: CalendarAccount, FollowUpConfig + BookingRequest fields), then the ordered
list in `docs/HANDOVER.md` — Meta setup, deploy, legal placeholders, then SELL.

---

## Phase 10 — Global markets (2026-07-04) ✅

Two commits: multi-currency core + landing currency toggle. Verified in both
currencies against the running app (screenshots, 280 tests, tsc/lint/build).

### Done
- **Org globalization columns**: `currency` (INR/USD/AED/SAR/SGD/IDR/BRL/
  MXN/GBP — every market bills in its LOCAL currency), `dialCode`, `timezone`
  — one country pick at onboarding (or Settings → General) sets all three.
  India defaults preserved for all existing rows/call sites.
- **Dual-gateway billing**: every non-INR org → hosted Stripe Checkout in
  its local currency (REST, env-gated `STRIPE_SECRET_KEY`; signed webhook
  `/api/webhooks/stripe` with replay tolerance is source of truth); INR stays
  Razorpay. PLAN_PRICES carries rounded market prices per plan per currency
  (e.g. Growth: ₹2,499 / $69 / AED 249 / SAR 259 / S$95 / Rp 1.099.000 /
  R$349 / MX$1,299 / £59) — founder-tunable, deliberately not live FX.
  Per-currency message-rate estimates likewise (live Meta pricing overrides).
  Verified visually: AED, BRL, IDR and ₹ billing pages all render correctly.
- **Per-market money everywhere**: message-rate defaults per currency
  (₹0.99 / $0.03, live Meta prices still override per message), estimates,
  simulated cost accrual, monthly usage, campaign stats/recipients/tables,
  analytics spend, dashboard revenue — all in org currency.
- **Country-aware phones**: bare local numbers get the org dial code;
  Meta-webhook numbers treated as cc-included; sim tester pre-normalizes.
- **Market AI voice**: `+91` keeps the Hinglish-friendly campaign voice;
  everyone else gets clear international English. Org-timezone greeting.
- **Landing**: ₹ India / $ International toggle over the pricing grid + ROI
  calculator (prices imported from lib/billing/plans — no drift).
- Tests: +16 (country-aware phones, currency formatting, USD plan ladder,
  Stripe webhook HMAC + replay defense) → **280 total**.

### Known limitations
- Switching country after accruing message costs re-labels historical minor
  units under the new symbol (no FX conversion) — country is meant to be a
  set-once onboarding choice.
- USD message-rate default ($0.03) is a placeholder average; Meta rates vary
  by destination country. Live-mode webhook pricing overrides per message.
- Landing toggle defaults to ₹; no geo-IP detection yet.

---

## Phase 9 — Demo-ready + production hardening + mobile (2026-07-03) ✅

Eight commits (070d62a…c445c9b) taking the MVP to client-demo-ready.

### Done
- **Plan limits enforced server-side** (contacts, team seats, automations,
  campaign messages/month — single choke point in enqueueCampaign) with
  friendly upgrade prompts; tiers renamed Free/Starter/Growth/Pro with
  message quotas (legacy "scale" id maps forward).
- **Rate limiting** (in-process sliding window, honest best-effort scope):
  public waitlist per IP, AI suggest per org, webhook/Meta test pings per
  org. **Optional CRON_SECRET** bearer auth on /api/cron.
- **Audit log**: append-only AuditLog + admin viewer (Settings → Audit log),
  wired into role changes, invites, opt-outs, contact deletes, campaign
  sends, WhatsApp connection, API keys, webhooks, plan changes, demo resets.
- **Demo reset** (Settings → Data; simulation + OWNER only): seed extracted
  to lib/demo/seed.ts (CLI wrapper kept), wipes CRM data, keeps
  team/keys/webhooks/billing, re-seeds; verified end to end.
- **Go-live checklist** on Settings → WhatsApp: six real-state checks.
- **Retry failed campaign sends** (fresh Message rows so the deterministic
  sim timeline can't re-fail them; consent re-checked).
- **Landing sellability**: real pricing tiers, ROI calculator with disclosed
  assumptions, six industry use cases, Start free / Book a demo CTA flow,
  login restyle. Fixed a real production bug: reduced-motion users saw
  NOTHING animated (SSR opacity-0 hydration mismatch in Reveal/Stagger).
- **Mobile version**: bottom nav (<lg), Modal→bottom sheet + full-width
  Drawer <sm, DataTable card mode <sm, inbox as a true mobile chat,
  grid-cols-1 base fix across ~17 files. 22 routes × {375,390,430,768} —
  zero page-level horizontal overflow (automated sweep). docs/MOBILE_QA.md.
- **Docs pack**: README rewrite + DEPLOYMENT.md + SECURITY.md +
  DEMO_SCRIPT.md (5-minute sales flow) + GO_LIVE aligned to per-org creds.
- Composite indexes (Conversation [orgId,lastMessageAt], Contact
  [orgId,createdAt]); WhatsApp connect ADMIN-gated.
- **264 unit tests** (28 files; +31: CSV/CWE-1236, rate limit, plan limits,
  Razorpay HMAC), tsc/lint/build green.

### Known gaps
- Rate limiting is per-instance (serverless) — documented in SECURITY.md.
- Plan limits are read-then-write (tiny race overshoot acceptable).
- Automation builder is functional-but-dense at 375px.
- Live WhatsApp path still awaits real Meta credentials (runbook ready).

---

## Phase 8 — Full CRM MVP (2026-07-02) ✅ BUILT (AiSensy/WATI-class product)

### Done
Two commits (`aea838c` foundation, `0635833` modules), built per
`docs/MVP_BUILD_SPEC.md` (the build contract — read it first).

- **Foundation**: additive Prisma schema (Membership + OWNER/ADMIN/AGENT
  roles, Invite w/ auto-join on signup, Tag/ContactTag/ConversationTag, Note,
  lead stages, conversation assignment/unread/preview, org-scoped library
  Templates (campaignId now optional), Automation/Step/Run, ApiKey, Org
  settings Json); `requireOrgContext()`/`requireRole()` alongside unchanged
  `requireOrg()`; `npm run db:rls` (idempotent RLS enabler, run after every
  db:push); 21-piece UI kit in `components/ui/`; dark-sidebar app shell
  `app/(app)/` — existing URLs unchanged; rich idempotent demo seed.
- **Modules**: dashboard w/ onboarding wizard + checklist + stat cards;
  shared inbox `/inbox` (3-pane, filters, 24h-window-gated composer,
  template sender, AI suggest-reply w/ tones — drafts only, never auto-sent,
  canned samples without API key; tags/notes/assignee/stage; 3s polling that
  pauses on hidden tab; sim tester); contacts CRM (filterable table, profile
  w/ merged activity timeline, bulk actions, tags manager, dynamic segments);
  campaign wizard (photo/template/blank → audience or segment → compliance
  interstitial → send now or schedule); template library w/ mock Meta review
  (name containing "reject" → rejection path, for demos); automations engine
  (5 triggers, 8 step kinds, wait/resume via cron, run logs, wired into the
  inbound path BEFORE the AI agent — automation reply suppresses AI reply);
  analytics (volume/rates/campaign/agent/funnel/tags, recharts); settings
  (general/team+invites/notifications/billing placeholder/CSV export) +
  integrations (webhook info, test connection, hashed API keys).
- `/conversations` now redirects to `/inbox`. Cron tick = release scheduled
  campaigns + resume waiting automation runs + advance send queues.
- **226 unit tests** (was 72), tsc/lint/build green on Node 20.

### Decisions
- Consent gate untouched at the core (`sendMessage`); automations/template
  sends inherit it — blockedByConsent fails the step, logged.
- Roles UI-hidden AND server-enforced (`requireRole`); last-OWNER demotion
  blocked server-side.
- Live Meta template submission for library templates is a documented stub
  ("ships with WABA onboarding"); campaign-template live path unchanged.
- `.env.local` on this machine now points at local Postgres
  (`dhairyakakkar@localhost`) with the seeded demo org; real creds live in
  Vercel. Supabase auth keys locally are placeholders — signed-in flows need
  real keys or the production URL.

### Known gaps / next
- Local runtime verification limited to public pages + auth redirects
  (placeholder Supabase keys); full click-through needs real creds.
- Invite emails not sent (auto-join on signup by email match instead).
- Payments, Zapier/Make, message-history export: placeholder cards.
- Production deploy of this build not yet run (`npx vercel --prod`), and
  `npm run db:push` + `db:rls` + seed must be run against Supabase first.

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
