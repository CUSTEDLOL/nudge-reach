# NTU InnovateX 2026 — Stage 1 Devpost Submission (copy-paste source)

Deadline: **14 Aug 2026, 11:45 PM SGT** (Devpost widget; rules text says 11:59).
Submit at: https://ntu-cctf-snz-innovatex-2026.devpost.com/ → Start project.

---

## Project title

**Nudge — the AI Front Desk that runs your WhatsApp, now with an on-chain wallet**

## Short description / elevator pitch (~200 chars)

> A done-for-you AI employee that runs a small business's WhatsApp end-to-end —
> answers, books real calendars, chases ghosted leads, and now collects
> cross-border deposits in USDC via x402. Live at nudgeagent.app.

## Track

Track 2 — Web3 Applications, AI Agents and Real-World Use Cases

## Team type

Student Group *(proof of current student status attached for every member)*

## Team members & affiliations

- **[FILL: Full name — institution, program]**
- **[FILL: Full name — institution, program]**
- *(one line per member; every listed member materially contributed)*

## Primary contact email

visheshjain1705@gmail.com

---

## Problem statement

60M+ small businesses in India — and millions more across Southeast Asia — run
their entire customer relationship on WhatsApp. For high-ticket service
businesses (clinics, boutiques, studios), revenue is not lost to bad marketing;
it is lost to **unanswered messages, leads that go quiet, and deposits that
never get paid** — every unpaid deposit is a probable no-show.

Since June 2026, Meta's free Business AI answers WhatsApp questions for every
business. But *answering* was never the bottleneck. The bottleneck is
**acting**: booking into a real calendar, following up after two days of
silence, and collecting the deposit that makes a booking real.

The deposit is hardest exactly where the ticket is highest: **cross-border
customers**. An NRI in Singapore ordering a ₹40,000 Banarasi saree, or a
medical-tourism patient booking a hair-transplant consultation in Delhi from
Dubai, hits declined international cards, 3–5% FX spreads, and bank transfers
that take days and break the chat flow. The highest-value bookings are the
ones that fall through.

## Solution overview

**Nudge is an AI Front Desk** — an autonomous agent a business *employs*, not
software it operates. Priced against the ₹18–25k/month human it replaces, it
runs the business's WhatsApp end-to-end:

1. **Answers** every enquiry in seconds, grounded ONLY in the business's own
   knowledge base (prices, policies, tone) — never a general-purpose chatbot.
2. **Books** appointments into the business's real Google Calendar with
   availability checks.
3. **Chases** — the outbound moat Meta's free inbound-only agent does not
   touch: ghosted-lead follow-ups, booking reminders, no-show recovery, all
   via Meta-approved templates to opted-in contacts only.
4. **Collects** — and this is our hackathon build — deposits on two rails:
   cards/UPI for domestic customers, and **USDC on Base via an x402-style
   flow** for cross-border customers. The agent decides the rail in
   conversation: customer says "my card doesn't work from Singapore" → agent
   mints an on-chain payment link → hosted pay page shows
   network/asset/address/reference → settlement reconciles the deposit and
   confirms the booking, all inside the same WhatsApp thread.

Every unpaid USDC deposit is also **machine-payable**: `GET /api/pay/{id}`
answers HTTP **402 Payment Required** with structured x402 payment
instructions (scheme, network, asset, atomic amount, payTo, reference) that
any wallet or autonomous agent can act on — an AI employee whose invoices
other machines can pay.

## Key features

- Grounded business agent (Anthropic Claude, cheap-at-runtime model routing),
  hard-scoped tool set: answer, book, follow up, collect
- Real calendar booking with availability checks (Google Calendar)
- Outbound revenue recovery: ghosted-lead chase, reminders, no-show win-back —
  consent enforced in code (opt-outs are permanent; STOP always wins)
- Dual-rail payment collection: Razorpay (cards/UPI) + **USDC on Base (x402)**
- Hosted pay page + machine-payable 402 endpoint for every on-chain deposit
- 24-hour service-window compliance enforced in code (official Meta Cloud API
  only — no gray-market automation)
- Multi-tenant with row-level security; roles enforced server-side
- Full simulation mode: the entire product demos end-to-end with zero external
  keys — which is exactly what powers the one-click judge sandbox below

## Target users

High-ticket, lead-driven SMBs in India → Malaysia → Singapore → UAE.
Beachhead: hair-transplant / aesthetic-dermatology / cosmetic-dental clinics
with cross-border (medical-tourism) patients; same engine serves boutiques
with diaspora buyers — both are in the live demo.

## Technologies

Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) ·
Prisma · Anthropic Claude (Haiku at runtime via a model router) · Meta
WhatsApp Cloud API (official) · x402 / HTTP-402 machine payments · USDC on
Base · Vercel (Singapore region)

## Sponsor tools (AIsa)

Our on-chain rail is built to AIsa's thesis: agents that transact. The x402
payment surface we shipped this week (402-with-instructions → pay → receipt)
is the exact shape AIsa's Machine Payments Protocol / Circle USDC nanopayment
stack settles. Two integrations planned for the on-site final with sponsor
API access: (1) live USDC settlement of Nudge deposits through AIsa rails,
and (2) giving the agent itself an AIsa budget so it pays per-call for the
external services it consumes — an AI employee with a salary account.

## What was built during the hackathon window (and prior-work disclosure)

**Prior work, disclosed:** the Nudge platform (agent, inbox/CRM, campaigns,
calendar, consent engine, marketing site) is our own product, built by this
team and live at nudgeagent.app before the hackathon.

**Built during the submission window (27 Jul – 14 Aug, verifiable in git
history):**
- The entire Web3 layer: USDC payment rail in the payments module; hosted
  `/pay/{id}` page; x402 `GET /api/pay/{id}` machine endpoint; agent tool
  extension so the conversation can route to the on-chain rail
- One-click `/demo` judge sandbox: anonymous session → fresh isolated
  workspace → seeded data → dashboard, no login
- Marketing/product polish shipped in-window (responsive production pass,
  live-reply hero)

Private repository (proprietary product) — **judge access granted on
request**; full commit history available.

## Try it (no login, ~2 minutes)

1. Open **https://nudgeagent.app/demo** → you get your own private, seeded
   demo workspace (every judge gets a fresh isolated tenant).
2. Open **Inbox** → any conversation → expand the **Simulation tester**.
3. Type as the customer: *"I love the pink Banarasi. I'm in Singapore and my
   card keeps declining — can I pay the deposit in USDC?"*
4. Watch the agent confirm the amount and mint an on-chain payment link.
5. Open the link → hosted pay page (Base / USDC / address / reference) →
   **Simulate wallet payment** → payment reconciles, deposit noted in the
   thread.
6. `curl` the same link's `/api/pay/{id}` to see the raw **HTTP 402** x402
   instructions, then re-curl after paying for the receipt.

## Links

- Product: https://nudgeagent.app
- Judge sandbox: https://nudgeagent.app/demo
- Repo: private (proprietary) — access on request via visheshjain1705@gmail.com

## Supporting materials (single ZIP)

- `nudge-deck.pdf` — 10 slides: problem, solution, moats, Web3 rail,
  architecture, market, business model, team, roadmap
- `architecture.png` — WhatsApp → agent → real actions (calendar / USDC x402 /
  follow-ups) → dashboard
- `screenshots/` — live product: inbox + agent, USDC pay page (unpaid → paid),
  402 endpoint, dashboard
- `demo-clip.mp4/gif` — 60–90s: the cross-border USDC deposit flow end-to-end

---

## Submission checklist (tick before 11:45 PM SGT)

- [ ] Title + short description
- [ ] Track 2 selected
- [ ] Team type: Student Group
- [ ] All member names + affiliations filled
- [ ] Student proof for EVERY member attached
- [ ] Contact email
- [ ] Long description pasted (problem → solution → features → users → tech →
      sponsor → disclosure → try-it)
- [ ] Supporting ZIP uploaded
- [ ] Links added (nudgeagent.app, /demo)
- [ ] /demo verified working from an incognito window
