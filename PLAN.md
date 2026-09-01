# Self-Serve Vertical SaaS — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Status: APPROVED 2026-09-01** (all decisions resolved — see "Founder decisions"). Implementation in progress, WS0 first.

**Goal:** Convert Nudge from a concierge-gated "AI Front Desk" flagship into a self-serve vertical SaaS: pack-pre-trained agent, 30-minute self-onboarding, three market-priced tiers, and per-vertical ad attribution that decides which vertical wins.

**Architecture:** Vertical Packs become versioned data consumed by the existing agent/knowledge/template/followup modules. Cost tracking hooks the single model-router choke point. Funnel events get a new org-optional `FunnelEvent` table written fire-and-forget (same pattern as `recordAudit`). The wizard replaces client-side step state with a persisted pointer on `Org`. Schema changes ship via the repo's existing `prisma db push` workflow (no migrations dir exists) plus idempotent backfill scripts.

**Tech stack:** unchanged — Next.js 16 App Router, Prisma 6 + Supabase (RLS), Postgres queue + Vercel Cron + GitHub Actions tick, recharts, vitest.

---

## Conflicts between the brief and the repo (read first)

1. **`pnpm` does not exist here.** The repo is npm-only (`package-lock.json`, `npx` in scripts, docs say `npm run`). The script will be `npm run preflight:live`. ⚠️ Migrating to pnpm is a separate founder decision; not doing it silently.
2. **The model-router guard never blocked Sonnet.** It is a substring *denylist* (`opus|fable|mythos`, `src/lib/model-router/guard.ts:7`) — Sonnet already passes. The real WS2 work is: an explicit "Sonnet allowed" guard test (missing today), flipping the env default `claude-haiku-4-5` → `claude-sonnet-5` (`src/lib/env-schema.ts:19`), fixing `tests/env.test.ts:17-19` which pins the Haiku default, updating `.env.local` guidance, and the greenfield cost tracking. Note: local `.env.local` still runs Haiku — evals to date measured Haiku, not Sonnet.
3. **The crypto rail is far smaller than briefed.** No dependencies, no Prisma models/columns, no env vars exist for it. It is ~10 files of hand-rolled code keyed off the magic string the removed currency marker. BUT the hosted `/pay/[id]` page is now **load-bearing for fiat simulation links** (`src/modules/payments/index.ts:157`) — it gets stripped of its crypto branches, not deleted. The machine-payment API route dies whole.
4. **A purse-icon import appears innocently.** A lucide-react icon (billing page) and `src/lib/crypto.ts` (AES token encryption, invariant-critical) would trip naive banned-term greps. The banned-term test will scan for every banned term (list lives in the guard test only); the billing page icon gets swapped (e.g. `CreditCard`) so the exception list stays empty.
5. **Current trial is 14-day `front_desk`, not Growth** (`src/modules/billing/trial.ts:7`). WS5 re-points `TRIAL_PLAN` to `growth` per the brief.
6. **No conversation-based limit exists.** Plan limits today: contacts, seats, automations, campaign messages/month. "Monthly active conversations incl. follow-ups" is a net-new metric + gate.
7. **The /pricing marketing page doesn't render tiers at all** — it's a hardcoded "₹20,000 implementation package" card, out of sync with the in-app 5-tier ladder. WS5/WS7 replace it with the real tier data.
8. **No event/analytics/UTM infra exists anywhere.** WS6 is fully greenfield. `AuditLog` is unsuitable (auth-required, no structured props, feeds a user-facing compliance view) — new `FunnelEvent` table instead.
9. **The eval harness mutates a shared org** (`agent-eval.ts:197,216` — grabs `findFirstOrThrow`, overwrites its AgentProfile per vertical). With 3+ packs this race worsens. WS3 gives each vertical its own dedicated eval org (slug-keyed, created on demand).
10. **The knowledge questionnaire is one hardcoded 20-item script** with a per-vertical noun swap (`src/modules/knowledge/questionnaire.ts`). WS3 makes packs the source of questions, falling back to the generic script for org verticals without a pack.
11. **AGENTS.md forbids exactly this pivot** ("do NOT drift… do not re-open these decisions") and states moat 3 as done-for-you concierge. This plan includes rewriting AGENTS.md + docs (STRATEGY addendum, PRICING) as part of WS5/WS7 so the repo contract matches the new direction. The 7 invariants survive unchanged except invariant-3 wording (Sonnet).
12. **Uncommitted local changes:** the per-contact "Message as customer" feature (WS0 commits it) and six stale marketing diffs that partially revert the committed Cal.com demo-button direction (they swap `LaunchDemoButton` → `BookDemoButton`; we already chose upstream in the navbar merge). ⚠️ WS0 proposes **discarding** those six marketing diffs. Untracked `NUDGE-SEP-README.md` + `docs/plans/2026-07-22-…` left alone.
13. **Hosted-WABA "pending verification" doesn't exist.** Settings → WhatsApp is a status card + Cal.com call link + an Advanced manual credentials form; `saveWhatsappAccount` flips the org live unconditionally with zero Meta validation. WS4 adds a request/status object and polling UI.
14. **`docs/HACKATHON_INNOVATEX.md` is rail-pervaded** (a submission artifact). Plan: delete it (git history preserves it). PROGRESS.md's historical crypto-rail entry gets rewritten to a removal note — the brief demands zero banned-term references in docs, which includes the build log.

## ✅ Founder decisions (resolved 2026-09-01)

- **D1 — Credits.** Plans include a **credit allowance renewed weekly, no rollover**; credits meter everything with underlying cost. 1 credit ≈ ₹1 of cost: agent AI reply = 1, marketing template message = 5, utility/reminder message = 2, inbound + free-form 24h-window replies = 0. Allowances: Starter 250/wk · Growth 1,000/wk · Pro 3,500/wk; top-up packs purchasable anytime. Exhaustion: campaigns + follow-ups pause with an upgrade/top-up prompt; the live agent keeps replying within a small overdraft (never cut off a customer mid-conversation). The agent is available on **all** tiers; tiers differ on credits, seats, and assisted onboarding (Pro). WS2's `AiUsage` table is the metering backbone.
- **D2 — No free plan, no advertised trial.** The brief's 14-day Growth trial is dead. Signup → full wizard → product runs in **test mode** indefinitely (simulated WhatsApp, /inbox/try; costs nothing, never marketed as a plan). The paywall moment is connecting a real WhatsApp number. **Voucher codes** (founder-issued) grant Starter/Growth for N days, redeemable at the paywall.
- **D3 — Prices.** India ₹1,499 / ₹5,499 / ₹14,999 · Singapore S$49 / S$149 / S$499 · remaining 8 currencies scaled proportionally from these anchors, hand-set in `PLAN_PRICES` as today.
- **D4 — `/admin/funnel` gate:** `FOUNDER_EMAILS` env allowlist, checked server-side, route 404s otherwise.
- **D5 — Wizard:** new orgs only; mid-flight orgs map to step 1. Step 2 carries the two-question market-research instrument: (1) industry — full 15-20 option list + free text, pack verticals get the pre-trained agent, everything else gets the generic pack **and logs demand as a funnel event**; (2) "what should Nudge handle?" multi-select (answer instantly / book / chase leads / collect payments / campaigns) — personalizes later steps and feeds per-vertical feature demand into /admin/funnel.
- **D6 — `/pay/[id]`:** keep-and-strip.

---

## Sequencing & branches

Order as briefed: WS0 → WS1 → WS2 → WS3 → WS4 → WS5 → WS6 → WS7. One branch per workstream (`ws0-housekeeping`, `ws1-remove-crypto`, …), merged to `main` only when `npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build` are green. PROGRESS.md entry per workstream, with a "Founders must do manually" list. Schema changes via `npm run db:push` + idempotent backfill script per workstream (repo has no prisma/migrations dir — db-push workflow is the house style).

WS3 must land before WS4 (wizard consumes pack knowledge schemas) and before WS7 (landers consume pack copy). WS5 before WS6's revenue%-of-plan metrics are meaningful; WS2's cost data feeds WS6's cost-per-org views.

---

## WS0 — Housekeeping (branch `ws0-housekeeping`)

**Files:** commit `src/app/(app)/contacts/[id]/page.tsx`, `profile-view.tsx`, `actions.ts` (the "Message as customer" feature, already `isSimulated(org)`-aware). Discard the six stale `src/components/marketing/*` diffs (D-noted above). Create `scripts/preflight-live.ts`; add `"preflight:live"` to package.json (esbuild-bundle-then-node, same pattern as `eval:agent`).

**preflight:live checks** (pass/fail/warn table, exit 1 on any FAIL):
- ENV presence: `SEND_MODE`, `RUNTIME_MODEL` (+ warn if not `claude-sonnet-5`), `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `META_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- Meta (only when a token is present): `GET /v23.0/me` (token valid + expiry via `debug_token` when possible), `GET /{WABA_ID}` reachable, `GET /{PHONE_NUMBER_ID}` reachable, webhook subscription list on the app. In simulation with no token: WARN + skip, never FAIL (invariant 4).
- Supabase: `NEXT_PUBLIC_SUPABASE_URL` set; if `SUPABASE_ACCESS_TOKEN` (management API) is present, verify Site URL + redirect allowlist match `nudgeagent.app`; else print the manual checklist line.
- WARN-only: Razorpay keys, Stripe keys, Google OAuth keys absent.
- Cron: warn if `.github/workflows/cron-tick.yml` exists but `CRON_SECRET` unset.

**Tests:** `tests/preflight.test.ts` — table builder is pure (checks-as-data), unit-test the evaluator with fake env/fetch. Commit: `chore(ws0): commit contact sim-message button + preflight:live`.

---

## WS1 — Remove the crypto rail (branch `ws1-remove-crypto`)

Scout inventory is complete and exact; the work is mechanical:

- **Delete:** `src/app/api/pay/[id]/route.ts`, `the old rail test file` (port its one live-Razorpay routing case into `tests/payment-link.test.ts` first), `docs/HACKATHON_INNOVATEX.md`.
- **Strip crypto branches (keep files):** `src/app/pay/[id]/page.tsx` (lines 7-9, 38, 71-76, 80-101, 109, 120-125), `src/app/pay/[id]/actions.ts:10` comment, `src/modules/payments/index.ts` (1, 19, 22-29, 31-33, 35-42, 80, 83, 111-113, 150-153 — keep `appBaseUrl` + fiat sim branch), `src/modules/agent/tools/send-payment-link.ts` (:30-35, :42, :52), `src/lib/supabase/proxy-session.ts` (remove `"/api/pay"` only; `/pay` and `/demo` stay public).
- **Copy edits:** `src/modules/demo/seed.ts:1160` (drop the removed-rail clause from the payments fact), `PROGRESS.md:51` + the 2026-08-14 entry (rewrite: crypto parts removed, keep the /demo sandbox + re-theme record), `docs/TEST_REPORT.md:31`.
- **Icon swap:** billing page purse icon → `CreditCard` so the banned-term guard needs no exceptions.
- **Banned-term guard:** new `tests/no-crypto-references.test.ts` — walks `src/`, `tests/`, `docs/`, `prisma/`, `scripts/`, `.env.example`, `README.md`, `AGENTS.md`, `PROGRESS.md` for the banned-term regex (defined only inside that test), excluding: this test file itself, `.next`, `node_modules`, `src/lib/crypto.ts` false-positive is impossible (term list has no bare "crypto"). Runs in the normal vitest suite → failing build on reintroduction.
- **Verify:** payment links end-to-end in simulation (existing `tests/payment-link.test.ts` + a manual `/inbox/try` → send_payment_link → `/pay/{id}` → settle walk), full gates.
- **Data note (founders):** old `PaymentRequest` rows with the removed currency marker survive harmlessly; optional cleanup SQL listed in PROGRESS.

---

## WS2 — Model policy + AI cost visibility (branch `ws2-cost-visibility`)

**Guard/policy (small):**
- `tests/model-guard.test.ts`: add explicit `claude-sonnet-5 allowed` case; keep Opus/Fable/Mythos throw cases (invariant 3).
- `src/lib/env-schema.ts:19`: default → `claude-sonnet-5`; fix `tests/env.test.ts:17-19` to expect sonnet; comment updated.
- `scripts/verify-model-router.js:20`: import the real guard instead of a duplicate regex.
- Founder task list: set `RUNTIME_MODEL=claude-sonnet-5` in Vercel AND `.env.local` (local evals currently measure Haiku).

**Cost tracking (greenfield):**
- Schema: new model `AiUsage { id, orgId (indexed w/ createdAt), conversationId?, purpose ("agent_reply"|"suggest"|"distill"|"campaign_copy"|"ingest"), model, inputTokens, outputTokens, costMicroUsd Int, createdAt }` + RLS via existing `db:rls` script.
- Capture at the single choke point: `src/lib/model-router/index.ts` — `generate`/`chat`/`runAgent` gain an optional `attribution?: { orgId, conversationId?, purpose }` param; they read `response.usage` (all three already hold the raw SDK response) and fire-and-forget an `AiUsage` insert. Keyless/simulation paths write synthetic counts (`ceil(chars/4)` in, same out) so invariant 4 holds. A `MODEL_PRICES_MICRO_USD` table (per-MTok, hand-set: sonnet 3_000_000 in / 15_000_000 out; haiku 1_000_000 / 5_000_000) computes `costMicroUsd`; unknown model → priced as sonnet + warn.
- Thread attribution through the five call sites: `agent/reply.ts` (org+conversation), `ai/suggest-reply.ts`, `knowledge/distill.ts`, `knowledge/ingest.ts`, `campaign/generate.ts` (org only).
- Analytics additions (`src/modules/analytics/queries.ts` + `analytics/page.tsx`): AI cost this month (org), cost per conversation (spend ÷ distinct conversations touched), cost per booking (spend ÷ BookingRequests in range), cost as % of plan price (uses `planPrice(org.plan, currency)` converted via a hand-set USD rate per currency — money.ts gains `approxUsdMinor(currency)`), plus a red flag banner when % > threshold.
- Threshold: `PLAN_COST_ALERT_PCT` default 35 in `plans.ts` (per-plan override field), org-level override in `Org.settings` JSON. Internal view of over-threshold orgs joins WS6's /admin area.
- Tests: usage-recording unit test (mock SDK w/ usage), synthetic-count test in simulation, cost math test, threshold flag test.

---

## WS3 — Vertical Pack framework (branch `ws3-vertical-packs`)

**Shape (data, TS consts — typed, tree-shaken, no DB):** `src/modules/verticals/types.ts` defines `VerticalPack` v1:

```ts
interface VerticalPack {
  id: "study_abroad" | "clinic" | "coaching";  // extensible union → string
  version: number;
  label: string; emoji: string;
  promptFragment: string;                       // appended to agent system prompt
  knowledgeSchema: PackQuestion[];              // replaces generic questionnaire items
  templates: PackTemplate[];                    // booking confirm, reminder, ghosted follow-up, deadline nudge, payment request, no-show recovery
  followUp: { cadenceHours: number[]; recoveryEnabled: boolean };
  bookingTypes: { key: string; label: string; minutes: number }[];
  sampleConversations: { title: string; turns: string[] }[];  // 5 per pack, /inbox/try starters
  evalProfile: { businessName: string; businessInfo: string; allowedPrices: number[] };
  evalCases: PackEvalCase[];                    // ≥15, harness-compatible
}
```

- `src/modules/verticals/index.ts`: registry + `getPack(id)`, `packForOrg(org)`; `src/modules/verticals/packs/study-abroad.ts`, `clinic.ts`, `coaching.ts`. A fourth pack = one new file + registry line (data change, no code).
- **Integration points:** `agent/prompt.ts` (append `promptFragment`), `knowledge/questionnaire.ts` (`questionnaireScript(vertical)` returns pack schema when a pack exists, generic script otherwise), `concierge/index.ts:installVerticalPack` (replaced by pack-driven template install — existing salon/clinic inline packs fold into the framework), `followup/install.ts` (pack cadence), `inbox/try` (pack sample conversations as starters), booking types → `calendar/when.ts` defaults.
- Org selection: `Org.vertical` stays the key; onboarding + Settings → General gain a pack picker (switch = re-run idempotent template/followup install, never deletes user data).
- **Eval integration:** `scripts/agent-eval.ts` refactor — `PROFILES`/`SCENARIOS` move to importing pack `evalProfile` + `evalCases` (existing restaurant/clinic inline cases preserved: restaurant stays inline as the demo-org vertical, clinic merges into the clinic pack). Each vertical gets a **dedicated eval org** (`eval-{vertical}` slug, created on demand) killing the shared-org race. `npm run eval:agent -- --vertical study_abroad` filter. Definition of done per pack: its eval set ≥90% (harness gate) — run and record in PROGRESS.
- Study-abroad first and deepest: knowledge schema (countries served, intake cycles, services+fees, visa support, consultation types), 6 Meta-review-ready templates, 15+ evals (grounding on fees, intake deadlines, visa scope refusal, booking a counselling slot, ghosted-lead recovery, multilingual Hinglish case, prompt-injection).
- Then clinic (dental+aesthetic; absorbs today's inline clinic profile) and coaching/test-prep.

---

## WS4 — Self-serve onboarding wizard (branch `ws4-onboarding`)

- Schema: `Org.onboardingStep Int @default(0)`, `Org.onboardingData Json @default("{}")`; `WhatsappConnectRequest { id, orgId, businessPhone, displayName, status: "pending_verification"|"connected"|"rejected", note?, createdAt, updatedAt }`.
- Rebuild `src/app/(app)/onboarding/` as 7 resumable steps (server-persisted pointer, deep-linkable `?step=n`, each step's action writes then advances): (1) org+market/currency (reuses `COUNTRY_PRESETS`), (2) industry + feature questionnaire per D5 (pack verticals → pre-trained agent; other industries → generic pack + demand funnel event; feature multi-select personalizes steps 4-7), (3) WhatsApp hosted-path **— the paywall step per D2: requires a paid plan or voucher to submit a real number; test mode continues without it** — collect business number → creates `WhatsappConnectRequest`, shows exactly what happens next + founder Meta-side steps, status polling client (reuses the template-approval polling pattern); founders flip status via /admin (WS6) or Settings; simulation auto-connects instantly (invariant 4), (4) calendar — OAuth button only when Google keys exist, placeholder card otherwise, simulated connect in sim, (5) pack knowledge questions + price-list/FAQ upload → existing distill/ingest, (6) `/inbox/try` embedded with pack sample conversations, (7) go-live summary + Revenue Recovery toggle.
- Funnel events fired per step (WS6 emitter, stubbed no-op until WS6 lands — or land the tiny emitter here and the reporting in WS6; choosing the latter: emitter ships in WS4).
- Concierge (`settings/concierge`) stays, gate changes from `planHasAiFrontDesk` to Pro-plan in WS5.
- Old 3-step wizard deleted; dashboard checklist updated to point at new steps; `getOnboardingSnapshot` extended.
- Tests: step-persistence actions, WhatsApp request state machine, sim auto-advance, wizard completable end-to-end in simulation (route-level test hitting each action in order).

---

## WS5 — Pricing, credits & plans (branch `ws5-pricing`)

- `plans.ts`: ladder becomes `starter | growth | pro` (+ internal `test_mode` state for unpaid orgs per D2). Tier dimensions: **weekly credit allowance** (250/1,000/3,500), seats, assisted onboarding flag (Pro). Contacts/automations kept as generous per-tier caps. `PLAN_PRICES` re-set for all 10 currencies from D3 anchors (₹1,499/5,499/14,999 · S$49/149/499 · others proportional), hand-set as today.
- **Credit ledger:** new model `CreditLedger { id, orgId (indexed), delta, balanceAfter, reason ("weekly_grant"|"agent_reply"|"marketing_msg"|"utility_msg"|"topup"|"voucher"|"adjustment"), refId?, createdAt }`. Weekly grant via the existing cron tick (idempotent per org per ISO week; no rollover — grant sets balance to allowance, never adds). Spend hooks: agent reply (1), marketing template send (5), utility/reminder send (2) — wired at the same choke points as consent/window checks. Exhaustion: campaigns + follow-ups pause with upsell message; agent replies allowed to overdraft to −50. Balance surfaced on dashboard + billing page.
- **Vouchers:** new model `Voucher { code (unique), plan, days, redeemedByOrgId?, redeemedAt?, createdAt }`; founder-issued (script + /admin page), redeemable at the WhatsApp-connect paywall.
- Mapping: `getPlan()` maps legacy `free→test_mode`, `front_desk→pro`, `scale→pro`. Backfill `scripts/migrate-plans.ts`: front_desk→pro; free orgs→test_mode (data untouched, sending paused until paid/vouchered); current trial orgs get a grandfather voucher equivalent (Growth until their `trialEndsAt`). **No paying org loses access** — paid front_desk keeps pro capabilities at old price until founders migrate billing manually (founder task).
- `trial.ts` retired (no advertised trials); expiry logic replaced by voucher expiry → test_mode.
- `limits.ts`: `planHasAiFrontDesk` → `planHasAgentActions` (true for all paid tiers + active voucher); `checkCredits(orgId, cost)` replaces the message-count limit; seat limit kept.
- Billing UI (`settings/billing`: plan card + credit balance + top-up + voucher entry), checkout actions (gateways unchanged: INR→Razorpay, else Stripe), flagship-gate call sites (7 files, scouted), `/pricing` marketing page rebuilt from `PLANS` data with currency picker.
- Docs: AGENTS.md rewrite (new one-liner, moats → vertical packs / outbound / 30-min self-serve + transparent credits; invariant list retained), `docs/PRICING.md`, STRATEGY addendum noting the pivot date.
- Tests: plan mapping, credit grant idempotency + no-rollover, spend hooks (marketing blocked at 0, agent overdraft floor), voucher redeem/expiry, price table sanity (3 plans × 10 currencies > 0), gate rename fallout.

---

## WS6 — Attribution & funnel (branch `ws6-funnel`)

- Schema: `FunnelEvent { id, orgId?, anonId?, name, vertical?, utmSource?, utmMedium?, utmCampaign?, props Json, createdAt }` indexed on (name, createdAt) and (orgId). `Org` gains `utmSource/utmMedium/utmCampaign/acqVertical/acqLandingPath` + `AdSpend { id, month, vertical, campaign?, amountMinor, currency }` for the cost-per-lead input.
- Capture: `src/proxy.ts` sets a first-touch cookie (`nudge_attr`, 90d) from `utm_*` + `vertical` + landing path on marketing routes; `/login` signup + org creation copy cookie → Org columns; `landing_view` fired from marketing pages (lightweight server action / route handler beacon, no client SDK).
- Emitter: `src/modules/funnel/index.ts` `trackFunnel(name, {orgId?, anonId?, props})` — fire-and-forget like `recordAudit`. Events: landing_view, signup, pack_chosen, whatsapp_connected, calendar_connected, knowledge_complete, first_inbound, first_agent_reply, first_booking, first_payment_link, first_paid_conversion. "First-of" events deduped via `createMany skipDuplicates` on a unique (orgId, name) partial index — one row per org per milestone. Hook points: wizard actions (WS4), webhook/inbound handler, booking tool, payment link creation, billing webhooks.
- `/admin/funnel` (App Router route, D4 gate): step-conversion table split by vertical × campaign, org counts reaching each milestone, ad-spend entry form → cost per booking-capable org (org with whatsapp_connected + first_booking) per vertical. Correctness first: plain tables, one recharts bar per vertical, no styling pass. Synthetic seed: `scripts/seed-funnel-demo.ts` for review in simulation.
- Tests: attribution cookie parse, first-of dedupe, funnel math (step conversion + CPL), admin gate.

---

## WS7 — Marketing alignment (branch `ws7-marketing`)

- Positioning: "The WhatsApp employee for {vertical}, working in 30 minutes." Root metadata/OG (`layout.tsx`, `page.tsx`, `opengraph-image.tsx`), hero copy, meta-vs-nudge scorecard line, FAQ data, JSON-LD (drop the ₹20,000 package schema), sitemap + robots.
- `/for/[vertical]` (static params from the pack registry): shared lander composed from existing marketing components, copy pulled from a new `marketingCopy` block added to each pack (headline, pains, sample conversation, template showcase, vertical FAQ). Ad sets point here with `?vertical=` prefilled → attribution cookie.
- Remove "we set the whole thing up" everywhere except Pro-tier copy on /pricing; /pricing rebuilt in WS5 gets its final copy pass here. Kill orphaned dead components (`final-cta.tsx`, `whatsapp-card.tsx`, `tilt-card.tsx`, unrendered `lead-form.tsx` — or rewire lead-form into the landers).
- **No em dashes in user-facing copy** — enforced by a copy-lint test over marketing components + pack marketingCopy (regex on `—` in JSX string literals; scoped to `src/components/marketing`, `src/app/(marketing pages)`, `src/modules/verticals`).
- Tests: static-params render test per lander, copy-lint, metadata assertions.

---

## Definition of done (session)

All seven branches merged; `npm test` (full suite incl. new guard/banned-term/copy-lint tests), `tsc`, lint, build green; `npm run preflight:live` passes in simulation (WARN-only rows allowed); all three pack eval sets ≥90% via `npm run eval:agent`; onboarding wizard completable start-to-finish with zero external keys; `/admin/funnel` renders synthetic data split by vertical. PROGRESS.md carries one entry per workstream with founder-manual task lists (Vercel env: `RUNTIME_MODEL`, `FOUNDER_EMAILS`; GitHub secret `CRON_SECRET`; Supabase dashboard settings; billing migration for the paid front_desk org(s)).
