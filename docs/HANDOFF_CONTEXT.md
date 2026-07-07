# Nudge Reach — Project Context Handoff

Paste this into a new Claude window to give it full context. (A new Claude Code
session opened in this repo also auto-reads `CLAUDE.md`, `PROGRESS.md`, and
`docs/` — this file is the current live-state summary on top of that.)

---

## What this is
**Nudge Reach** — a WhatsApp platform for small businesses (Asian SME retail/
services first: India, then Indonesia/Brazil/MENA/etc.). It started as "photo →
AI-generated compliant WhatsApp marketing campaign" and has grown into a full
**WhatsApp CRM + AI agent** platform.

## The business model / positioning (the north star)
Not a tool, a **worker**. AiSensy/WATI sell software (~₹999/mo) where the owner
still writes messages, builds bot flows, and mans the inbox. Nudge sells an
**outcome**: an AI agent that answers customers, qualifies leads, and books —
the owner does nothing. Priced against a **salary** (~₹15k vs a ₹25k human), not
against ₹999 software. One-liner: *"AiSensy gives you tools to run your WhatsApp;
Nudge runs it for you."* Their incumbent weakness: their per-message/per-seat
revenue is cannibalized by a truly autonomous agent — so they're structurally
disincentivized to build it.

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind v4 · Supabase (Postgres, Auth,
Storage) · Prisma ORM · Anthropic API (Claude **Haiku** only, via
`src/lib/model-router`) · Razorpay + Stripe billing · deploy target Vercel.
Code is organized under `src/app` (routes) and `src/modules` (capabilities).

## The 5 non-negotiable rules (enforced in code)
1. Official WhatsApp Cloud API only (no unofficial automation).
2. Consent enforced in code — marketing only to `optedIn` contacts; STOP = permanent opt-out.
3. Runtime AI uses the cheapest tier (Claude Haiku) via `model-router`; a guard
   REFUSES to run opus/fable/mythos at runtime. **No OpenAI anywhere.**
4. Platform modules are channel-agnostic (email is a future product).
5. `SEND_MODE=simulation` makes the whole flow work with mocked Meta responses.

## Current state (as of this handoff)
- **Runs locally**: `npm run build && npx next start -p 3000` (the `next dev`
  server OOMs on this machine — use `next start`). App at http://localhost:3000.
- **Mode**: `SEND_MODE=simulation` — WhatsApp sends & template approvals are
  MOCKED. The **AI agent is real** (calls Haiku). Not yet connected to live WhatsApp.
- **Database**: ONE shared Supabase Postgres project (`lgojsxrljjmkwxawocdk`,
  region ap-southeast-1). Local dev + any deploy + both collaborators use it.
  `npm run db:push` syncs schema; new tables need RLS enabled.
- **GitHub**: https://github.com/CUSTEDLOL/nudge-reach (private). Collaborator
  **DhairyaKakkar** has push access. `main` is the working branch; pull often —
  Dhairya pushes large batches.
- **Deploy**: previously live at nudge-reach.vercel.app but often behind; the
  Vercel production alias has been flaky (needs explicit `vercel alias set` after
  `vercel --prod`). Not the source of truth — GitHub + local are.
- **Test login**: `visheshjain1705+nudgetest@gmail.com` / `NudgeTest!2026`.

## Everything built (feature inventory)
- **AI worker** (real): scoped per-business agent (Settings → WhatsApp assistant);
  tool-calling loop (Milestone 1) — `capture_lead`, `capture_booking_request`,
  `handoff_to_human`; guardrails (on-topic, no hallucination, escalate only for
  real reasons). Tools + loop in `src/modules/agent/` and `src/lib/model-router`.
- **Outbound/marketing**: campaign generator (photo→AI copy→editable+preview),
  template approval (mock/live), consent-gated send queue, results dashboard
  (delivered/read/clicked + cost), template library.
- **CRM/inbox**: shared team inbox, contacts CRM (lead stages, tags, notes),
  audiences, team roles (Owner/Admin/Agent) + invites, audit log.
- **Automations**: no-code rules (trigger → send/tag/wait).
- **Integrations**: Google Calendar OAuth (Milestone 2, recent), outbound
  webhooks (Zapier/n8n), CSV data export, follow-ups config, concierge.
- **Billing**: Razorpay + Stripe, plan tiers, multi-currency/i18n.
- **Onboarding wizard**, WhatsApp connection screen (per-org creds, encrypted).
- **Marketing site**: 3D "Night Shift" scroll landing, pricing, FAQ, legal, waitlist.
- ~372 unit tests passing; production build clean.

## Architecture notes for the AI agent (Milestone 1)
- `src/lib/model-router/index.ts`: `generate()`, `chat()`, and `runAgent()` (the
  capped tool loop). All Haiku, cost-guarded.
- `src/modules/agent/`: `prompt.ts` (per-vertical system prompt + tool guidance +
  guardrails), `reply.ts` (`generateAgentActionReply`), `inbound.ts`
  (`handleInboundMessage` — the single entry for live webhook AND the sim tester),
  `tools/` (typed, zod-validated, tenant-scoped, error-contained).
- Inbound flow: webhook/sim → contact upsert → STOP check → conversation thread →
  automations first → AI agent (with tools) → reply sent → actions recorded.
- Agent quality depends entirely on the business info the owner provides (thin
  info = it defers a lot). Knowledge-base/RAG is a future milestone.

## How to test (local, simulation)
1. http://localhost:3000 → sign in (creds above).
2. **AI agent**: Settings → WhatsApp assistant (on; paste full business info) →
   Conversations → "Test your assistant" → type customer messages. Try: menu
   question (answers), book a table (records a booking + flags for staff),
   catering enquiry (qualifies lead), off-topic (declines).
3. **Campaign**: Campaigns → New → upload a product photo → edit → submit
   (mock-approves) → pick audience → Run → watch the dashboard.
4. Bookings the agent captures currently surface as a flagged ("Needs you")
   conversation + an AI note on the contact (no dedicated /bookings screen yet).

## Open items / next milestones
- **Connect real WhatsApp**: needs Meta developer app + test-number credentials
  (only the founder can create these). See `docs/GO_LIVE_WHATSAPP.md`.
- **Milestone 2**: real calendar booking (Google Calendar — Dhairya started it).
- **Milestone 3**: long-term customer memory + "AI drafts / human approves".
- **Milestone 4**: per-vertical tool packs + no-code agent setup.
- **UX simplification**: app has ~35 routes / 10+ settings pages (AiSensy-level
  complexity) — contradicts the "we run it for you" pitch. Priorities: inbox-first
  owner view; collapse settings to ~3; onboarding that sets it up FOR them; show
  outcomes not tools; hide power features from the SMB owner.
- A `/bookings` screen (so owners see captured bookings to confirm) — not built.
- **Embedded Signup** (self-serve WhatsApp onboarding; needs Meta Tech Provider +
  App Review) — the platform-scale feature, later.

## Gotchas
- Use `next start`, not `next dev` (dev OOMs here).
- Vercel alias needs explicit `vercel alias set <deploy-url> nudge-reach.vercel.app`
  after deploy, and verify authenticated pages (not just unauth 307s).
- Secrets (DB password, Anthropic key) were pasted in chat earlier — rotate before
  real launch.
- Runtime model is locked to Haiku; a guard blocks expensive models.
