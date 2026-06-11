# CLAUDE.md — Nudge Reach (WhatsApp)

This file is read automatically at the start of every Claude Code session. Keep it short; it is the contract for how you work in this repo.

## What this is
Nudge Reach is the first product of the **Nudge** B2B AI product studio for Asian SME retail. It turns a single retail product photo into a complete, Meta-policy-compliant WhatsApp **marketing** campaign and sends it to an opted-in contact list over the **official WhatsApp Cloud API**.

The audience is non-technical shop owners in India. The bar is "stupidly simple": a boutique owner with no marketing skill uploads one photo and gets a ready-to-send campaign. Ease of use beats feature count, always.

## Non-negotiable rules
1. **Official Cloud API only.** Never use unofficial WhatsApp automation, browser bots, or anything that bypasses Meta's API. That gets numbers banned and would kill the business. If a task seems to require bypassing the API, stop and flag it.
2. **Consent is enforced in code, not just UI.** Marketing messages may only be sent to contacts with `opted_in = true`. Every send path checks this. Opt-outs are honored permanently.
3. **Never call an expensive model at runtime.** Fable (you, in Claude Code) is the *build-time* engineer. The deployed app must call the cheapest vision-capable tier (default: Claude Haiku) through the `lib/model-router`. No app code ever hardcodes Fable/Opus for runtime generation. This is what keeps unit economics survivable after the build.
4. **Build for reuse.** Auth, contacts/opt-in, the model-router, the messaging layer, and billing are *platform* modules that product 2 (email) will reuse. Keep them generic and cleanly separated from the WhatsApp-specific code.
5. **Simulation mode must always work.** The founder has no WhatsApp Business Account on day one. With `SEND_MODE=simulation` the entire flow — generate → preview → "submit template" → "send" → dashboard — works end to end with mocked Meta responses, so it is demoable to a retailer immediately.

## Stack (decided — do not re-litigate)
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres + Auth + Storage (product photos)
- Prisma ORM
- Background jobs / send queue: Inngest (or a Postgres-backed queue + Vercel Cron if Inngest setup stalls)
- Deploy target: Vercel (app) + Supabase (data)
- Runtime LLM: Anthropic API via `lib/model-router`, default model = cheapest vision-capable Haiku tier, configurable by env

## How to work in this repo
- Read `docs/PRD.md`, `docs/WHATSAPP_CLOUD_API.md`, and `docs/BUILD_PLAN.md` before writing code.
- Work **one phase at a time** per `docs/BUILD_PLAN.md`. Do not jump ahead.
- After each phase: run the build, run tests, update `PROGRESS.md`, and commit with a clear message.
- Write unit tests for (a) the WhatsApp template-payload builder, (b) the send payload builder, and (c) the consent gate. These are the parts that cause real-world breakage.
- Prefer deterministic code over AI at runtime wherever possible (e.g., image framing/branding with canvas/sharp, not generative image models).
- Keep secrets in `.env.local`; never commit them. Maintain `.env.example`.
- When you hit a decision the docs don't cover, make the simplest reversible choice, note it in `PROGRESS.md`, and keep moving.

## Definition of done for the MVP
A retailer can: sign in → upload a product photo → get a generated compliant campaign → edit it → preview it as a WhatsApp message → import an opted-in contact list → run the campaign (live or simulated) → see delivery/read/click stats and an estimated cost. Deployed and reachable on a URL.
