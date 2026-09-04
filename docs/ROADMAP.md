# ROADMAP — the AI Front Desk grows more hands (decided 2026-08-29)

Founders' decision. The employee we sell keeps its story — *it runs your front
desk* — and gains channels and hands: it answers Instagram/Facebook/TikTok as
well as WhatsApp, picks up the phone, tracks and places Shopify orders, writes to
the CRM, and exposes an API. Marketing still leads with the AI Front Desk; none
of this is sold as a channel list. Every item must keep the 7 invariants
(`AGENTS.md`), demo in simulation, and reuse the one agent + one knowledge base.

Sizing is for Fable + Codex in parallel with founder paperwork. ~12 weeks total.

| # | Workstream | Weeks | External gate (founder) | Scope of "done" |
|---|---|---|---|---|
| 0 | **Go-live + Meta paperwork** | now | Permanent token; Business Verification; **App Review in one submission**: `whatsapp_business_messaging`, `whatsapp_business_management` (Advanced), `instagram_business_basic`, `instagram_business_manage_messages`, `pages_messaging`; Tech Provider enrolment | First paying client live; review filed this week — it gates #2 |
| 1 | **Channel core + AI copilot + summaries** | 1–2 | none | `Conversation.channel` + a `ChannelAccount` model (WhatsApp becomes one row); driver registry generalised (`resolveDriver(channel, mode)` already exists); 24h-window rule per channel. Copilot: "suggest reply", "summarise thread", "next action" in the inbox composer and hand-off panel, via the router (Sonnet). Summaries stored per conversation, shown in inbox list + daily owner digest |
| 2 | **Developer API v1** | 1 | none | REST under `/api/v1` with the existing API keys: contacts (CRUD + consent), conversations, messages (send: free-form inside window, template outside), bookings, templates, webhooks (existing). Per-key rate limit, org scoping via key, OpenAPI page in Integrations. Simulation-safe |
| 3 | **Instagram + Facebook Messenger** | 2 | App Review (Advanced Access) for clients' accounts; a test IG professional account + Page meanwhile | Meta Messenger Platform webhooks (`messages`, `messaging_postbacks`, `messaging_referrals`) → same inbound pipeline → same agent; send via IG/Page APIs; 24h window + human-agent tag; IG comment-to-DM optional; ad `referral` captured for attribution (also on WhatsApp). Inbox shows channel chips |
| 4 | **Shopify** | 2–3 | Shopify Partner account + dev store; app listing later | OAuth partner app; `orders/*` + `checkouts/*` webhooks → order-tracking replies (utility templates); agent tools: `lookup_order`, `create_draft_order` (draft order → checkout/invoice link = "placing" an order in chat), product lookup from the catalog for grounded answers; abandoned-checkout recovery gated on the store's marketing-consent tick (invariant 2) |
| 5 | **CRM integrations** | 3 (1 each) | Zoho CRM + Salesforce developer orgs (HubSpot if asked) | OAuth per org; upsert contact/lead on first inbound; log conversation summary + booking + payment as activities; field mapping kept minimal (name, phone, stage, source, last summary); outbound webhooks remain the generic path |
| 6 | **Voice — inbound answering + outbound reminders** | 3–4 | Telephony vendor + Indian DID with KYC (Exotel or Twilio); STT/TTS vendor (or a bundled voice-agent platform); per-minute cost model in pricing | Same knowledge base and tools (`capture_booking_request`, `handoff_to_human`, payment link by SMS/WhatsApp); call transcript lands in the inbox as a conversation (`channel = voice`); reminder/no-show calls as an automation step; runtime LLM stays on the router (invariant 3); simulation driver plays scripted calls |
| 7 | **TikTok DMs** | 1 (after approval) | **Partner-gated**: apply to TikTok for Business *Messaging Partners*; no self-serve DM API exists | Business Messaging API webhooks + send, mapped onto the channel core from #1. Ships only if/when TikTok approves |

## Order and why
1. **#0 first** — nothing else earns money until a client is live, and App Review
   (weeks) gates #3; file it this week.
2. **#1 before any channel** — adding Instagram/voice to a WhatsApp-only data
   model twice is a rewrite; the channel core makes #3, #6, #7 additive.
3. **#2 alongside #1** — zero external dependencies, unblocks partners/resellers.
4. **#3 as soon as Meta grants access** — the beachhead's lead source.
5. **#4 and #5 next** — both need founder accounts; both are integrations on the
   agent's tool layer, not new brains.
6. **#6 last of the big ones** — highest cost and complexity; do it on a working
   multi-channel core with pricing for minutes settled first.
7. **#7 when approved** — apply now, build later.

## Guardrails that do not move
- One agent, one knowledge base, one booking/payment tool set across channels.
- Consent + 24h-window rules enforced per channel in code; templates outside the
  window; opt-outs permanent across channels.
- Runtime model through `lib/model-router` only; voice vendors do STT/TTS, not
  the thinking.
- Every workstream ships a simulation driver so `/demo` and fresh signups stay
  mocked, plus tests for the payload builders and gates.
- Marketing copy leads with the employee and its outcomes, never "35 channels".

Each workstream gets its own implementation plan in `docs/plans/` when it starts.
