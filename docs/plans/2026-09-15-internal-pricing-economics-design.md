# Internal pricing economics guide — design

**Approved:** 2026-09-15

## Purpose

Replace the outdated pricing explainer with a concise, founder-only guide that
makes Nudge's India and Singapore unit economics understandable at a glance.
It must distinguish verified costs from planning assumptions and explain both
cash contribution and fully loaded contribution without changing product prices
or billing behavior.

## Deliverables

- Keep `docs/plans/2026-09-11-tiered-pricing-design.md` as the authoritative
  pricing and economics record.
- Regenerate `docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx` from that record.
- Create a matching review PDF under `output/pdf/`.
- Update `PROGRESS.md` and commit only the documentation work.

## Content

Keep the guide short and plain-spoken. Cover:

1. Executive summary and approved plan prices.
2. Credit mechanics, model rates, representative AI tasks and allowance reach.
3. Variable costs: AI, voice and payment processing.
4. Shared costs: Vercel, Supabase and optional email/storage overhead.
5. Service costs: founder-led onboarding and support.
6. India and Singapore cash contribution and fully loaded contribution.
7. Light, expected, heavy and high-volume Enterprise scenarios.
8. Pricing guardrails for top-ups, BYOK, implementation fees and Enterprise.
9. Current implementation truth and a short founder action list.

The core plan table should expose three figures: cash contribution, fully loaded
contribution and the usage level that makes the tier unsafe. Meta WhatsApp fees
remain outside Nudge's cost because the client pays Meta directly.

## Planning assumptions

- US$1 = INR 90 = SGD 1.35.
- One credit = US$0.005 of eligible platform-paid AI cost.
- Model subscription margins at full included-credit consumption.
- Voice = US$0.15/minute until live invoices replace the assumption.
- Razorpay domestic payments = 2% plus 18% GST on the fee (2.36% effective).
- Stripe Singapore domestic cards = 3.4% + SGD 0.50 per payment, before tax.
- Core shared infrastructure = Vercel Pro US$20 + Supabase Pro US$25 monthly.
- Founder/service time = US$20/hour; onboarding is amortized over six months.

Every non-contractual number must be labeled as an assumption and paired with
the date/source or the measurement needed to replace it.

## Implementation truth

The new guide must distinguish code-complete from operationally live:

- Built in code: exact Sonnet/Haiku rate card, cache-token accounting, credit
  grants, trial and paid-period resets, ledger balance/debits, and model-router
  metering.
- Not production-enabled: the schema push and RLS rollout.
- Still pending: friendly zero-balance behavior, top-up checkout, founder credit
  controls, customer balance UI and low-balance alerts.

## Verification

Recalculate every table from the stated assumptions, render the Word document
and PDF, inspect every page for clipping or broken tables, and compare the
implementation-status section against the credit-ledger plan and current code.
