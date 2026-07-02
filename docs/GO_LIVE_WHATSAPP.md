# Going live on real WhatsApp — step by step

The app's live WhatsApp Cloud API code is complete (the full flow is verified
end to end in simulation; the live driver itself is code-complete and awaits
real credentials for its first verified send). What's left is
**Meta account setup + credentials**, which only the business owner can do. This
is the exact runbook. Two stages: (A) prove it works with Meta's free test
number in ~1 hour, then (B) the production path to actually sell.

---

## Stage A — Real message in ~1 hour (test number, free, no verification)

### 1. Create the Meta app
1. Go to **developers.facebook.com** → log in → **My Apps** → **Create App**.
2. App type: **Business**. Name it (e.g. "Nudge").
3. In the app dashboard, **Add product → WhatsApp → Set up**.

Meta now auto-creates a **test WhatsApp Business Account** and a **test sender
number** for you. On the **WhatsApp → API Setup** page you'll see four things —
these are your credentials:
- **Temporary access token** (valid ~23 hours) → `WHATSAPP_ACCESS_TOKEN`
- **Phone number ID** (of the test sender) → `PHONE_NUMBER_ID`
- **WhatsApp Business Account ID** → `WABA_ID`
- The **"To"** field: add **your own phone number** as a test recipient (up to
  5 allowed) and confirm the code Meta sends you on WhatsApp.

### 2. Get the app secret
**App Settings → Basic → App Secret → Show.** This is `META_APP_SECRET`
(used to verify Meta's webhook signatures).

### 3. Invent a webhook verify token
Make up any random string (e.g. a UUID). You'll paste the SAME value into both
Meta and your env as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

### 4. Set the env vars (locally in `.env.local`, or in Vercel for the deploy)
```
SEND_MODE=live
WABA_ID=<from step 1>
PHONE_NUMBER_ID=<from step 1>
WHATSAPP_ACCESS_TOKEN=<temporary token from step 1>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<the random string you invented>
META_APP_SECRET=<from step 2>
TOKEN_ENCRYPTION_KEY=<any 32+ char random string>
WHATSAPP_API_VERSION=v23.0
```
> The app refuses to boot in `live` mode if any of these are missing — that's a
> deliberate guard, not a bug.
>
> Note the split: the **webhook** credentials (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
> `META_APP_SECRET`) are deployment-level — Meta calls one URL. The **sender**
> credentials (`PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`) are primarily
> per-workspace via **Settings → WhatsApp** (stored AES-256-GCM encrypted);
> the env values act as the single-tenant fallback sender. Vercel-side steps
> are in [DEPLOYMENT.md](DEPLOYMENT.md) §7.

### 5. Point Meta's webhook at the app
The app must be reachable at a public URL (deploy to Vercel, or use `ngrok
http 3000` for local testing).
1. **WhatsApp → Configuration → Webhooks → Edit.**
2. **Callback URL:** `https://<your-url>/api/webhooks/whatsapp`
3. **Verify token:** the same string as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Click **Verify and Save** (the app answers the handshake automatically).
5. **Subscribe** to the **`messages`** field (this delivers inbound messages +
   status/delivery receipts).

### 6. Send the first real message
- With a test number, Meta only allows **pre-approved templates** to start a
  conversation. The default `hello_world` template is already approved.
- In the app: connect the number under **Settings → WhatsApp**, create/pick an
  approved template, add your own (registered) phone as an opted-in contact, and
  run a campaign. **A real WhatsApp message arrives on your phone.**
- Reply from your phone → it appears in the **Inbox**, and (if the AI agent is
  on) it auto-replies. Delivery/read ticks update from Meta's webhook.

At this point the product is **provably working on real WhatsApp.**

> An in-app go-live checklist that walks through these same steps is landing
> as part of the current hardening work stream — this document stays the
> canonical runbook.

---

## Stage B — Production (what's needed to actually sell)

The test number can only message 5 pre-registered people and uses a 24-hour
token. To serve real customers:

1. **Business verification.** Meta Business Settings → Security Center →
   verify your business (legal name, address, documents). Takes days.
2. **A real sender number.** Add a phone number that is **not** already on
   regular WhatsApp (a fresh SIM or a landline that can receive the code).
   Register it under the WABA.
3. **Permanent access token.** Business Settings → **System Users** → create one
   → generate a token with **`whatsapp_business_messaging`** and
   **`whatsapp_business_management`** scopes. Replace the temporary token.
4. **Payment method on Meta.** WhatsApp charges per conversation; add a card in
   the WhatsApp Manager billing section.
5. **Get your templates approved.** Submit marketing/utility templates for
   Meta review (the app builds the payloads; approval is Meta's real review,
   usually minutes to a day). Verify the ₹ rate against Meta's current pricing
   (`WHATSAPP_MARKETING_RATE_INR`, default 0.99).
6. **App Review** for the two permissions above, so you can message beyond test
   recipients.

After Stage B you can send to any opted-in customer and charge for it.

---

## Multi-tenant status (important for the SaaS model)

**Per-org credentials are now the primary send path.** Each workspace connects
its own number under **Settings → WhatsApp**; the token is encrypted at rest
(AES-256-GCM) and both the send driver and template submission resolve that
workspace's credentials first, falling back to the env `PHONE_NUMBER_ID` /
`WHATSAPP_ACCESS_TOKEN` only when no account is connected (the single-tenant /
agency fallback). So today the deployment supports:
- **Many businesses, each on their own number**, connected manually via
  Settings → WhatsApp (someone pastes credentials from the Meta console), and
- **A done-for-you / agency model** on the env fallback number.

What's still missing for true **self-serve** onboarding (the full
AiSensy/WATI model):
- **Meta Embedded Signup** — an in-app OAuth flow so a shop owner connects
  their WABA without ever seeing the developer console. This also requires
  becoming a Meta **Tech Provider** and passing App Review.
- Live Meta submission for **library** templates is a documented stub that
  ships with WABA onboarding (the campaign-template live path is
  code-complete).

---

## What I (Claude) can do vs. what needs you

| Task | Who |
|---|---|
| Write/verify the live code | ✅ Done |
| Wire env vars, deploy to Vercel, test the live send with you | ✅ I can |
| Per-org send driver (each workspace on its own number) | ✅ Done |
| Build Embedded Signup for self-serve onboarding | ✅ I can |
| Create the Meta Business/Developer account | 🔴 You — I can't create accounts |
| Enter your access token / secrets | 🔴 You — I can't handle your credentials |
| Business verification | 🔴 You — tied to your identity |

The moment you have the four test credentials from Stage A step 1, tell me and
we'll run the first live send together.
