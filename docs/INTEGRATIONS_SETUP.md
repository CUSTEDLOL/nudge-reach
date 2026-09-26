# Turning on every integration for real

Written 26 Sep 2026, when production went live. Each section is one provider:
what it unlocks, the exact values to use, and where the keys go.

**Check your work at https://nudgeagent.app/admin/integrations.** It calls
every provider with production's real keys each time it loads and says, per
integration, *Working*, *Needs attention*, *Broken* or *Not set up*, with the
fix. Reload it after each step.

**Where platform keys go:** Vercel → nudge-reach → Settings → Environment
Variables → Production → add → then **Redeploy** (keys only take effect after a
deploy). Or paste the values to Claude in the terminal and ask it to set them;
it sets them with the Vercel CLI and runs the check.

Two kinds of integration:

- **Per client, set up inside the client's workspace:** WhatsApp and Razorpay.
  The client's own accounts, so their messages and their money are theirs.
- **Platform, set up once by you in Vercel:** Google, Zoho, Salesforce, email,
  voice numbers, Nudge's own billing.

---

## Per client

### 1. WhatsApp (the client's workspace → Settings → WhatsApp)

1. **Permanent token.** Meta Business Settings → Users → System users → Add
   (Admin role) → Assign assets: the app (Full control) and the WhatsApp
   account (Full control) → Generate new token → Expiration **Never** →
   permissions `whatsapp_business_messaging`, `whatsapp_business_management`,
   `business_management`. Temporary 24-hour tokens stop working overnight; the
   checker flags them.
2. **Save the Meta app:** App ID and App Secret (Meta → App settings → Basic).
3. **Connect the number:** display name, WhatsApp Business Account ID, Phone
   Number ID, the permanent token. Nudge asks Meta first and saves nothing Meta
   rejects. This turns the workspace live, removes any test calendar and sends
   the follow-up templates to Meta for approval.
4. **Webhook:** copy the Callback URL and Verify token shown on the page into
   Meta → WhatsApp → Configuration → Edit → Verify and save. Subscribe to
   `messages` and `message_template_status_update`.
5. **Subscribe the app to the WhatsApp account** (the step that silently broke
   inbound in July): `POST /{WABA_ID}/subscribed_apps` with the token. The
   checker shows *Broken* until it is done.
6. Send a real WhatsApp message from another phone. The page shows "Received".

### 2. Razorpay, customer deposits (the client's workspace → Apps → Razorpay)

The money goes straight to the client. Nudge never holds it.

1. Razorpay → Account & Settings → API Keys → Generate **Live** key (the account
   must be activated by Razorpay; test keys work but move no money).
2. Paste Key ID and Key Secret → Connect Razorpay. Razorpay verifies them first.
3. Razorpay → Account & Settings → Webhooks → Add new webhook: paste the
   **Webhook URL** and **Secret** the panel shows, tick `payment_link.paid`,
   save. The panel shows "Receiving" after the first event.

INR only. A workspace billing in another currency never gets a payment link.

---

## Platform (once, in Vercel)

### 3. Google Calendar

1. console.cloud.google.com → create a project "Nudge" → APIs & Services →
   Library → enable **Google Calendar API**.
2. OAuth consent screen → External → app name Nudge, support email, authorized
   domain `nudgeagent.app`, privacy policy `https://nudgeagent.app/privacy`,
   terms `https://nudgeagent.app/terms`. Scopes: `calendar.events`,
   `calendar.readonly`, `userinfo.email`.
3. **Publish the app.** In "Testing" Google logs every client out after 7 days
   and caps you at 100 test users. Calendar scopes are *sensitive*, so
   publishing needs Google's verification (a short screen recording of the
   connect flow); start it now, it takes days.
4. Credentials → Create credentials → OAuth client ID → Web application →
   Authorized redirect URI **exactly**:
   `https://nudgeagent.app/api/integrations/google/callback`
5. Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. (`GOOGLE_OAUTH_REDIRECT_URI`
   is no longer needed; it defaults to the URI above.)

### 4. "Find my listing" (Google Places)

Same Google project → enable **Places API (New)** → Credentials → Create API
key → restrict it to Places API (New). Google Cloud needs a billing account on
the project, even though the lookups Nudge makes fall in the free tier.
Vercel: `GOOGLE_MAPS_API_KEY`.

### 5. Zoho CRM

1. **api-console.zoho.in** (the India console) → Add client → Server-based
   Applications → name Nudge, homepage `https://nudgeagent.app`, redirect
   `https://nudgeagent.app/api/integrations/crm/zoho/callback`.
2. Client → Settings → turn on **multi-DC** so clients on zoho.com and zoho.eu
   can connect too.
3. Vercel: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`.

### 6. Salesforce

1. Setup → App Manager → New Connected App (or External Client App) → enable
   OAuth → callback `https://nudgeagent.app/api/integrations/crm/salesforce/callback`
   → scopes "Manage user data via APIs (api)" and "Perform requests at any time
   (refresh_token, offline_access)" → require the secret for the web-server flow
   → **turn off "Require PKCE"** (Nudge's flow does not send it).
2. Vercel: `SALESFORCE_CLIENT_ID` (Consumer Key), `SALESFORCE_CLIENT_SECRET`.
   A new app takes up to 10 minutes to start working.

### 7. Email: owner setup links and team invites (Resend)

1. resend.com → Domains → add `nudgeagent.app` → add the DNS records it shows
   at your DNS provider → Verify.
2. API Keys → create one with **Full access** (a sending-only key works, but
   then the checker cannot confirm the domain).
3. Vercel: `RESEND_API_KEY`, `EMAIL_FROM` = `Nudge <hello@nudgeagent.app>`.
   Without this, copy setup and invite links from admin by hand; nothing else
   breaks.

### 8. Voice phone numbers (ElevenLabs is already connected)

The agent and both webhooks work today; only browser test calls are possible
until a number exists. Buy a number from Exotel (India) or Twilio, then import
it in ElevenLabs → Phone numbers, and add it in the client's AI Front Desk →
Voice. Full steps: `docs/VOICE.md`.

### 9. Nudge's own billing (optional)

Only if clients should pay Nudge by card or UPI inside the app; otherwise
invoice them outside and mark them paid in admin.

- Razorpay (INR): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a webhook to
  `https://nudgeagent.app/api/webhooks/razorpay` with events `payment.captured`
  and `subscription.cancelled` → `RAZORPAY_WEBHOOK_SECRET`.
- Stripe (other currencies): `STRIPE_SECRET_KEY`, and a webhook to
  `https://nudgeagent.app/api/webhooks/stripe` for `checkout.session.completed`
  → `STRIPE_WEBHOOK_SECRET`.

### 10. Scheduled jobs, on time

GitHub's schedule really runs every 2–4 hours. Add a free pinger
(cron-job.org) every 5 minutes on
`https://nudgeagent.app/api/cron/process-queue` with the header
`Authorization: Bearer <CRON_SECRET>` (the value is in `.env.local`).
