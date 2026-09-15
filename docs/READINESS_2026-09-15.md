# Are we ready to sell? Production readiness audit, 15 September 2026

**Short answer: the product is ready; the production configuration is not.**
Every screen and every client flow I could drive worked on nudgeagent.app with
zero errors. But five switches are still off, so a paying client today could
not be given an account, could not send a real WhatsApp message, could not pay,
and could not receive a phone call. All five are configuration you set once;
none needs code. One real outage was found and fixed during the audit.

## What was tested, on production, as a real logged-in client

| Area | Result |
|---|---|
| All 33 app routes (dashboard, inbox, leads, AI Front Desk, follow-ups, campaigns, templates, analytics, integrations, 13 settings pages) | Render clean. No console errors, no failed requests, on a paid org and on a Free org |
| AI chat ("Try your AI") | Replies in 3–5 s, stays in character, refuses off-topic |
| AI booking end to end | Asked for confirmation, then booked: "Booking CONFIRMED in calendar", row in the database |
| Teach the AI (add a fact) | Listed immediately |
| Add a contact | Listed immediately, detail page opens |
| Template | Draft saved, edit page opens. Header must be set to "None" or given text |
| Campaign wizard | Content → Audience (10 opted-in) → Review: consent gate, ₹0.99 per message estimate, "Submit for approval". Submission itself not driven headlessly |
| Follow-up automations | Page and validation work ("add a keyword", "add a step"). Trigger cards and step chooser not driven headlessly |
| Inbox | Threads open. Expired thread correctly forces an approved template (24-hour rule). In-window reply not driven headlessly |
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

## The five blockers, in the order to do them

1. **You cannot create a client workspace.** Signup is invite-only and the
   founder admin panel is off because `FOUNDER_EMAILS` is not set in Vercel.
   Set it to both founder emails, redeploy, then create the client in
   `/admin` → Create workspace, on the plan they bought.
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
5. **Invited owners get no email.** `RESEND_API_KEY` is not set, so the
   client must be told to sign up with the exact email you invited. Also
   confirm in Supabase → Authentication → URL Configuration that the Site URL
   is `https://nudgeagent.app` and `https://nudgeagent.app/auth/**` is an
   allowed redirect, or confirmation links point at localhost.

Smaller: set `CRON_SECRET` (Vercel and the GitHub secret) so the cron endpoint
is not open to anyone; Google Calendar and CRMs are simulated in production
until `GOOGLE_*`, `ZOHO_*`, `SALESFORCE_*` keys exist.

All env changes: `vercel env add NAME production` while signed in as
CUSTEDLOL, then `vercel --prod`.

## Margins

After provider cost, Starter keeps about 95%, Growth and Pro about 91% on chat.
Pro at full use of its 100 voice minutes keeps about 81%. Meta message charges
are passed through at cost. The 90% target holds everywhere except a Pro
client who talks on the phone for the full allowance.

## Before the first demo

The Spice Garden test workspace is configured as "BrightSmile Dental" under
AI Front Desk → Setup while its knowledge base is a saree shop. It answers
correctly for a dental clinic, which looks broken in a restaurant demo. Fix
the business name and facts, or reset the demo data, before showing it.

## Recommendation

Do blocker 1 today and blocker 4 tomorrow. With 1 and 2 done a client can be
onboarded and served on WhatsApp. Invoice manually until 3 is set. Sell voice
as "browser and, once the number is live, phone".
