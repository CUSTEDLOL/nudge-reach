# Are we ready to sell? Production readiness audit, 15 September 2026

**Short answer: the product is ready; four external accounts are not connected.**
Every screen and every client flow worked on nudgeagent.app with zero errors,
including campaign submission, a keyword automation, an in-window inbox reply
and an end-to-end AI booking. Two real defects were found and fixed the same
day (the cron outage below, and invited owners having no way to set a
password). The founder admin flow that creates a client workspace was
exercised against the live database and works. What remains is a one-line
script for two Vercel switches, plus the Meta token, payment keys, a phone
number and an email key that only the account holders can obtain.

## Done on 15 September

- Cron outage fixed (table pushed, heartbeat made non-fatal, workflow green).
- Invited owners can now set a password: invite emails link to
  `/login?invited=1`, which reveals the sign-up form while open signup stays
  closed; the server still refuses anyone without a pending invite.
- Founder create-workspace verified against the live database: Growth plan,
  INR, Asia/Kolkata, test mode, pending owner, OWNER invite, duplicate refused.
- Spice Garden demo workspace made coherent: restaurant identity, 12
  restaurant facts, 13 stale test questions dismissed. Verified: the AI now
  quotes the private room for 20 and tandoori prawns at ₹650.
- `scripts/prod-env-setup.sh` written for the two Vercel switches.

## What was tested, on production, as a real logged-in client

| Area | Result |
|---|---|
| All 33 app routes (dashboard, inbox, leads, AI Front Desk, follow-ups, campaigns, templates, analytics, integrations, 13 settings pages) | Render clean. No console errors, no failed requests, on a paid org and on a Free org |
| AI chat ("Try your AI") | Replies in 3–5 s, stays in character, refuses off-topic |
| AI booking end to end | Asked for confirmation, then booked: "Booking CONFIRMED in calendar", row in the database |
| Teach the AI (add a fact) | Listed immediately |
| Add a contact | Listed immediately, detail page opens |
| Template | Draft saved, edit page opens. Header must be set to "None" or given text |
| Campaign wizard | Content → Audience (10 opted-in) → Review: consent gate, ₹0.99 per message estimate → submitted: "In review · Waiting for Meta's approval" |
| Follow-up automations | Keyword trigger + "Send message" step created: "Automation created" |
| Inbox | Expired thread correctly forces an approved template (24-hour rule). With the window open, a free-form owner reply sends and appears in the thread |
| Team invite | "They'll join automatically when they sign up with this email" |
| WhatsApp test connection | Reports test mode (see blocker 2) |
| CRM (Zoho, simulated) | Connect, sync, disconnect all work |
| API key | Created, shown once |
| Voice | Simulated call registers against the 100-minute cap. Real browser calls verified by you on 11 September; three tools proven against production on 11 September |
| Settings, notifications, analytics ranges | Save and switch cleanly |
| Public site: Get Access form | Lead lands in the database and in the founders' sheet |
| Public site: Book a Demo | Cal.com embed opens |
| Mobile | Full pass on 9 September, live |

Every test record was deleted afterwards.

## Found and fixed: the cron had been failing for three days

The 10-minute cron that sends follow-ups, reminders, reminder calls, CRM sync,
trial expiry and campaign queues had returned an error on every run since
12 September. Cause: a monitoring table added by the control-room work was
never created in the production database, because deploys do not migrate the
database. The work itself was still running; only the final heartbeat write
failed, but the control room showed no pulse and every GitHub run was red.
Fixed today: table created, endpoint returns 200, workflow green, and a
heartbeat failure can no longer mark a good tick as failed.

Rule from now on: after any change to `prisma/schema.prisma`, run
`npx prisma db push` against production. Nothing does it for you.

## What is left, in the order to do them

Run once, signed in to Vercel as CUSTEDLOL: `bash scripts/prod-env-setup.sh`.
It sets `FOUNDER_EMAILS` (turns on `/admin`) and a generated `CRON_SECRET`
in Vercel and GitHub, optionally takes Razorpay and Resend keys, and
redeploys. (I could not push these myself: the tool refuses to write
environment variables to a remote service.)

1. **You cannot create a client workspace until the script runs.** Signup is
   invite-only and the founder admin panel is off because `FOUNDER_EMAILS` is
   not set. After the script: `/admin` → Create workspace, on the plan they
   bought, with the owner's email; send them the link the page shows.
2. **No real WhatsApp message can leave.** Production runs in test mode
   (`SEND_MODE=simulation`) and the connected number still uses a 24-hour
   Meta token that has expired. Generate a permanent System User token in
   Meta Business, connect the client's number from `/admin` → their org →
   Integrations, then set `SEND_MODE=live` and redeploy. Demo and new orgs
   stay mocked on their own.
3. **Clients cannot pay in the app.** Billing shows "Payments off" because no
   Razorpay or Stripe keys are set. Either invoice the first clients manually,
   or add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
4. **No phone number for voice.** Voice works from the browser button only.
   India: Exotel account, KYC, vSIP trunk. Elsewhere: a Twilio number.
   Steps are in `docs/CLIENT_GO_LIVE_VOICE_CRM.md`. Start this first; KYC is
   the long pole.
5. **Invited owners get no email** until `RESEND_API_KEY` and `EMAIL_FROM`
   are set (the script prompts for them). Until then, send the client
   `https://nudgeagent.app/login?invited=1` yourself and tell them to sign up
   with the exact email you invited. Also confirm in Supabase →
   Authentication → URL Configuration that the Site URL is
   `https://nudgeagent.app` and `https://nudgeagent.app/auth/**` is an
   allowed redirect, or confirmation links point at localhost.

Google Calendar and CRMs are simulated in production until `GOOGLE_*`,
`ZOHO_*`, `SALESFORCE_*` keys exist.

## Margins

After provider cost, Starter keeps about 95%, Growth and Pro about 91% on chat.
Pro at full use of its 100 voice minutes keeps about 81%. Meta message charges
are passed through at cost. The 90% target holds everywhere except a Pro
client who talks on the phone for the full allowance.

## Before the first demo

Done: the Spice Garden workspace now has one identity (a North Indian
restaurant on Brigade Road) with matching facts, and the AI answers from them.

## Recommendation

Run the script today and start the phone-number paperwork tomorrow. With the
script run and the Meta token in place, a client can be onboarded and served
on WhatsApp. Invoice manually until Razorpay keys exist. Sell voice as
"browser and, once the number is live, phone".
