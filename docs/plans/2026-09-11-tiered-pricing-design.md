# Nudge pricing — the single record

Decided 2026-09-11 (tiers). Prices, included credits and Singapore re-set by the
founder on 2026-09-15. This file is the only pricing record; the customer-facing
copy `docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx` is generated from it. Every
older pricing document has been deleted.

Rule for this file: it says what is decided, what is built, and what is not.
Nothing here is a forecast dressed as a fact.

## 1. The model in one line

Plans pay for the software. Credits pay for the AI. Meta bills the customer
directly for WhatsApp messaging, with no Nudge markup.

## 2. Plans (decided)

Monthly, excluding tax.

| | Entry | Starter | Growth | Pro | Enterprise |
|---|---:|---:|---:|---:|---|
| India | ₹1,499 | ₹4,999 | ₹9,999 | ₹19,999 | Custom |
| Singapore | Undecided | S$89 | S$329 | S$659 | Custom |
| Included AI credits / month | 200 | 1,000 | 2,500 | 5,000 | Agreed per deal |
| Team members | 2 | 3 | 10 | 25 | Agreed |
| WhatsApp numbers | 1 | 1 | 2 | 5 | Agreed |
| Contacts | 1,000 | 5,000 | 25,000 | Unlimited | Unlimited |
| Campaign messages / month | 2,000 | 5,000 | 30,000 | Unlimited | Unlimited |

Entry's seats, numbers, contacts and campaign cap are conservative placeholders
so the tier can be enforced; its Singapore price is undecided and is not
printed anywhere. "Entry" is a working name.

**Other currencies (USD, AED, SAR, MYR, IDR, BRL, MXN, GBP) are stale.** They
were derived from the pre-2026-09-15 ladder and have not been re-set; Pro is
US$179 while ₹19,999 is roughly US$222 at the planning rate. Do not sell in
those markets until they are reviewed.

### What each plan unlocks (this matches the gates in `src/modules/billing/plans.ts`)

- **Entry** — an AI chatbot trained on the business that answers questions, plus
  marketing templates. No bookings, payments, follow-ups or any other action.
- **Starter** — everything in Entry plus the full workspace: AI replies and lead
  capture, shared team inbox with AI drafts, contacts/tags/segments/notes,
  broadcast campaigns with AI-written copy, conversation summaries, the website
  WhatsApp button.
- **Growth** — everything in Starter plus the agent's real actions: booking into
  Google Calendar, payment links in chat, the follow-up engine (reminders,
  no-show recovery, quiet-lead nudges), lead scoring, Zoho/Salesforce sync,
  developer API and webhooks, per-number staff restrictions.
- **Pro** — everything in Growth plus the voice front desk (100 call minutes a
  month), custom actions into the customer's own systems, bring-your-own AI key,
  unlimited contacts and campaign messages.
- **Enterprise** — Pro's features with capacity, numbers, seats, voice minutes
  and credits agreed per deal, and a named support contact. Assigned by the
  founder (`npm run plan:set`), invoiced outside checkout. Do not promise SSO,
  compliance certifications, SLAs or unlimited usage — none exist.

Buying credits never unlocks a higher plan's features.

## 3. Credits (decided policy; NOT yet built — see §7)

**One credit = US$0.005 of eligible AI provider cost.** A credit is a unit of
usage, not a message and not a rupee. A short task uses less than one; a long
one uses several. Fractions accumulate precisely and are not rounded up per call.

| Activity | Uses credits? |
|---|---|
| AI reply, summary, campaign copy, AI personalisation | Yes — for the AI work |
| Voice calls (Pro's 100 minutes, Enterprise as agreed) | No — voice is limited by included minutes, not credits (founder decision 2026-09-15) |
| Sending an already-written campaign or a manual message | No |
| Follow-up reminders, no-show recovery, quiet-lead nudges (pre-written templates) | No |
| Ordinary CRM sync, rule-based lead scoring, API calls | No |
| Booking or payment-link execution after AI work | No extra charge |
| AI running on the customer's own provider key (Pro / Enterprise) | No |

Meta's per-conversation charges are the customer's own bill and are never
converted into credits. Drafting one campaign uses credits once; sending that
text to 1,000 opted-in people does not.

**Balance rules.** Included credits are issued fresh with each monthly payment
and expire at the end of that paid period (founder decision 2026-09-15: reset
on the payment date, not the calendar month). Purchased credits expire 12
months after purchase; the soonest-expiring eligible balance is spent first.
Auto-recharge is off by default. A zero balance pauses Nudge-funded AI replies,
drafts, summaries and campaign copy — never the manual inbox, campaigns,
follow-ups or voice the plan already includes. Simulation mode never consumes
purchased credit. Nudge absorbs its own failed or retried AI work and the AI
used to set up a customer's knowledge base during onboarding; a
customer-requested regeneration is new usage.

**Top-up packs (decided prices).**

| Credits | India | Singapore |
|---:|---:|---:|
| 1,000 | ₹999 | S$19 |
| 5,000 | ₹4,499 | S$89 |
| 10,000 | ₹7,999 | S$169 |

**Trial.** Seven days from signup, no card, showcasing Growth, with 100 credits
in total. At expiry the workspace keeps its configuration and history (readable
and exportable); AI and paid outbound pause until a plan is bought. No
automatic charge.

## 4. What the credits are worth — cost and margin

Planning assumptions, not live quotes: US$1 = ₹90 = S$1.35. Provider rates
checked 2026-09-15 against Anthropic's price sheet — Haiku 4.5 US$1 in / US$5
out per million tokens; **Sonnet 5 US$2 / US$10** (cache reads ≈ 0.1× and cache
writes ≈ 1.25× the input rate). Nudge runs `claude-sonnet-5` at runtime
(`RUNTIME_MODEL` default, since 2026-08-29). The 2026-09-11 version of this
record priced everything at Sonnet 4.6's US$3 / US$15 — a third too high;
every Sonnet figure below is now on the Sonnet 5 rate. One credit costs us
**₹0.45 / S$0.00675** regardless of model.

### What one task costs (uncached, single call; real conversations vary)

| Example | Credits | Our cost (India) | Value at smallest pack (India) |
|---|---:|---:|---:|
| Short Haiku reply (2,000 in / 300 out) | 0.7 | ₹0.32 | ₹0.70 |
| Same-size Sonnet 5 reply | 1.4 | ₹0.63 | ₹1.40 |
| Longer Sonnet 5 summary (8,000 in / 500 out) | 4.2 | ₹1.89 | ₹4.20 |
| One voice minute (measured about US$0.18 all-in) | 36 | ₹16.20 | ₹35.96 |

### How far the included credits go (Sonnet 5, example reply size)

| | Entry 200 | Starter 1,000 | Growth 2,500 | Pro 5,000 |
|---|---:|---:|---:|---:|
| ≈ AI replies a month | 142 | 714 | 1,785 | 3,571 |
| ≈ AI replies if run on Haiku | 285 | 1,428 | 3,571 | 7,142 |

A multi-step agent action (book + confirm) can take several calls; these are
single-call figures. Nobody has yet measured a real clinic's replies per
conversation. That one number decides every margin below — measure it before
calling any allowance "enough".

### Subscription margin after AI cost (assumes every included credit is used)

India:

| Plan | Customer pays | AI cost of included credits | Left | Left % |
|---|---:|---:|---:|---:|
| Entry | ₹1,499 | ₹90 | ₹1,409 | 94.0% |
| Starter | ₹4,999 | ₹450 | ₹4,549 | 91.0% |
| Growth | ₹9,999 | ₹1,125 | ₹8,874 | 88.7% |
| Pro | ₹19,999 | ₹2,250 | ₹17,749 | 88.7% |

Singapore:

| Plan | Customer pays | AI cost | Left | Left % |
|---|---:|---:|---:|---:|
| Starter | S$89 | S$6.75 | S$82.25 | 92.4% |
| Growth | S$329 | S$16.88 | S$312.13 | 94.9% |
| Pro | S$659 | S$33.75 | S$625.25 | 94.9% |

"Left" is revenue minus eligible AI cost only. Hosting, database, storage,
payment fees, support and onboarding time, number rental, provider minimums,
absorbed failures, refunds, fraud, sales, marketing and development still come
out of it. It is not profit.

### Top-up margin (assumes the whole pack is consumed)

| Pack | India price | Our cost | Left | Margin | Singapore price | Our cost | Left | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | ₹999 | ₹450 | ₹549 | 55.0% | S$19 | S$6.75 | S$12.25 | 64.5% |
| 5,000 | ₹4,499 | ₹2,250 | ₹2,249 | 50.0% | S$89 | S$33.75 | S$55.25 | 62.1% |
| 10,000 | ₹7,999 | ₹4,500 | ₹3,499 | 43.7% | S$169 | S$67.50 | S$101.50 | 60.1% |

If US$1 moves to ₹100 the 10,000 pack's margin falls to 37.5%. Margin here is
(price − cost) ÷ price, before all other expenses.

Voice does not use credits (founder decision 2026-09-15). Pro's 100 included
minutes are limited by the per-plan minute cap, and at the measured
~US$0.18/minute all-in they cost Nudge up to ₹1,620 a month if fully used — so
Pro's "left after AI cost" above is about ₹16,130 (81%) for a customer who
also uses every voice minute. Re-check the per-minute figure against real
carrier and ElevenLabs invoices before selling live voice at volume.

## 5. High-volume and Enterprise deals

The self-serve tiers are sized for a normal small business. A customer with
**100+ inbound leads a day** is not one, and must not be sold Pro at list price.

Worked example: 100 leads/day ≈ 3,000 conversations/month. Assuming 8 AI
replies per conversation (unmeasured), that is 24,000 replies ≈ **33,600
credits ≈ ₹15,120 of AI cost a month on Sonnet 5** (≈ ₹7,560 on Haiku). Pro's
5,000 included credits cover about a seventh of it; at list price ₹4,900 is
left before hosting, support or anything else — not a deal to sell at list.

Two ways to price such a deal (both assume Pro = ₹19,999):

| | Monthly | Our AI cost | Left | Risk |
|---|---:|---:|---:|---|
| A. Committed credit block — Pro + 35,000 credits/month at ₹0.75 | ≈ ₹46,250 | ≈ ₹15,120 | ≈ ₹31,130 | margin shrinks if conversations run longer than assumed |
| B. Bring-your-own key — Pro-level flat fee, the customer pays their AI provider directly | ≈ ₹35,000 | ≈ ₹0 | ≈ ₹35,000 | none on AI usage |

At these assumptions B is both the safer and the larger margin; A only wins if
real conversations turn out much shorter than eight replies. Either way the
customer pays 65–75% less than the US$1,500/month they paid their previous
vendor.

**Implementation fee.** Mandatory setup fees were removed from the self-serve
tiers on 2026-09-11. A separately scoped, paid implementation for an Enterprise
deal (knowledge base, templates, calendar and CRM integration, Meta setup) is
allowed and recommended; founder guidance is ₹75,000–₹1,50,000 one-time,
decided per deal. It is not a list price.

**Annual billing.** No annual discount has been approved. The public pricing
page shows a "yearly, 2 months free" toggle (`ANNUAL_MONTHS_CHARGED = 10`) but
checkout only charges monthly — the yearly figure is display-only today. Avoid
annual discounts until a real month of consumption per customer has been
measured.

## 6. Meta billing (how it works today)

The customer owns their Meta Business Manager, WhatsApp Business Account,
phone number and the card attached to it. Meta charges that card for every
conversation. Nudge connects with the customer's access token
(`WhatsappAccount` stores the WABA id, phone-number id and encrypted token).
This is Meta's "Model A" and does not require Nudge to be a Tech Provider —
that only matters for self-serve Embedded Signup at scale.

The dashboard shows an **estimate** of Meta cost per campaign (rate ×
recipients). It does not show the customer's actual Meta bill; that lives in
their Meta Business Manager. Pulling real spend from Meta's API is not built.

If a customer's number is currently owned by a previous vendor's Business
Manager, it must be migrated out first, which needs that vendor's cooperation.

## 7. What is built and what is not (the truth as of 2026-09-15)

Built and live:
- The four subscription prices in INR and SGD, and the plan feature gates.
  Checkout (Razorpay for INR, Stripe elsewhere) charges `planPrice()` directly,
  so `plans.ts` is the price of record.
- Plan limits on contacts, seats, numbers, automations and campaign messages.
- Bring-your-own AI key on Pro (`byoLlm`, `LlmAccount`, restricted to
  `BYOK_ALLOWED_MODELS`).
- Enterprise plan assignment and per-org `featureOverrides` for bespoke caps.
- The seven-day trial and its expiry to a read-only state.
- Included credits shown on the public pricing page and in Settings → Billing.

Not built (a customer today gets *at least* the promised credits and nothing
stops them beyond it — Nudge silently absorbs the cost):
- A credit ledger: balance, deduction per AI call, reset each cycle, expiry.
- Any cap or pause when a balance reaches zero.
- Top-up pack purchase, auto-recharge, spending limits, balance UI.
- Trial credit enforcement (the 100-credit trial allowance).
- Per-customer AI spend alerts beyond the founder-side `PLAN_COST_ALERT_PCT`.
- Annual checkout.
- Real Meta spend on the dashboard.

`src/lib/model-router/usage.ts` logs AI usage asynchronously with approximate
model-family prices and swallows write failures. It prices anything named
"sonnet" at US$3 / US$15, so the founder-side AI-cost analytics currently
**overstate Sonnet 5 cost by 50%** and ignore cache tokens. It is analytics,
not a ledger; customers must not be debited from it.

The build that turns credits into a real balance is specified in
`docs/superpowers/plans/2026-09-15-credit-ledger.md` (≈35 hours, nine
independently shippable tasks): an exact-model rate card, an org-scoped grant
and debit ledger debited at the model-router doorway, calendar-month resets,
top-up purchase through the existing Razorpay/Stripe flow, founder grants,
and a balance on Settings → Billing. It carries six founder decisions that
must be answered before it ships.

## 8. Before live credit billing

1. Measure real replies per conversation and AI cost per customer from
   `AiUsage` for at least one full month of live traffic.
2. Build the credit ledger (§7) with tests; exclude simulation from real charges.
3. Decide how existing `free`, `front_desk`, trial and paid workspaces move
   to the new plans and balances. Never silently reprice, downgrade, or delete
   a subscriber's seats or numbers.
4. Validate a full billing cycle with test payments and representative AI
   traces before enabling live charges.

Usage is never permission to contact someone: consent, STOP, the 24-hour
service window, tenant isolation and role gates apply regardless of balance.

## References

- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- ElevenLabs agents pricing (voice component only): https://elevenlabs.io/pricing/agents
- Price of record in code: `src/modules/billing/plans.ts`
