# CLAUDE CODE KICKOFF PROMPT — paste this into Claude Code (running Fable)

> Put `CLAUDE.md` at the repo root and the three docs in a `docs/` folder before you run this. Then paste everything below as your first message.

---

You are building **Nudge Reach (WhatsApp)** — the first product of the Nudge B2B AI product studio for Asian SME retail. It turns one retail product photo into a complete, Meta-compliant WhatsApp marketing campaign and sends it to an opted-in contact list over the official WhatsApp Cloud API. The user is a non-technical Indian shop owner; the product bar is "stupidly simple."

**Before writing any code, read these and treat them as the source of truth:**
- `CLAUDE.md` — working rules and stack (already decided; don't re-litigate).
- `docs/PRD.md` — scope, data model, user flows, and the runtime AI generation spec.
- `docs/WHATSAPP_CLOUD_API.md` — integration reference, compliance, and pricing.
- `docs/BUILD_PLAN.md` — the phased plan you will execute.

Then confirm back to me, in a short summary: the stack, the five non-negotiable rules from `CLAUDE.md`, and the Phase 0 acceptance criteria — so I know you've absorbed the context. After that, **begin Phase 0** and proceed phase by phase.

**How I want you to work:**
- One phase at a time, in order. Verify each phase's acceptance criteria before the next. Keep `PROGRESS.md` updated and commit after every phase.
- Enforce the three hard rules in *code*, not just UI: official Cloud API only; marketing sends are consent-gated (`opted_in = true`); runtime AI uses the cheap Haiku-tier model via `lib/model-router` — never Fable/Opus at runtime.
- Build `SEND_MODE=simulation` first so the whole flow is demoable with no WhatsApp Business Account. Add the live Cloud API path behind the same interface.
- Write unit tests for the template-payload builder, the send-payload builder, and the consent gate. Run them before each commit.
- Build platform modules (auth, model-router, messaging, contacts/opt-in, billing stub) as reusable, channel-agnostic pieces — product 2 will be the email channel on the same platform.
- Make the smallest reversible choice when the docs are silent, note it in `PROGRESS.md`, and keep moving. Stop and ask me only before destructive migrations, spending money, or sending to real recipients in live mode.
- Use your vision ability to check the rendered campaign preview against the intent.

**Definition of done (MVP):** a retailer signs in → uploads a product photo → gets a compliant, editable campaign → previews it as a WhatsApp message → imports an opted-in audience → runs the campaign (simulation or live) → sees delivery/read/click stats and an estimated cost — deployed on a public URL.

Start now: read the docs, give me the confirmation summary, then begin Phase 0.

---

## Setup checklist for you (the founder), before/while it builds
1. Create an empty git repo; drop in `CLAUDE.md` and `docs/`.
2. Create a free **Supabase** project (Auth + Postgres + Storage) and a **Vercel** account; have those keys ready for when Phase 0 asks.
3. You do **not** need a WhatsApp Business Account to start — simulation mode covers the demo. When you're ready to send for real, create a **Meta developer app + Business Manager**, add the WhatsApp product, and either complete **Embedded Signup** or generate a system-user token + grab your `WABA_ID` and `PHONE_NUMBER_ID`. Meta gives a test number for early testing.
4. Set `RUNTIME_MODEL` to the cheapest vision-capable Haiku tier so live usage stays cheap. (Fable is doing the *building*; it should never be the app's runtime engine.)
5. Tell Claude Code to deploy to Vercel + Supabase at Phase 5, and capture the live URL — that's what you demo to retailers.
