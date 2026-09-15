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
| Voice on an eligible plan (Nudge-funded speech + carrier) | Yes |
| Sending an already-written campaign or a manual message | No |
| Follow-up reminders, no-show recovery, quiet-lead nudges (pre-written templates) | No |
| Ordinary CRM sync, rule-based lead scoring, API calls | No |
| Booking or payment-link execution after AI work | No extra charge |
| AI running on the customer's own provider key (Pro / Enterprise) | No |

Meta's per-conversation charges are the customer's own bill and are never
converted into credits. Drafting one campaign uses credits once; sending that
text to 1,000 opted-in people does not.

**Balance rules.** Included credits reset every billing cycle. Purchased credits
expire 12 months after purchase; the soonest-expiring eligible balance is spent
first. Auto-recharge is off by default. A zero balance pauses Nudge-funded AI
and voice, never the manual inbox, campaigns or follow-ups the plan already
includes. Simulation mode never consumes purchased credit. Nudge absorbs its
own failed or retried AI work; a customer-requested regeneration is new usage.

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
checked 2026-09-11 — Haiku 4.5 US$1 in / US$5 out per million tokens; Sonnet
4.6 US$3 / US$15. Nudge runs Sonnet at runtime (`RUNTIME_MODEL`, since
2026-08-29). One credit therefore costs us **₹0.45 / S$0.00675**.

### What one task costs (uncached, single call; real conversations vary)

| Example | Credits | Our cost (India) | Value at smallest pack (India) |
|---|---:|---:|---:|
| Short Haiku reply (2,000 in / 300 out) | 0.7 | ₹0.32 | ₹0.70 |
| Same-size Sonnet reply | 2.1 | ₹0.95 | ₹2.10 |
| Longer Sonnet summary (8,000 in / 500 out) | 6.3 | ₹2.84 | ₹6.29 |
| One voice minute (assumed US$0.15 all-in) | 30 | ₹13.50 | ₹29.97 |

### How far the included credits go (Sonnet, example reply size)

| | Entry 200 | Starter 1,000 | Growth 2,500 | Pro 5,000 |
|---|---:|---:|---:|---:|
| ≈ AI replies a month | 95 | 476 | 1,190 | 2,380 |
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

Voice draws on the same credit balance. At the assumed US$0.15/minute, Pro's 5,000
credits buy about 166 voice minutes if used for nothing else (at US$0.25, 100
minutes). Never advertise the full chat allowance and the full voice allowance
as simultaneously included. The voice figure is an assumption, not a carrier
quote; verify speech, inference and carrier costs before selling live voice.

## 5. High-volume and Enterprise deals

The self-serve tiers are sized for a normal small business. A customer with
**100+ inbound leads a day** is not one, and must not be sold Pro at list price.

Worked example: 100 leads/day ≈ 3,000 conversations/month. Assuming 8 AI
replies per conversation (unmeasured), that is 24,000 replies ≈ **50,400
credits ≈ ₹22,700 of AI cost a month on Sonnet** (≈ ₹7,600 on Haiku). Pro's
5,000 included credits cover a tenth of it; at list price Nudge loses money.

Two ways to price such a deal (both assume Pro = ₹19,999):

| | Monthly | Our AI cost | Left | Risk |
|---|---:|---:|---:|---|
| A. Committed credit block — Pro + 50,000 credits/month at ₹0.75 | ≈ ₹57,500 | ≈ ₹22,700 | ≈ ₹34,800 | margin shrinks if conversations run longer than assumed |
| B. Bring-your-own key — Pro-level flat fee, the customer pays their AI provider directly | ≈ ₹35,000 | ≈ ₹0 | ≈ ₹35,000 | none on AI usage |

B is the safer margin; A is the bigger top line. Either way the customer pays
55–70% less than the US$1,500/month they paid their previous vendor.

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
model-family prices and swallows write failures. It is analytics, not a
ledger; customers must not be debited from it without a redesign that covers
atomic reservations and debits, idempotent payment webhooks, concurrent calls,
expiry, refunds, duplicate provider events, cache-specific and exact-model
pricing, customer caps and reconciliation.

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
