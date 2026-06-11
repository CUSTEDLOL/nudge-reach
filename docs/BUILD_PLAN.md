# BUILD_PLAN — Nudge Reach (WhatsApp)

Work top to bottom. Finish a phase, verify its acceptance criteria, update `PROGRESS.md`, commit, then move on. Don't start a later phase early. If blocked, note it and continue with the next unblocked task.

## Phase 0 — Scaffold (target: short)
- Next.js (App Router) + TypeScript + Tailwind. Supabase project wired (Auth + Postgres + Storage). Prisma initialized against Supabase Postgres.
- `.env.example` with every variable; `lib/env.ts` validates env at boot.
- `CLAUDE.md` already present; create `PROGRESS.md` and `README.md`.
- A single signed-in "Hello, org" page proving auth + DB round-trip.
- **Done when:** app builds, a user can sign in, and an Org row is created for them.

## Phase 1 — Platform modules (reusable across future products)
- `lib/model-router`: one function `generate({ system, prompt, image?, maxTokens })` that calls the Anthropic API with the cheap default model (Haiku tier, vision-capable), configurable via `RUNTIME_MODEL` env. Never references Fable/Opus.
- `lib/messaging`: a channel-agnostic interface `sendMessage(channel, payload)` with a `whatsapp` driver (live + simulation) behind it. Designed so an `email` driver slots in later.
- Contacts + opt-in + Audiences modules with the consent gate as a pure, unit-tested function `canSendMarketing(contact): boolean`.
- Billing stub (`lib/billing`) — interface only, no real payments.
- **Done when:** model-router returns text for a test prompt; `canSendMarketing` is unit-tested; contacts/audiences CRUD works.

## Phase 2 — Generate (the wedge)
- Upload a product photo to Supabase Storage, or accept a text description.
- "Generate campaign" calls `model-router` per `docs/PRD.md §7`, parses JSON defensively, repairs missing `{{1}}` / opt-out footer.
- Editable campaign fields + a live WhatsApp-style preview component (generic chat styling — do not copy WhatsApp's exact logo/branding).
- **Done when:** a photo or description reliably yields an editable, previewable campaign, and the consent/format guardrails are unit-tested.

## Phase 3 — Templates & approval
- Build the Meta `MARKETING` template payload from the campaign (unit-test the builder against the example in `docs/WHATSAPP_CLOUD_API.md`).
- Submit for approval (live) or mock-approve (simulation). Track status via webhook + polling fallback; show rejection reasons with edit-and-resubmit.
- WhatsApp connection screen: Embedded Signup if feasible, else manual `WABA_ID` / `PHONE_NUMBER_ID` / token entry (token encrypted at rest).
- **Done when:** a campaign produces a valid template payload and reaches APPROVED in simulation; live submission works against a Meta test number if credentials are present.

## Phase 4 — Send & track
- Consent-gated, rate-limited send queue (Inngest, or Postgres queue + cron). Live driver hits the Cloud API; simulation driver emits realistic status events on a timer.
- Webhook endpoint: signature-verified, idempotent; updates Message status (sent/delivered/read/failed) and detects inbound STOP → opt-out.
- Campaign dashboard: sent / delivered / read / clicked, plus estimated and (live) actual cost.
- **Done when:** running a campaign in simulation fills the dashboard end to end; in live mode (if connected) real statuses flow in via webhook.

## Phase 5 — Polish, demo, deploy
- Cost estimator UI with the configurable India rate; empty states and error copy written in the interface's voice (see frontend-design guidance).
- "Demo retailer" seed: one product, a sample audience, a pre-generated campaign, so the app is instantly demoable.
- Deploy app to Vercel, DB/storage on Supabase; document setup in README.
- **Done when:** a stranger can hit the URL, sign in, and complete the full flow in simulation mode.

## Working discipline (important for a long autonomous run)
- Commit after every phase with a descriptive message; keep `PROGRESS.md` current (what's done, decisions made, what's next).
- Write tests for the three breakage-prone pieces: template payload builder, send payload builder, consent gate. Run them before each commit.
- Use your vision ability to check the rendered preview against the design intent.
- Prefer the smallest reversible choice when the docs are silent; record it. Don't stall asking for permission on low-stakes calls.
- Stop and ask the human before: deleting data/migrations destructively, spending money, or anything that would touch real recipients in live mode.
