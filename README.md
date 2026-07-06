# Nudge — the AI Front Desk for small business WhatsApp

**Live demo:** https://nudge-reach.vercel.app (simulation mode)

Nudge is a **done-for-you AI employee that runs a small business's WhatsApp end
to end** — it answers customers, books them into a real Google Calendar, chases
quiet leads and no-shows, and sends payment links. Not a chatbot that talks: an
employee that *does the job*. One line: **the AI front-desk worker you hire for
the price of a WhatsApp plan, not a salary.**

Underneath the flagship sits a full self-serve **WhatsApp CRM** — shared team
inbox, contacts, AI broadcast campaigns, automations, analytics — offered as the
lower tiers so a shop can start free and grow into the AI employee.

## The product, top to bottom

- **AI Front Desk** (flagship, ~₹14,999/mo · S$599 · RM1,199 · $179) — the
  done-for-you AI employee: books into the customer's real Google Calendar, runs
  the Revenue-Recovery follow-up engine, sends payment links, takes real actions
  in the client's systems, and ships with concierge onboarding (we set it up).
- **Free / Starter / Growth / Pro** — the self-serve CRM tiers: shared inbox with
  the 24-hour service-window rule, contacts + segments, AI-generated compliant
  broadcast campaigns, automations, team seats, analytics, webhooks + API.

Everything runs on the **official WhatsApp Cloud API**, with Meta-policy
compliance (opt-in, opt-out, the 24-hour window) enforced in code. Built for
non-technical shop owners across India and SE Asia.

## The three moats

1. **Real actions in the client's own systems.** Nudge doesn't just reply — it
   writes to the customer's real Google Calendar, sends payment links, and moves
   leads. A generic chatbot answers; Nudge *books the appointment*.
2. **Outbound revenue generation.** The Revenue-Recovery follow-up engine chases
   quiet leads, no-shows, and reminders on its own. Most tools wait to be
   messaged; Nudge goes and *brings money back* — it pays for itself.
3. **Done-for-you service.** Concierge onboarding means the shop owner does
   nothing technical. We stand up the workspace, calendar, and follow-ups for
   them. The product is the outcome, not the software.

## Quickstart — full product, simulation mode, zero external keys

`SEND_MODE=simulation` (the default) runs the **entire** product — including
Google Calendar booking and the Revenue-Recovery follow-ups — with mocked
responses. **No Meta, WhatsApp, or Google account required.** You only need a
free Postgres database (Supabase) for the app's own data.

Requires **Node 20** (Node 18 fails).

```bash
# 1. Node 20 via nvm
nvm install 20 && nvm use 20        # or: nvm use 20.20.2

# 2. Clone + install
git clone <repo-url> nudge-reach && cd nudge-reach
npm install

# 3. Environment — copy the example, keep SEND_MODE=simulation
cp .env.example .env.local
#   Fill in only the Supabase values (free tier is fine):
#     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
#     DATABASE_URL, DIRECT_URL
#   Leave SEND_MODE=simulation. Leave WHATSAPP_*, GOOGLE_*, payment keys empty.
#   Prisma's CLI only reads .env — put DATABASE_URL + DIRECT_URL in .env too.

# 4. Create tables, then enable RLS (always both, in this order —
#    new tables ship with RLS disabled)
npm run db:push
npm run db:rls

# 5. Seed demo data (optional, recommended — idempotent, makes no AI calls)
npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
  --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs

# 6. Run
npm run dev            # http://localhost:3000 — sign up, land on the dashboard
```

Notes:
- **Schema is current.** `CalendarAccount`, `FollowUpConfig`, and the new
  `BookingRequest` fields are created by `db:push`; `db:rls` locks them down.
  Google Calendar works **mocked** in simulation — the optional
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` are
  only for real OAuth in live mode.
- **The only key that unlocks anything in simulation** is `ANTHROPIC_API_KEY`,
  used for live AI text generation (campaign copy, suggest-reply). The seeded
  data and every send/calendar/follow-up flow run fully mocked without it.

## The 7 protected invariants

These are enforced in code and guarded by unit tests. Don't regress them.

1. **Official Cloud API only.** No unofficial WhatsApp automation exists anywhere
   in the codebase — that gets numbers banned and kills the business.
2. **Consent is code, not UI.** Marketing sends only to `opted_in` contacts,
   checked at the lowest send layer (`canSendMarketing`). Inbound STOP /
   unsubscribe opts out **permanently**; CSV re-import never resurrects it.
3. **Cheap model at runtime, always.** Runtime AI is locked to the cheapest
   vision-capable Haiku tier via `lib/model-router`; a guard throws on expensive
   models. No app code ever calls Opus/Fable at runtime.
4. **The 24-hour service window.** Free-form replies only within 24h of the
   customer's last inbound; outside it, approved templates only.
5. **AI never auto-sends in the inbox.** Suggest-reply drafts; a human sends. The
   optional auto-reply agent is grounded in the owner's own info, hands off to a
   human, and its tool loop is hard-capped.
6. **Tenant isolation.** Every query is scoped by `orgId`, and RLS is enabled on
   every table (`npm run db:rls` after every `db:push`).
7. **Simulation mode always works.** The whole product — calendar booking and
   Revenue-Recovery follow-ups included — demos end to end with mocked responses
   and zero external keys.

## Architecture

`@/*` maps to `src/*`: routes in `src/app`, domain logic in `src/modules`,
cross-cutting code in `src/lib`. Full layout and the one rule for where new code
goes: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 · Supabase (Postgres,
Auth, Storage) · Prisma 6 with RLS · Anthropic API at runtime via
`lib/model-router` (Haiku tier only) · recharts · Vercel + Supabase.

## Deploy & go live

- Production runbook (Vercel + Supabase, env checklist, cron, rollback):
  **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
- Flipping `SEND_MODE=simulation` → `live` and the Meta paperwork (Business
  Manager, WhatsApp product, tokens, webhook verification):
  **[docs/GO_LIVE_WHATSAPP.md](docs/GO_LIVE_WHATSAPP.md)**.

## Test / build / lint

```bash
npm test          # vitest — 339 unit tests across 40 files (invariants covered)
npm run build     # prisma generate && next build
npm run lint      # eslint
```

## More docs

- [docs/SECURITY.md](docs/SECURITY.md) — tenant isolation, compliance guarantees, env hygiene
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — 5-minute sales demo flow
- [docs/PRD.md](docs/PRD.md) · [docs/WHATSAPP_CLOUD_API.md](docs/WHATSAPP_CLOUD_API.md) — scope, data model, integration + compliance reference
- [PROGRESS.md](PROGRESS.md) — build log and decisions

---

Private repository — proprietary, no open-source license.
