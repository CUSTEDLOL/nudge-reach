# Voice front desk — how it works and how to switch it on

The AI Front Desk answers the business's phone number and makes reminder calls,
with the same knowledge and tools as on WhatsApp. Every call lands in the inbox
as a transcript. Design: `docs/superpowers/specs/2026-08-29-voice-and-crm-design.md` (Part A).

## The call flow
1. A customer dials the clinic's number → carrier → ElevenLabs.
2. ElevenLabs asks us who is calling: `POST /api/voice/initiation` (header
   `x-nudge-voice-secret`). We resolve the dialled number to the org and return
   that business's prompt (knowledge digest + tone + phone manners), opener,
   language and voice for this one call.
3. During the call the agent uses webhook tools — `POST /api/voice/tools/{name}`
   with `Authorization: Bearer VOICE_TOOLS_SECRET` — which run the same handlers
   as the WhatsApp agent: `capture_booking_request`, `capture_lead`, `ask_owner`,
   `send_payment_link`. Hand-off is ElevenLabs' `transfer_to_number` to the
   number in Settings → Voice.
4. After hang-up ElevenLabs posts the transcript to `POST /api/voice/post-call`
   (HMAC `elevenlabs-signature`). We file it: contact, a `voice` conversation,
   one message per turn, a `VoiceCall` row (duration, summary, outcome), the
   `call.completed` outbound webhook.
5. Reminder calls: the cron tick (`tickReminderCalls`) calls confirmed bookings
   90–150 minutes before their time for orgs that opted in
   (Settings → Voice → Reminder calls), 09:00–20:00 local, never to opted-out
   contacts.

## Test mode
Without ElevenLabs keys, or for an org in test mode, the simulation driver is
used: outbound calls return a fake id and Settings → Voice offers **Simulate a
call**, which drops a scripted transcript into the inbox.

## One-time setup (platform)
1. ElevenLabs workspace with SIP trunking and post-call webhooks enabled.
2. `.env.local` / Vercel: `ELEVENLABS_API_KEY`, `VOICE_TOOLS_SECRET`,
   `VOICE_INITIATION_SECRET` (any long random strings), `ELEVENLABS_LLM`
   (default `claude-haiku-4-5`; Opus/Fable are rejected by the guard).
3. Run `scripts/voice-setup.ts` (command in the file header). It creates the
   shared agent with the pinned LLM, system tools and our webhook tools, and
   prints `ELEVENLABS_AGENT_ID` → add it to the env.
4. ElevenLabs → Agents → Settings → Post-call webhooks → add
   `https://nudgeagent.app/api/voice/post-call`; copy the secret into
   `ELEVENLABS_WEBHOOK_SECRET`. Redeploy.

## Per client (number)
- **India — Exotel:** KYC for the client's city, ask hello@exotel.com to enable
  vSIP trunking, buy an Exophone. Point the trunk at
  `sip.rtc.elevenlabs.io:5060` (TLS). In ElevenLabs → Phone numbers → *Import
  from SIP trunk* (E.164, TLS, digest auth) → assign the Nudge agent → note the
  phone-number id.
- **SG / MY / UAE — Twilio:** buy a number, connect it in ElevenLabs → Phone
  numbers (native Twilio integration) → assign the Nudge agent.
- Nudge → Settings → Voice → *Add or update a number*: the number, carrier,
  language (English or Hindi/Hinglish), transfer number, the ElevenLabs
  phone-number id (needed for outbound reminder calls).

## Call minutes (the spend ceiling)

Every package includes call minutes per calendar month. When they run out the
AI **stops answering that org's number**: the initiation webhook returns 402
and hands back no agent, so the call never becomes a billable conversation.
Outbound reminder calls draw on the same allowance. Each call rounds up to a
whole minute; the month resets on the 1st. WhatsApp is unaffected either way.

- **Per plan:** `PlanLimits.voiceMinutesPerMonth` in `modules/billing/plans.ts`
  — 100 on AI Front Desk, 0 on tiers without voice, `null` = unlimited
  (Enterprise, where the allowance is a bespoke term).
- **Per client:** `npm run voice:minutes -- --org <id-or-owner-email> --minutes 300`
  overrides the plan for one org; `--minutes plan` clears the override.
  The client sees the meter on Settings → Voice but cannot raise it.
- **Per call:** the shared agent is created with `max_duration_seconds: 480`
  (8 minutes) and a 10-second silence timeout, so one forgotten open line
  can cost at most ~8 minutes.

Sizing a package: at roughly ₹9–12 (~S$0.15) an all-in minute, 100 minutes
costs on the order of ₹1,000. Check `docs/PRICING.md` before quoting.

## Compliance
- Inbound answering: unrestricted.
- Outbound reminder / no-show calls are transactional: only to customers with a
  booking, inside calling hours, never to `optedOutAt` contacts. No promotional
  calls, ever (DND rules).
- The runtime model on calls is pinned by `ELEVENLABS_LLM` and guard-checked at
  boot and in the setup script.

## Pricing
Cost ≈ ₹8.5–12/min all-in. Sold as the **Voice add-on**: ₹5,999/mo including
300 minutes, ₹15/min after (SG S$199 · MY RM399 · AE AED 299 with the same
bundle). Never standalone — it is the flagship employee picking up the phone.
