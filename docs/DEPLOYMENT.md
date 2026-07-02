# DEPLOYMENT — Vercel + Supabase production runbook

The app deploys to Vercel; Postgres, Auth and Storage stay on Supabase. The
current production deployment is https://nudge-reach.vercel.app (Vercel
project `nudge-reach`).

All commands assume Node 20. On this machine, prefix every session:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

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
   without it).

## 3. Environment variables

Source of truth: `lib/env-schema.ts` (validated at boot with Zod; validation
is skipped during `next build`, so CI/builds need no secrets — misconfig
surfaces at first request). `.env.example` documents every var.

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
| `TOKEN_ENCRYPTION_KEY` | **When `SEND_MODE=live`**, and whenever a workspace saves WhatsApp credentials | 32+ chars; `openssl rand -hex 32` |
| `WHATSAPP_MARKETING_RATE_INR` | Optional | Default `0.99`; verify against Meta's current pricing |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | Without them billing runs in free mode ("add keys to enable payments") |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Required for the Razorpay webhook to accept events |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional | Without them invites still work via auto-join on signup; with them invitees get a real email |
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

- **`vercel.json`** registers a daily cron — `0 3 * * *` UTC on
  `/api/cron/process-queue`. The tick releases due scheduled campaigns,
  resumes waiting automation runs, and advances every sending campaign's
  queue. The campaign stats dashboard *also* ticks the queue on every view,
  so demo-scale sends complete without waiting for cron.
- **Recommended:** set `CRON_SECRET` (any random string) in Vercel env —
  the cron route then requires `Authorization: Bearer <CRON_SECRET>`, which
  Vercel Cron sends automatically when the env var exists. Every cron
  operation is idempotent either way; this is defense in depth.
- **`next.config.ts`** raises the server-action body limit to **6 MB**
  (product photo uploads; the client additionally pre-checks 4 MB).
- `app/(app)/campaigns/new/layout.tsx` sets `maxDuration = 60` for the AI
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
6. Webhook handshake (simulation mode returns 403 until the verify token is
   set — expected):

   ```bash
   curl "https://<url>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"
   ```

7. Cron endpoint returns JSON:

   ```bash
   curl "https://<url>/api/cron/process-queue"
   ```

8. Confirm RLS: in the Supabase dashboard, *Database → Tables* — every
   public table shows RLS enabled.

## 7. Flipping SEND_MODE to live

Full runbook: [GO_LIVE_WHATSAPP.md](GO_LIVE_WHATSAPP.md). The mechanical
Vercel part:

1. Add all six live-mode vars (§3) **plus** `TOKEN_ENCRYPTION_KEY` to
   Vercel Production. The app refuses to boot in live mode if any are
   missing — deliberate guard.
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

## 9. Razorpay (payments) and Resend (invite emails)

Both are optional and entirely env-gated — the product works without them.

**Razorpay**
1. Razorpay Dashboard → *Settings → API Keys* → generate →
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. *Settings → Webhooks* → create a webhook pointing at
   `https://<url>/api/webhooks/razorpay`, subscribe at least
   `payment.captured` and `subscription.cancelled`; the secret you choose is
   `RAZORPAY_WEBHOOK_SECRET`.
3. Add all three to Vercel, redeploy. Settings → Billing switches from the
   "add keys" state to real checkout.

**Resend**
1. resend.com → verify your sending domain → create an API key →
   `RESEND_API_KEY`.
2. `EMAIL_FROM` = a verified sender, e.g. `Nudge <team@yourdomain.com>`.
3. Add both, redeploy. Team invites now send a real email; auto-join on
   signup keeps working either way.

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
additive-only changes have been the rule so far; treat destructive schema
changes as their own migration event with a backup
(Supabase → *Database → Backups*).
