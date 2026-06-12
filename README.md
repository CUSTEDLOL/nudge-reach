# Nudge Reach (WhatsApp)

**Live:** https://nudge-reach.vercel.app (simulation mode)

Turn one retail product photo into a complete, Meta-policy-compliant WhatsApp
marketing campaign and send it to an opted-in contact list over the official
WhatsApp Cloud API. First product of the **Nudge** B2B AI studio for Asian SME
retail.

Built for non-technical shop owners in India. The bar is "stupidly simple."

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase — Postgres, Auth, Storage
- Prisma ORM
- Anthropic API at runtime via `lib/model-router` (cheap Haiku tier only)
- Deploy: Vercel + Supabase

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com)
   (free tier is fine). You need:
   - Project URL + publishable key — *Project Settings → API*
   - Database connection strings (pooled + direct) — *Project Settings → Database*

3. **Configure environment**

   ```bash
   cp .env.example .env.local
   # fill in the Supabase values; leave SEND_MODE=simulation
   ```

4. **Create the database tables**

   ```bash
   npm run db:push
   ```

5. **Run it**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, create an account, and you should land on the
   dashboard with your org created.

   > Email confirmation: if sign-up says "check your email", the project has
   > *Confirm email* enabled (Supabase default). Either click the link in the
   > email, or turn it off for local dev under
   > *Authentication → Sign In / Up → Email*.
   > Google sign-in requires configuring the Google provider under
   > *Authentication → Providers* — optional for local dev.

## Modes

- `SEND_MODE=simulation` (default) — the entire flow works end to end with
  mocked Meta responses. No WhatsApp Business Account needed.
- `SEND_MODE=live` — real sends over the WhatsApp Cloud API. Requires all
  `WHATSAPP_*` env vars; the app refuses to boot without them.

## Tests

```bash
npm test
```

## Deployment (Vercel + Supabase)

The app deploys to Vercel; data/auth/storage stay on Supabase.

```bash
npx vercel link --yes --project nudge-reach
# push every var from .env.local to production, then:
npx vercel --prod --yes
```

After the first deploy:

1. **Supabase → Authentication → URL Configuration**: set *Site URL* to the
   production URL and add it to *Redirect URLs* — otherwise sign-up
   confirmation emails redirect to localhost.
2. `vercel.json` registers a daily cron on `/api/cron/process-queue`; the
   campaign dashboard also advances the queue on every view, so demo-scale
   sends complete without waiting for cron.
3. Going live later: set `SEND_MODE=live` + the `WHATSAPP_*` credentials in
   Vercel env vars, and point the Meta app's webhook at
   `https://<your-url>/api/webhooks/whatsapp` with the same verify token.

## Demo data

`scripts/seed-demo.ts` creates a demo retailer setup (5 opted-in contacts,
an audience, and a draft campaign) so the app demos instantly:

```bash
npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
  --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
```

## Project docs

- [docs/PRD.md](docs/PRD.md) — scope, data model, flows
- [docs/WHATSAPP_CLOUD_API.md](docs/WHATSAPP_CLOUD_API.md) — integration + compliance reference
- [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — phased build plan
- [PROGRESS.md](PROGRESS.md) — build log and decisions
