# Nudge — tiered pricing decision and credit proposal

Date: 2026-09-11. Status: subscription direction approved; credit economics
below are a proposal, not approved prices. No runtime or payment configuration
is changed by this document. Supersedes legacy single-flagship pricing in
PRICING.md, STRATEGY.md and AGENTS.md, not the product's safety invariants.

## 1. Approved direction

Nudge is an AI Front Desk that answers customers, captures leads, and, on higher
plans, books appointments, collects payments and follows up. The inbox, CRM and
campaign tools support that employee; they are not the headline.

| Monthly, excluding taxes | Entry | Starter | Growth | Pro | Enterprise |
|---|---:|---:|---:|---:|---|
| India | ₹1,499 | ₹4,499 | ₹7,499 | ₹14,999 | Custom |
| Singapore | Undecided | S$79 | S$249 | S$499 | Custom |
| Team members | Undecided | 3 | 10 | 25 | Agreed limits |
| WhatsApp numbers | Undecided | 1 | 2 | 5 | Agreed limits |

Founder amendment: Entry is a permanent entry-level plan, not temporary early
access. Its name is provisional. It includes only a business-specific AI chatbot
and marketing templates, not an action-taking agent. No bookings, payments or
other agent actions. Template limits and sending scope remain to be defined.
Its credit allowance and Singapore price are undecided; do not assume unlimited
AI or inherit Starter's features. The seven-day trial is unchanged.

These are the working subscription prices discussed with the founder; launch
economics still need validation. Regional prices are deliberate, not live FX.

- Starter and higher: autonomous AI replies/lead capture, inbox, contacts, campaigns,
  website WhatsApp button, AI campaign drafting and chat summaries.
- Growth adds bookings, payment links, automated follow-ups, lead scoring,
  developer API, webhooks, standard CRM sync and per-number staff restrictions.
- Pro adds voice, custom backend actions and bring-your-own AI keys.
- Enterprise adds negotiated capacity/service; do not promise unbuilt SSO,
  compliance certifications, SLAs or unlimited usage.
- Starter is eventually self-service. Early founder configuration help is a
  launch service, not a permanent unlimited concierge commitment. Mandatory
  setup fees are removed; separately scoped paid implementation remains an
  option to decide, not a new approved fee.
- Feature entitlement is the target design, not a claim about current gates.
  The current website widget is a WhatsApp link, not embedded live chat. Voice
  availability must be verified by channel; do not advertise WhatsApp calling
  merely because phone-call simulation exists.

## 2. Trial and billing rules

- Seven days from signup, no card, showcasing Growth. No permanent free tier.
- At expiry without purchase: preserve configuration and history, allow reading
  and exports, pause AI and outbound paid operations. No automatic charge or
  guaranteed conversion; the customer must subscribe.
- One shared Nudge credit balance for Nudge-funded AI and voice, not one per feature.
- Meta bills the customer directly. No Nudge markup on Meta charges.
- Ordinary campaign sending, manual messages, prewritten reminders and
  deterministic CRM/scoring/API operations use zero credits. Subscription
  covers their infrastructure; zero credits does not mean zero operating cost.
- AI drafting, personalization, replies, summaries and other paid inference
  consume credits. Booking/payment execution is not a second charge on top of
  the AI work. Show one consolidated operation, not a reply plus an action toll.
- BYO inference consumes no Nudge credits. Nudge-funded speech/telephony still
  consumes credits. Paid fallback requires explicit customer opt-in.
- Included credits reset each billing cycle. Purchased credits expire twelve
  months after purchase; spend the soonest-expiring eligible balance first.
- Auto-recharge is off by default. A zero balance pauses Nudge-funded AI/voice,
  not an active subscriber's manual inbox or non-AI campaigns/automations.
  Entitled BYO inference can continue. Top-ups do not unlock higher-tier features.

## 3. Proposed credit design — not yet approved

Three choices: fixed prices per feature (simplest, but long chats can lose money),
raw provider-cost pass-through (transparent but little usage margin), or one
cost-weighted credit balance with plain-English estimates. Recommend the third while
measuring real workloads. Do not promise a fixed number of replies per credit.

**Proposed internal conversion: one credit per US$0.005 of eligible provider
cost.** Fractional credits are allowed, accumulated precisely, not rounded up
on every model call. This is a usage unit, not cash or a redeemable currency.
Use a published versioned rate card; do not silently change deductions with FX.
Expose estimates and spending limits, not token jargon, in customer-facing UI.

| Proposed allowance | Trial (total) | Starter/month | Growth/month | Pro/month |
|---|---:|---:|---:|---:|
| Shared credits | 100 | 500 | 1,500 | 3,000 |
| Corresponding eligible provider spend | $0.50 | $2.50 | $7.50 | $15.00 |

Trial allowance is intentionally bounded and must be tested for a meaningful
demo. Extra trial grants require an explicit founder decision. No live voice
on the Growth trial; a labeled simulation may showcase it.

| Proposed top-up | India | Singapore |
|---|---:|---:|
| 1,000 credits | ₹999 | S$19 |
| 5,000 credits | ₹4,499 | S$89 |
| 10,000 credits | ₹7,999 | S$169 |

Small packs keep Starter accessible. Larger packs discount usage, not plan
features. No forced recharge; show estimated remaining work before buying.

## 4. Cost assumptions and examples

Published base API rates checked 2026-09-11: Haiku 4.5 $1 input/$5 output per
million tokens; Sonnet 4.6 $3/$15. These are example models, not a routing change.
Cache writes/reads and model versions need their own prices, not substring
matching. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

Illustrative single-call workloads, uncached, not measured customer averages:

| Workload | Input/output tokens | Provider cost | Proposed credits |
|---|---|---:|---:|
| Short Haiku reply | 2,000 / 300 | $0.0035 | 0.7 |
| Same size Sonnet reply | 2,000 / 300 | $0.0105 | 2.1 |
| Longer Sonnet summary | 8,000 / 500 | $0.0315 | 6.3 |

A multi-step agent can make several calls. Aggregate actual eligible inference
once per operation; the above is not a guarantee of end-to-end reply cost.
At the illustrative Haiku size, 500 credits supports about 714 replies with
nothing else used; at the Sonnet size about 238. This difference is why we must
measure real traffic before calling an allowance sufficient for a normal clinic.

Voice consumes the same credit balance, but its cost must include speech service,
inference and the selected carrier route, including any burst charges.
[ElevenLabs pricing](https://elevenlabs.io/pricing/agents) is only one component;
no carrier quote or actual voice invoice has been validated here. For a stress
scenario of $0.15 all-in per minute (assumption, not vendor quote), voice uses
30 credits/minute and Pro's 3,000 credits buys 100 minutes if used only for voice.
At $0.25/minute it buys 60 minutes. Do not also deduct the same inference cost
as a separate chat charge. Number rental and provider minimum commitments must
be allocated separately or explicitly priced before launch.

## 5. Economics checks, not a profit forecast

Planning FX assumptions only: US$1 = ₹90 and S$1.35; not current exchange quotes.
Full included consumption costs ₹225/₹675/₹1,350 for Starter/Growth/Pro, or
about 5%/9%/9% of India subscription revenue, before every other operating expense.
At the revised Starter price, ₹4,274 remains after eligible provider usage cost,
not net profit. Entry margin remains undecided until its allowance is set;
each 100 credits costs ₹45 at the planning exchange rate if fully consumed.
At these assumptions the 10,000-credit pack costs ₹4,500/S$67.50 in eligible
provider spend, leaving about 44%/60% respectively before fees and overhead.
At INR/USD 100, that India pack leaves about 37.5%. No claim of total gross
margin follows: payment fees, tax treatment, support, onboarding, hosting,
minimum provider plans, storage, fraud, refunds and absorbed failures remain.

Examples at the single-call Haiku size:
- Light Starter: 300 replies = 210 credits; inside the allowance.
- Growth: 1,800 replies + 20 example summaries = 1,386 credits; inside allowance.
- Heavy Growth: 5,000 replies + 50 summaries = 3,815 credits; 2,315 beyond allowance.
- Voice-heavy Pro: 100 minutes at assumed $0.15/minute consumes the entire balance,
  leaving no included credits for chat. Explain this openly, never advertise
  both maximum chat and maximum voice as simultaneously included.

These quantities are a pilot starting point, not validated willingness-to-pay
or workload distribution. Test with real clinic traces and provider invoices;
raise included allowances or change pack prices if normal use causes constant
recharges. Avoid annual discounts until fully consumed economics are known.

## 6. Implementation boundary and launch checks

Current `src/lib/model-router/usage.ts` logs usage asynchronously and swallows
write failures. Its approximate model-family prices and synthetic rows are
useful analytics, not a trustworthy prepaid billing ledger. Do not debit
customers directly from it without redesign and reconciliation.

Before building: approve section 3; resolve migration of existing free,
front_desk, annual and paid accounts, remaining balances, and downgrade limits.
Never silently reprice existing subscribers or delete excess seats/numbers.

Implementation plan must cover atomic reservations/debits, idempotent payment
webhooks, concurrent calls, expiration, refunds, duplicate provider events,
cache-specific costs, exact model versions, customer caps and reconciliation.
Simulation never consumes purchased credit. Proposed policy: Nudge absorbs its
own failed/internal retry work; completed customer-requested regeneration is
new usage, disclosed before running. Missing cost information must not be
silently treated as free or guessed for customer billing.

Voice requires preflight balance and a bounded call reserve with graceful
handoff when exhausted. Usage alone is not permission to contact someone:
consent, STOP, 24-hour windows, tenant isolation and role gates still apply.

Validate a full billing cycle with test payments and representative real AI
traces before enabling live charges. This document does not authorize deployment.
