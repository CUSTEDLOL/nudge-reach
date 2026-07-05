# DEPLOYMENT — Vercel + Supabase production runbook

The app deploys to Vercel; Postgres, Auth and Storage stay on Supabase. The
current production deployment is https://nudge-reach.vercel.app (Vercel
project `nudge-reach`).

All commands assume Node 20. On this machine, prefix every session:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

> ### What changed recently (read this if you deployed before)
> Nudge is now positioned as an **AI Front Desk** — the AI employee books into a
> real Google Calendar and runs a Revenue-Recovery follow-up engine — on top of
> the existing self-serve CRM/inbox/campaigns tiers. Concretely, for a deploy:
> - **New tables:** `CalendarAccount`, `FollowUpConfig`, plus new fields on
>   `BookingRequest` (`scheduledFor`, `calendarEventId`, `reminder24SentAt`,
>   `reminder2SentAt`, `reviewAskedAt`). **You must re-run `npm run db:push`
>   then `npm run db:rls`** — new tables ship with RLS *off*, so skipping
>   `db:rls` would leave `CalendarAccount`/`FollowUpConfig` readable through the
>   publishable key. See §4.
> - **New optional env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
>   `GOOGLE_OAUTH_REDIRECT_URI` (calendar). Also `STRIPE_SECRET_KEY` /
>   `STRIPE_WEBHOOK_SECRET` (USD/global billing). All optional. See §3.
> - **`CRON_SECRET` is recommended in production** (defense-in-depth on the cron
>   route). See §3 and §5.
> - **Simulation still needs zero external keys.** With the default
>   `SEND_MODE=simulation` the *entire* product runs — including calendar
>   booking and the T-24h/T-2h follow-ups — against a mocked calendar and mocked
>   Meta. No Google, WhatsApp, Stripe, or Razorpay account required to demo.
> - The source tree now lives under `src/` (`@/*` → `src/*`); path references in
>   this doc have been updated accordingly.

---

## 1. Prerequisites

| What | Where |
|---|---|
| Node 20 + npm | nvm (`v20.20.2` installed on this machine) |
| Vercel account + CLI | `npx vercel login` |
| Supabase project | supabase.com (free tier works) |
| Anthropic API key | console.anthropic.com — needed for AI campaign generation and AI replies (the app degrades gracefully without it: canned sample drafts in the inbox, generation errors on `/campaigns/new`) |

## 2. Supabase project setup

1. **Create the project** and collect:
   - Project URL + **publishable** key (not the legacy anon key) —
     *Project Settings → API*
   - Pooled connection string (pgbouncer, port **6543**) → `DATABASE_URL`
     (append `?pgbouncer=true`)
   - Direct connection string (port **5432**) → `DIRECT_URL`
     — *Project Settings → Database*

2. **Auth URL configuration** — *Authentication → URL Configuration*:
   - **Site URL**: your production URL (e.g. `https://nudge-reach.vercel.app`)
   - Add the same URL to **Redirect URLs**.
   Without this, sign-up confirmation emails redirect to `localhost`.

3. **Storage bucket** — *Storage → New bucket*:
   - Name: `product-photos`, **Public bucket: ON**. Public read is required —
     Meta fetches template header images by URL, and the app renders
     `getPublicUrl()` links.
   - Uploads happen server-side as the signed-in user, so add authenticated
     write policies (SQL editor):

   ```sql
   create policy "authenticated upload product-photos"
     on storage.objects for insert to authenticated
     with check (bucket_id = 'product-photos');

   create policy "authenticated update product-photos"
     on storage.objects for update to authenticated
     using (bucket_id = 'product-photos');
   ```

4. Optional: enable the **Google** provider under *Authentication →
   Providers* (the login page has a Google button; email+password works
   without it). Note: this is Supabase login-with-Google and is **separate**
   from the `GOOGLE_*` calendar OAuth vars in §3.

## 3. Environment variables

Source of truth: `src/lib/env-schema.ts` (validated at boot with Zod;
validation is skipped during `next build`, so CI/builds need no secrets —
misconfig surfaces at first request). `.env.example` documents every var.

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Always** | Must be a valid URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Always** | The new publishable key |
| `DATABASE_URL` | **Always** | Pooled (pgbouncer, 6543) |
| `DIRECT_URL` | For `db:push` / `db:rls` | Direct (5432); Prisma DDL |
| `ANTHROPIC_API_KEY` | Optional | Without it: no AI generation; inbox drafts fall back to canned samples |
| `RUNTIME_MODEL` | Optional | Default `claude-haiku-4-5`; expensive models are rejected in code |
| `SEND_MODE` | Optional | `simulation` (default) or `live` |
| `WHATSAPP_API_VERSION` | Optional | Default `v23.0` |
| `WABA_ID` | **When `SEND_MODE=live`** | Boot fails without it in live mode |
| `PHONE_NUMBER_ID` | **When `SEND_MODE=live`** | ″ |
| `WHATSAPP_ACCESS_TOKEN` | **When `SEND_MODE=live`** | ″ |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **When `SEND_MODE=live`** | Same value entered at Meta |
| `META_APP_SECRET` | **When `SEND_MODE=live`** | Verifies `X-Hub-Signature-256`; webhook POSTs answer 503 without it |
| `TOKEN_ENCRYPTION_KEY` | **When `SEND_MODE=live`**, and whenever a workspace saves WhatsApp/calendar credentials | 32+ chars; `openssl rand -hex 32`. Encrypts WhatsApp tokens **and** the Google calendar refresh token at rest |
| `WHATSAPP_MARKETING_RATE_INR` | Optional | Default `0.99`; verify against Meta's current pricing |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | INR billing. Without them billing runs in free mode ("add keys to enable payments") |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Required for the Razorpay webhook to accept events |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional | USD orgs / global markets. Without them Stripe checkout is disabled; the webhook (`/api/webhooks/stripe`) needs the secret to accept `checkout.session.completed` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional | Without them invites still work via auto-join on signup; with them invitees get a real email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar OAuth for the AI Front Desk. **Left empty, "Connect calendar" works in simulation against a mocked calendar** — set them only for real OAuth. Not in the live-mode guard: even a live WhatsApp deploy boots without a calendar |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional (with the two above) | Must exactly match a redirect URI on the OAuth client, e.g. `https://<url>/api/integrations/google/callback` |
| `CRON_SECRET` | Optional — **recommended in production** | When set, `/api/cron/*` requires `Authorization: Bearer <CRON_SECRET>`; Vercel Cron sends it automatically. See §5 |
| `NEXT_PUBLIC_APP_URL` | Optional | Absolute origin for links in emails; set it once you have a custom domain |

## 4. Database: push schema, enable RLS, seed

Run these locally against the **production** Supabase project — Prisma and
the scripts use whatever `DATABASE_URL`/`DIRECT_URL` are configured (the
Prisma CLI reads `.env`; the RLS and seed scripts read `.env.local`), so
point both files at production for this step.

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"

# 1. Create/update tables
npm run db:push

# 2. Enable Row Level Security on every table — REQUIRED after every db:push
#    (new tables start with RLS disabled; without it the publishable key can
#    read tables through Supabase's Data API)
npm run db:rls

# 3. Optional: seed the demo workspace (idempotent, deterministic, no AI
#    calls; never flips an opted-out contact back to opted-in)
npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
  --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
```

> **Re-run both `db:push` and `db:rls` after every schema change**, not just on
> first setup. The AI Front Desk work added `CalendarAccount` and
> `FollowUpConfig` (plus new `BookingRequest` fields); those tables were created
> with RLS **off**, so a deploy that ran `db:push` but skipped `db:rls` would
> expose them to the publishable key. `db:rls` is idempotent — safe to re-run
> any time.

The seed attaches to the **first org found**, so sign up once in production
before seeding if the database is empty.

## 5. Vercel: link, env, deploy

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"

# One-time: link the repo to the Vercel project
npx vercel link --yes --project nudge-reach

# Add every variable from §3 to Production (repeat per var, or use the
# Vercel dashboard → Settings → Environment Variables)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Deploy
npx vercel --prod --yes
```

Notes baked into the repo:

- **`vercel.json`** registers a single daily cron — `0 3 * * *` UTC on
  `/api/cron/process-queue`. One tick does four things: releases due scheduled
  campaigns, resumes waiting automation runs, fires the **Revenue-Recovery
  follow-ups** (T-24h / T-2h booking reminders, no-show rebooks, post-service
  review asks — all consent- and template-gated like any send), and advances
  every sending campaign's queue. The campaign stats dashboard *also* ticks the
  queue on every view, so demo-scale sends complete without waiting for cron.
- **Recommended:** set `CRON_SECRET` (any random string) in Vercel env —
  the cron route then requires `Authorization: Bearer <CRON_SECRET>`, which
  Vercel Cron sends automatically when the env var exists. Every cron
  operation is idempotent either way; this is defense in depth, and production
  should set it.
- **`next.config.ts`** raises the server-action body limit to **6 MB**
  (product photo uploads; the client additionally pre-checks 4 MB).
- `src/app/(app)/campaigns/new/layout.tsx` sets `maxDuration = 60` for the AI
  generation route segment.

## 6. Post-deploy verification

1. `https://<url>/` loads the marketing page; `/login` loads.
2. Sign up with a fresh email → confirmation email redirects back to the
   production URL (not localhost) → dashboard renders with your workspace.
3. If seeded: Inbox shows conversations, Contacts shows ~40 rows, Campaigns
   shows "Diwali Dhamaka Sale" (SENT, with stats).
4. `/campaigns/new` → upload a photo → a campaign generates (requires
   `ANTHROPIC_API_KEY`).
5. Inbox → open a thread → use the simulation tester to send an inbound
   message → it appears in the thread and the conversation list.
6. AI Front Desk (works in simulation with no Google keys): connect the
   calendar in **Settings**, then have the agent capture a booking → a
   `BookingRequest` with a resolved `scheduledFor` appears, and the follow-up
   engine (Settings → follow-ups enabled) will schedule its reminders.
7. Webhook handshake (simulation mode returns 403 until the verify token is
   set — expected):

   ```bash
   curl "https://<url>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"
   ```

8. Cron endpoint returns JSON (with `CRON_SECRET` set, pass the bearer):

   ```bash
   curl "https://<url>/api/cron/process-queue"
   # returns { released, resumedRuns, followUps, campaigns, processed }
   ```

9. Confirm RLS: in the Supabase dashboard, *Database → Tables* — every
   public table (including the new `CalendarAccount` and `FollowUpConfig`)
   shows RLS enabled.

## 7. Flipping SEND_MODE to live

Full runbook: [GO_LIVE_WHATSAPP.md](GO_LIVE_WHATSAPP.md). The mechanical
Vercel part:

1. Add the **six** required live-mode vars from §3 — the five WhatsApp
   credentials (`WABA_ID`, `PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`) **plus**
   `TOKEN_ENCRYPTION_KEY` — to Vercel Production. The app refuses to boot in
   live mode if any are missing — deliberate guard. (The `GOOGLE_*` calendar
   vars are *not* part of this guard; a live WhatsApp deploy still boots with a
   mocked/simulated calendar.)
2. Set `SEND_MODE=live`.
3. Redeploy (`npx vercel --prod --yes`) — env changes need a new deployment.
4. Point Meta's webhook at `https://<url>/api/webhooks/whatsapp` with the
   same verify token, subscribed to the `messages` field.
5. Each workspace connects its own number under **Settings → WhatsApp**
   (token encrypted at rest); the env credentials act as the single-tenant
   fallback sender.
6. Verify a real send to a registered test recipient before announcing.

To go back: set `SEND_MODE=simulation` and redeploy. Simulation always works.

## 8. Custom domain

1. Vercel → project → *Settings → Domains* → add the domain, follow the DNS
   instructions.
2. Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` (email links use it) and
   redeploy.
3. Update Supabase *Authentication → URL Configuration* (Site URL + Redirect
   URLs) to the new domain.
4. If live on WhatsApp: update the Meta webhook callback URL.
5. If using Google Calendar OAuth: update `GOOGLE_OAUTH_REDIRECT_URI` and add
   the new `https://yourdomain.com/api/integrations/google/callback` to the
   OAuth client's authorized redirect URIs.

## 9. Optional integrations (payments, email, calendar)

All of these are env-gated — the product (including simulation) works without
any of them.

**Razorpay (INR billing)**
1. Razorpay Dashboard → *Settings → API Keys* → generate →
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. *Settings → Webhooks* → create a webhook pointing at
   `https://<url>/api/webhooks/razorpay`, subscribe at least
   `payment.captured` and `subscription.cancelled`; the secret you choose is
   `RAZORPAY_WEBHOOK_SECRET`.
3. Add all three to Vercel, redeploy. Settings → Billing switches from the
   "add keys" state to real checkout.

**Stripe (USD orgs / global markets)**
1. Stripe Dashboard → *Developers → API keys* → `STRIPE_SECRET_KEY`.
2. *Developers → Webhooks* → add an endpoint pointing at
   `https://<url>/api/webhooks/stripe`, subscribe at least
   `checkout.session.completed`; the signing secret is `STRIPE_WEBHOOK_SECRET`.
3. Add both to Vercel, redeploy.

**Resend (invite emails)**
1. resend.com → verify your sending domain → create an API key →
   `RESEND_API_KEY`.
2. `EMAIL_FROM` = a verified sender, e.g. `Nudge <team@yourdomain.com>`.
3. Add both, redeploy. Team invites now send a real email; auto-join on
   signup keeps working either way.

**Google Calendar (AI Front Desk booking + reminders)**
1. Google Cloud Console → *APIs & Services → Credentials* → create an
   **OAuth 2.0 Client ID** → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
2. Add `https://<url>/api/integrations/google/callback` to the client's
   authorized redirect URIs and set the same value as
   `GOOGLE_OAUTH_REDIRECT_URI`.
3. Ensure `TOKEN_ENCRYPTION_KEY` is set — the refresh token is stored
   AES-256-GCM encrypted.
4. Add all four to Vercel, redeploy. **Skip this entirely to keep the mocked
   simulation calendar** — bookings and reminders still work end to end.

## 10. Rollback

Vercel keeps every previous deployment immutable:

```bash
# List recent deployments
npx vercel ls nudge-reach

# Point production back at a previous good deployment
npx vercel promote <deployment-url>
```

(`npx vercel rollback` steps back to the previous production deployment.)
Database schema changes via `db:push` are not automatically reversible —
additive-only changes have been the rule so far (the new `CalendarAccount` /
`FollowUpConfig` tables and `BookingRequest` fields are additive); treat
destructive schema changes as their own migration event with a backup
(Supabase → *Database → Backups*).
