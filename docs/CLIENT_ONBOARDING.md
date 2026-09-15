# Client onboarding, start to finish

The promise: the client talks to us twice, gives us one number and one hour,
and their AI front desk is answering real customers within two working days.
Voice follows when the phone number lands. Nothing below is aspirational:
every step names the screen or command that does it today.

## The shape of it

| When | What happens | Who does it | Time |
|---|---|---|---|
| Day 0, demo | Sell, pick the plan, collect the intake | Founder + client | 30 min |
| Day 0, same day | Workspace created, owner invited, account set up | Founder, then client | 10 min |
| Day 0, setup call | Train the AI, connect the number, connect the calendar, test a conversation | Founder with the client on screen share | 60 to 90 min |
| Day 0 to 1 | Number verified, display name reviewed, first templates approved by Meta | Meta, automatic | minutes to a day |
| Day 1 or 2 | Go live: real customers, real replies | Founder flips the switch, client confirms | 5 min |
| Day 1 to 5 | Phone number arrives, voice goes live | Carrier, then founder | 10 min of work, days of waiting |
| Day 7 | Review call: first week's conversations, follow-ups on, first campaign | Founder + client | 30 min |

## Day 0, the demo (30 minutes)

Book through the site or Cal.com. Show the Spice Garden workspace, then the
client's own business: type their most common customer question into Try
your AI with a couple of their facts pasted in. Close on the plan:

- Entry: answers questions only.
- Starter: answers, captures leads, inbox, campaigns.
- Growth: adds bookings, payment links, follow-ups, CRM sync. Most clinics.
- Pro: adds voice.

Collect the intake before the call ends. Ten minutes, all of it goes straight
into the product on the setup call:

1. Business name, city, timezone, currency, languages customers write in.
2. Owner's email, the phone they check, the receptionist's mobile (voice transfers).
3. The WhatsApp number they will use. A fresh SIM or landline that is not on
   the WhatsApp app is fastest. Migrating their existing number means
   deleting it from the WhatsApp app first, so warn them.
4. Hours, address, parking. Services or menu with prices. The five questions
   customers ask most. Booking rules: slot length, deposit amount, cancellation.
5. Payment habits: UPI, cards, cash. Whether they take deposits today.
6. Their Google Calendar account, and their CRM if any (Zoho or Salesforce).
7. Tone: formal or friendly, and anything the AI must never say or promise.

## Day 0, workspace and account (10 minutes)

Founder, on nudgeagent.app/admin:

1. Create workspace: name, country, the plan they bought, the owner's email.
   It starts in test mode on purpose. Nothing reaches a customer yet.
2. Send the owner the sign-up link the page shows
   (`https://nudgeagent.app/login?invited=1`). They sign up with that exact
   email and choose a password. They land in their workspace as owner.
3. The client sees a two-step welcome (goal, then business identity), then
   the dashboard with a six-item checklist that mirrors this document.

## Day 0, the setup call (60 to 90 minutes, screen share)

Do it with them, not for them. They should see every screen once.

**1. Teach the AI (25 min).** AI Front Desk → Training.
Fastest order: Find my listing pulls hours, address and reviews from their
Google Business Profile. Upload menu / PDF turns a price list into facts.
Then Teach it with the questionnaire, Interview me mode, fills the gaps:
services, pricing, hours, location, policies, payments. Every fact shows in
the library; the client approves them. Nothing goes live unapproved.

**2. Try a customer conversation (10 min).** Inbox → Try your AI.
Ask the five common questions from the intake, a booking, and one thing the
AI cannot know. It should answer the first five from the facts, book the
sixth, and say it will check with the team on the last. That last one appears
under Needs your answer; the client answers it once and the AI learns it.

**3. Connect WhatsApp (20 min, then Meta's clock).** Two halves, and only
the second is inside Nudge.

*In Meta's WhatsApp Manager (founder, 10 min):* add the client's number to
Nudge's WhatsApp Business Account, choose the display name, and pick SMS or
voice for the verification code. The code arrives on the client's phone;
they read it out, you enter it. Meta then reviews the display name, usually
the same day. Nudge does not do this part: number registration and the
one-time code live in Meta's dashboard until we become a Meta Tech Provider
with Embedded Signup.

*In Nudge (founder, 5 min):* /admin → the client's workspace →
Integrations → Connect a number. Enter the display name, the WhatsApp
Business Account ID, the Phone Number ID and the permanent token. Nudge
checks with Meta that the number really belongs to that account before it
saves anything, stores the token encrypted, and writes an audit row. Until
go-live the workspace stays in test mode. Clients with their own Meta app
can do the same from Settings → WhatsApp → Advanced: connect manually.

**4. Connect the calendar (5 min).** Integrations → Connect calendar.
The client signs in to Google once. From then on the AI checks real
availability and books into their real calendar. If the workspace still
shows the test calendar, the Google keys are not set on the platform yet.

**5. Bring in customers (10 min).** Leads → Import contacts.
Only people who have agreed to hear from them on WhatsApp. Consent is
enforced in code: campaigns and follow-ups never reach anyone else, and STOP
always wins. A CSV with name, phone and a consent column is enough.

**6. Templates (10 min, then Meta's clock).** Campaigns → Message templates.
Submit two on the call: a booking reminder and a follow-up. Meta approves
most within the hour, occasionally up to a day. Follow-ups and reminders wait
for an approved template; they cannot run without one.

**7. Follow-up plan (5 min).** Follow-ups. Show the defaults: reminder before
a booking, nudge after a quiet lead, review request after a visit. Leave them
paused until go-live.

## Day 1 or 2, go live (5 minutes)

Preconditions: number verified, display name approved, at least one template
approved, facts approved. Founder flips the workspace to live from
/admin → Controls. Client sends one message from their own phone to the
business number and watches the AI reply in their inbox. Turn follow-ups on.
From this moment the AI answers customers, captures leads, books, sends
payment links and chases quiet leads on its own.

Note on volume: until Nudge's Meta Business Verification is complete, Meta
caps business-initiated conversations at 250 a day per number. Replies to
customers are not capped. Enough for the first clients; do the verification
before the fifth.

## Day 1 to 5, voice (Pro plan)

Start the carrier paperwork on Day 0, it is the slowest part.

- India: Exotel account, KYC for the client's city, ask for vSIP trunking,
  buy an Exophone. Two to five working days.
- Singapore, Malaysia, UAE: a Twilio number. Same day to three days,
  depending on the country's address and business-document checks.

When the number arrives, ten minutes of work: import it into ElevenLabs and
assign the Nudge agent, then in the client's Settings → Voice add the
number, language, and the transfer number from the intake. Test with the
client on the phone: hours, a price, a booking, "can I speak to someone".
The transfer must ring the receptionist. Reminder calls stay off unless they
ask. The plan includes 100 minutes a month; calls stop when they run out,
WhatsApp is unaffected.

Until the number lands, the client can hear the voice agent from
Settings → Voice → Call your AI in the browser.

## Integrations, when each is ready

| Integration | Client action | Ready |
|---|---|---|
| WhatsApp number | Verify the code Meta sends | Day 0, live Day 1 or 2 |
| Google Calendar | One Google sign-in | Day 0, once platform keys exist |
| Payment links (UPI, cards) | None, the AI sends them | Day 1 or 2, once Razorpay keys exist |
| Zoho or Salesforce CRM | One sign-in on Integrations | Day 0, once platform keys exist |
| Website WhatsApp button | Paste one snippet from Settings → Website widget | Day 0 |
| Webhooks, REST API (Growth+) | Create a key on Integrations | Day 0 |
| Voice number (Pro) | Answer the carrier's KYC | Day 1 to 5 |

## Day 7, the review call (30 minutes)

Open Analytics together: conversations handled, bookings captured, leads
chased, questions the AI could not answer. Answer those questions in Training
so they never come back. Send the first campaign to the opted-in list.
Confirm the invoice. Ask for the referral.

## What the founder must have in place before the first client

Once, not per client: run `scripts/prod-env-setup.sh` (admin panel, cron
secret, optional Razorpay and Resend keys); a permanent Meta System User
token; Google OAuth keys if calendar is promised; Zoho or Salesforce app keys
if CRM sync is promised. Details in `docs/READINESS_2026-09-15.md` and
`docs/CLIENT_GO_LIVE_VOICE_CRM.md`.
