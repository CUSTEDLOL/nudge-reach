# PRICING — Nudge

How we charge, why, and the exact numbers per market. This is the operational
companion to **`docs/STRATEGY.md` §6** (the "why") — if the two ever disagree,
STRATEGY.md owns positioning and this doc owns the mechanics. Founder-tunable;
the dials are called out explicitly. All prices are **rounded, local-currency,
not live FX** (see invariant below).

---

## 0. The model in one line

> **A one-time setup fee + a monthly subscription, sold as ONE flagship price per
> market — priced against the human it replaces, not the software it beats.**
> Annual prepay waives the setup fee. The flagship is never tiered on price; the
> cheap self-serve tiers exist only for parity and anchoring.

This satisfies four goals at once: **cash upfront** (setup fee), **recurring
revenue** (monthly), the **₹18–25k salary anchor** (STRATEGY.md north star), and
**founder-led sanity** — the setup fee filters tire-kickers, which matters when
each concierge onboarding costs ~half a day and one founder can do ~10–12/month.

---

## 1. Why setup-fee + monthly (and not the alternatives)

| Option considered | Verdict | Reason |
|---|---|---|
| **Setup fee + monthly** (chosen) | ✅ | Cash + MRR + commitment filter. Setup fee is defensible precisely because it pays for the one thing Meta's free agent refuses to do — done-for-you onboarding. |
| Tiered subscription ₹5k / ₹10k / ₹15k | ❌ | Destroys the anchor. The power of "an employee for a third of the salary" is **one confident number**. Offer ₹5k and buyers anchor there, you're back to fighting AiSensy, and you've taught the market the "employee" is negotiable. An employee doesn't come in discount tiers. |
| Pure subscription, no setup | ❌ | Leaves cash on the table **and** invites unqualified signups — each of which burns half a day of founder onboarding time you can't spare. |
| Pure outcome / per-booking pricing | ❌ (as core) | Best-aligned to the outbound moat and the surging 2026 trend, but metering invites disputes and SMBs hate unpredictability. We capture the *narrative* via a **performance guarantee** (§4) instead of metering the *mechanics*. |

**Tier on value metrics, never on price.** The only flagship split is
single-location vs multi-location/high-volume — a capacity difference, not a
discount ladder.

---

## 2. The price sheet (4 core markets)

Setup fee ≈ **one month's subscription**. Annual = **10× monthly** (2 months
free) **with setup waived** — the elegant resolution of "we want both cash and
MRR": a big upfront payment *and* a locked year from the most committed clients.

### AI Front Desk — single location (the hero SKU, all marketing leads here)

| Market | Setup (one-time) | Monthly | Annual (setup waived, 2 mo free) | Receptionist salary (anchor) | Flagship as % of salary |
|---|---|---|---|---|---|
| 🇮🇳 India | ₹20,000 | **₹14,999** | ₹1,49,990 | ₹18–25k loaded | ~65–85% |
| 🇲🇾 Malaysia | RM 1,500 | **RM 1,199** | RM 11,990 | RM 2,200–2,700 | ~45–55% |
| 🇦🇪 UAE | AED 2,000 | **AED 749** | AED 7,490 | AED 3,400 (+allowances) | ~22% |
| 🇸🇬 Singapore | S$800 | **S$699** ⚠️ | S$6,990 | S$2,600–2,800 (clinic) | ~25% |

⚠️ **Singapore is a proposed change from S$599 → S$699.** The data shows real
headroom (a Singapore clinic receptionist earns ~13× the Indian one; at S$699
you're still only ~25% of one month's salary). The constraint is competitor
optics, not willingness-to-pay. **If adopted, update STRATEGY.md §6 to match.**

### AI Front Desk Pro — multi-location / high volume

| Market | Setup (one-time) | Monthly | Annual |
|---|---|---|---|
| 🇮🇳 India | ₹35,000 | ₹24,999 | ₹2,49,990 |
| 🇲🇾 Malaysia | RM 2,500 | RM 1,999 | RM 19,990 |
| 🇦🇪 UAE | AED 3,500 | AED 1,249 | AED 12,490 |
| 🇸🇬 Singapore | S$1,300 | S$1,199 | S$11,990 |

**Other six currencies** (SAR, IDR, BRL, MXN, GBP, USD) follow the same rule:
setup ≈ 1× monthly, annual = 10× monthly, priced at each market's validated
multiplier vs India. Generic USD flagship ≈ **$179/mo + $199 setup**.

**Regional multipliers (validated by salary + willingness-to-pay data):**
India **1.0×** · Malaysia **~1.9×** · UAE **~2.5×** · Singapore **~3.0×**. India
is the tightest market — keep it pinned at ~one month's salary; that is the
strongest anchor we have.

---

## 3. The self-serve tiers (kept, unchanged from STRATEGY.md §6)

These are **not** the business — they exist so we (a) never lose a feature
checklist and (b) make the flagship look reasonable next to a ₹22k/mo hire. No
setup fee, self-serve, month-to-month.

| Plan | India | Singapore | Malaysia | US | Role |
|---|---|---|---|---|---|
| Free / Starter / Growth / Pro | ₹0 / 999 / 2,499 / 5,999 | S$0 / 39 / 95 / 219 | RM0 / 49 / 139 / 329 | $0 / 29 / 69 / 159 | Tool tiers (parity + anchor) |

**The ₹5k/₹10k/₹15k "tiering" instinct lives HERE, in the cheap layer — never in
the flagship.** Moat features (calendar booking, follow-up engine, concierge
onboarding) never leak into these tiers; that leak is the drift test in
STRATEGY.md §9.

---

## 4. Creative levers (priority order)

1. **Performance *guarantee*, not performance *pricing*.**
   > "If the AI Front Desk doesn't book at least **X appointments** / recover
   > **Y no-shows** in month one, that month is free."

   Same psychological punch as outcome pricing, zero metering headache, and a
   devastating closer for a founder-led sale. Set X/Y conservatively per vertical
   from real onboarding data. **Open decision: launch with this or add after the
   first ~10 case studies?** (see §7)

2. **Malaysia MDEC SME Digitalisation Grant — 50% covered** for buyers via
   approved vendors. Becoming an approved provider effectively halves the buyer's
   price with **zero discount from us**. Pursue before pushing Malaysia hard.

3. **Reseller margin, baked in now.** Founder-led today, but the channel is the
   path from ~25 to ~400 accounts (STRATEGY.md §8). List prices already leave
   **20–40%** for a future reseller/white-label partner — don't discover later
   that the price can't fund a channel.

4. **UAE: bundle Arabic-language support.** Competitors charge extra for it; we
   include it, and it helps justify the AED price.

---

## 5. Pricing guardrails (the drift test for pricing)

Any of these means we're sliding back toward commodity-CRM pricing — stop:

- **Discounting the flagship below the salary anchor** to win a price-sensitive
  deal. If they want ₹5k, they want the self-serve tier, not the employee.
- **Splitting the flagship into price tiers.** Value-metric SKUs (single vs
  multi-location) only.
- **Waiving the setup fee for cash-pay clients.** It's waived *only* for annual
  prepay — its job is to filter commitment, and free onboarding invites flakes
  that cost half a day each.
- **Quoting Meta pass-through as "our price."** Meta's per-message rates
  (marketing ~₹0.86, utility ~₹0.115, service free in the 24h window) are billed
  to the client on top and are **not** our subscription — never conflate them.

---

## 6. Unit economics & founder-led scale math

- **Runtime cost is negligible.** Haiku via `lib/model-router` is fractions of a
  rupee per conversation (invariant #3); Meta's per-message pass-through is billed
  to the client, not us. Gross margin on the subscription is very high.
- **Onboarding is the binding constraint, not price.** ~half a day/client →
  **~10–12 clients/month solo.**
- **Trajectory:** 10 clients/month at ₹20k setup + ₹14,999/mo →
  **~₹9L MRR by month 6** plus ~₹2L/month in setup cash. This is *another*
  argument for a high price: at founder scale you want fewer, higher-value
  clients, not a flood of ₹5k ones.
- **$1M ARR:** ~250–450 flagship clients (STRATEGY.md §8); the reseller channel
  is how you get there without a large direct sales team.

---

## 7. Open decisions (to settle before launch)

1. **India setup fee: ₹15k vs ₹20k vs ₹25k?** Doc assumes **₹20k** (≈ 1.3×
   monthly). ₹15k = higher conversion, less filter; ₹25k = more cash, stronger
   filter, some conversion drag.
2. **Launch with the performance guarantee, or add after ~10 case studies?**
3. **Onboarding-creep risk.** This whole model assumes onboarding stays ~half a
   day. **If clients push heavy customization and it creeps to 1–2 days, the
   setup fee must jump to ₹40–50k** (matching the done-for-you agent shops), which
   changes the conversion model. Re-price the moment onboarding time doubles.

---

## 8. Competitive reference (2026, current)

Three bands. We are in band 2, priced against band 0 (the human).

| Band | Who | Price | Our relationship to it |
|---|---|---|---|
| **0 — the human** | Front-desk receptionist | ₹18–25k/mo loaded (SG ~S$2,700, UAE ~AED3,400, MY ~RM2,500) | **This is our anchor.** We are a third of it. |
| **1 — commodity WhatsApp tooling** | AiSensy (₹1,500–3,200, +₹1,999 AI add-on), WATI (₹2,499–16,999), Interakt, DoubleTick, Gallabox (→₹24,999) | ₹1,500–5,000/mo | A knife fight we don't enter. |
| **1.5 — Meta Business Agent** | Meta's native AI | **FREE for small biz** (monetizes Aug 1 2026; large biz $2/1M tokens) | **Inbound-only, self-setup, no outbound chasing.** It sets our floor to ₹0 for "AI replies" — which is *why* we charge for actions + outbound + done-for-you. |
| **2 — the AI-agent tier (ours)** | Haptik "AI For All" (₹10k+), done-for-you agent shops (₹5–15k/mo + ₹50k–1.5L build) | ₹10,000–15,000/mo | Our flagship lands dead-center. |
| **Global reference** | Smith.ai, Goodcall, Rosie, Dialzara, Podium AI Employee | $49–99 headline, **$400–900 all-in** | Almost all **inbound phone-answering**, flat-tier + usage. **Outbound is priced separately and steeply** (Dialzara outbound $750/mo). Nobody bundles outbound + real actions + done-for-you — our whitespace. |

**Meta reframes everything:** since "AI that replies" is now free, 100% of our
price must be justified by the three moats Meta gives away nothing on — real
actions in the client's systems, outbound revenue chasing, and done-for-you
setup. Lead every sales conversation with that contrast.

---

## 9. Invariants for this doc

- Prices are **local-currency, rounded, founder-set — not live FX.** Ten
  currencies supported (INR, USD, AED, SAR, SGD, MYR, IDR, BRL, MXN, GBP).
- **All marketing leads with the flagship**, quoted against the human it replaces.
- Meta pass-through message costs are always billed to the client and shown
  separately from our subscription.

*Competitive figures compiled July 2026 from vendor pricing pages and pricing
aggregators; treat "all-in" and overage estimates as directional and re-verify
Meta's rate card (next noted effective date on file: July 1, 2026) before
quoting.*
