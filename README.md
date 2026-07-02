# Nudge — WhatsApp CRM

**Live:** https://nudge-reach.vercel.app (simulation mode)

Nudge is a WhatsApp CRM for Indian SME retail: a shared team inbox, contacts
CRM, AI-generated broadcast campaigns, and automations — all on the **official
WhatsApp Cloud API**, with Meta-policy compliance (opt-in, opt-out, the
24-hour window) enforced in code. Built for non-technical shop owners; the
entire product runs end to end in simulation mode with zero Meta setup.

## Features

**Inbox & AI**
- Three-pane shared inbox: filters (Open / Mine / Unassigned / Resolved /
  Unread), unread counts, assignment, tags, internal notes, lead stage
- 24-hour service-window countdown; outside the window the composer switches
  to an approved-template picker
- AI suggest-reply with tone chips (Professional / Friendly / Short /
  Persuasive) — drafts into the composer, **never auto-sends**
- Optional per-org AI auto-reply agent, scoped to the business's own info,
  with human handoff; simulation tester to play the customer

**CRM**
- Contacts table with search, filters, bulk actions, CSV import (with an
  explicit consent confirmation step), and per-contact profiles with a merged
  activity timeline
- Lead stages (New → Contacted → Qualified → Won → Lost), tags, static
  audiences, and dynamic segments
- Consent is data: opt-in badges everywhere, permanent opt-outs

**Campaigns**
- Broadcast wizard: product photo → AI-generated compliant campaign (or a
  library template, or blank) → audience/segment → compliance interstitial →
  send now or schedule
- Template library with Meta review states (approved / pending / rejected +
  reason, edit-and-resubmit)
- Live delivery dashboard: sent / delivered / read / clicked / failed, plus
  estimated and actual cost

**Automations**
- 5 triggers (message received, keyword, contact created, tag added,
  campaign reply) × 8 step kinds (send message/template, tag, assign, stage,
  wait, resolve, handoff)
- Wait/resume via cron, per-step run logs, one-click test runs

**Analytics**
- Message volume, delivery/read/reply rates, campaign performance, agent
  performance (incl. first-response time), lead funnel, top tags — 7/30/90
  day ranges, computed from real data

**Platform**
- Teams: OWNER / ADMIN / AGENT roles (server-enforced), email invites with
  auto-join on signup (real invite emails when Resend is configured)
- Billing: 4 plans (Free / ₹999 / ₹2,499 / ₹5,999 per month), Razorpay
  checkout env-gated — free mode without keys
- Outbound signed webhooks (6 events) for Zapier/Make/n8n/custom backends
- Hashed API keys (shown once, revocable), CSV data export

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase — Postgres, Auth, Storage
- Prisma 6 (RLS enabled on every table — `npm run db:rls`)
- Anthropic API at runtime via `lib/model-router` (cheap Haiku tier only,
  enforced in code)
- recharts, Vercel (app) + Supabase (data)

## Local setup

Requires **Node 20** (Node 18 fails). On this machine:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com)
   (free tier is fine). You need:
   - Project URL + publishable key — *Project Settings → API*
   - Database connection strings (pooled + direct) — *Project Settings → Database*
   - A public Storage bucket named `product-photos` (see
     [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) §2)

3. **Configure environment**

   ```bash
   cp .env.example .env.local
   # fill in the Supabase values; leave SEND_MODE=simulation
   ```

   Note: the Prisma CLI only reads `.env`, while Next.js reads both — put
   `DATABASE_URL` and `DIRECT_URL` in `.env` too (both files are git-ignored).

4. **Create the database tables, then enable RLS** (always run both,
   in this order — new tables start with RLS disabled):

   ```bash
   npm run db:push
   npm run db:rls
   ```

5. **Seed demo data** (optional but recommended — idempotent, no AI calls):

   ```bash
   npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
     --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
   ```

6. **Run it**

   ```bash
   npm run dev
   ```

   > Machine quirk: `next dev` can OOM after long idle on this machine. If it
   > does, use the production server instead:
   >
   > ```bash
   > npm run build && npx next start
   > ```

   Open http://localhost:3000, create an account, and you land on the
   dashboard with your workspace created.

## Modes

- `SEND_MODE=simulation` (default) — the entire product works end to end
  with mocked Meta responses. No WhatsApp Business Account needed.
- `SEND_MODE=live` — real sends over the WhatsApp Cloud API. The app refuses
  to boot without the required `WHATSAPP_*` vars. See
  [docs/GO_LIVE_WHATSAPP.md](docs/GO_LIVE_WHATSAPP.md).

## Tests

```bash
npm test   # vitest — 233 unit tests
```

## Deployment

Full production runbook (Supabase setup, env checklist, cron, go-live flip,
rollback): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Project docs

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deploy runbook (Vercel + Supabase)
- [docs/SECURITY.md](docs/SECURITY.md) — security posture, tenant isolation, compliance guarantees
- [docs/GO_LIVE_WHATSAPP.md](docs/GO_LIVE_WHATSAPP.md) — switching from simulation to real WhatsApp
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — 5-minute sales demo flow
- [docs/MVP_BUILD_SPEC.md](docs/MVP_BUILD_SPEC.md) — the build contract for the CRM MVP
- [docs/PRD.md](docs/PRD.md) — original scope, data model, flows
- [docs/WHATSAPP_CLOUD_API.md](docs/WHATSAPP_CLOUD_API.md) — integration + compliance reference
- [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — phased build plan
- [PROGRESS.md](PROGRESS.md) — build log and decisions

---

Private repository — proprietary, no open-source license.
