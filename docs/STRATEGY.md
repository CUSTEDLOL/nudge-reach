# STRATEGY — Nudge

The "why" behind every product decision. If a feature, price, or line of copy
doesn't serve this, it's wrong. Condensed contract lives in `AGENTS.md`.

---

## 1. What the company is becoming

Nudge is **not building another WhatsApp CRM.** It is building a done-for-you
**AI Front Desk** — a complete AI *employee* that runs a small business's
WhatsApp end-to-end. It is priced against the **₹18–25k/month human it replaces**
(S$2,500+ in Singapore), not against ₹999 software.

## 2. The market — why "another CRM" loses

The WhatsApp CRM market is owned:

- **AiSensy** — 150k+ brands, ₹999 entry, a free tier, 5,000+ partners, a
  dominant YouTube/SEO funnel.
- **WATI** — global, Shopify channel, Sequoia/Tiger-funded.
- **Interakt** — Reliance-backed.

Competing with them on tool features at tool prices is a guaranteed loss.

Worse: on **June 3, 2026, Meta launched Meta Business Agent** — a FREE native AI
agent inside WhatsApp Business that answers questions, recommends products, books
basic appointments, and qualifies leads, learning from a business's Facebook
page. **"AI that replies on WhatsApp" is now free platform plumbing.** Any product
whose pitch is "AI answers your WhatsApp" is now competing with free.

## 3. What we sell instead — an AI employee, not a tool

The product is a complete, done-for-you AI Front Desk that runs the business's
WhatsApp. It is sold as an *outcome*, priced against a headcount.

**The USP, in one line (north star for all copy):**
> "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk RUNS it — it books
> into your real calendar, chases every lead that goes quiet, collects payments,
> and we set the whole thing up for you. It's not software. It's your best
> employee, for a third of the salary."

## 4. The three moats (our entire defensibility)

These are precisely what Meta's free agent does **not** cover. Every build
decision must strengthen at least one.

1. **Real actions in the client's real systems.** Actually booking into their
   Google Calendar with availability checks, sending real payment links, writing
   to their CRM. Meta's SMB agent learns from a Facebook page; it cannot act in
   external systems. *(Shipped: Google Calendar booking, `src/modules/calendar`.)*
2. **Outbound revenue generation.** The agent CHASES: follows up with ghosted
   leads via approved templates, sends booking reminders, recovers no-shows,
   re-engages after the 24h window. Meta's agent is inbound-only. *(Shipped: the
   Revenue-Recovery follow-up engine, `src/modules/followup`.)*
3. **Done-for-you service.** We set up the knowledge base, flows, templates and
   integrations; the client does nothing. We sell a product; SMBs at this price
   point buy an outcome. *(Shipped: concierge onboarding, `src/modules/concierge`.)*

## 5. Business model & distribution

- **Meta "Model A" (Tech Provider).** The client's WhatsApp Business Account
  connects to us; Meta bills the client directly for conversations; we earn the
  subscription. **Zero billing liability** for message costs.
- **Sales motion.** Founder-led direct sales for the first 10–25 clients in ONE
  vertical (clinics/salons), then a **reseller/white-label channel** — agencies
  and freelancers at **30–40% recurring margin** — scaling toward ~400 accounts.
- **Market sequencing.** India first (volume + hardening) → Malaysia → Singapore
  → UAE (via resellers later).

## 6. Pricing logic

Priced against the human it replaces, in each market's LOCAL currency (rounded,
founder-tunable, not live FX).

| Plan | India | Singapore | Malaysia | US | Role |
|---|---|---|---|---|---|
| Free / Starter / Growth / Pro | ₹0 / 999 / 2,499 / 5,999 | S$0 / 39 / 95 / 219 | RM0 / 49 / 139 / 329 | $0 / 29 / 69 / 159 | Self-serve tool tiers (parity + price anchor) |
| **AI Front Desk** (flagship) | **₹14,999** | **~S$599** | **~RM1,199** | **~$179** | Agent + integrations + follow-up + concierge |

The lower tiers exist so we (a) never lose on a feature checklist and (b) make the
flagship's price look reasonable next to a ₹22,000/mo hire. **All marketing leads
with the flagship.** Ten currencies are supported (INR, USD, AED, SAR, SGD, MYR,
IDR, BRL, MXN, GBP).

Full mechanics — setup fee + monthly + annual, per-market price sheet, competitive
analysis, and pricing guardrails — live in **`docs/PRICING.md`**. (Note: PRICING.md
proposes moving the Singapore flagship S$599 → S$699; adopt there before updating
this table.)

## 7. Positioning of the existing feature set

The CRM / shared inbox / campaigns / templates / automations / analytics we
already built are **KEPT** — they become the self-serve lower tiers. Their
strategic job is feature parity and price-anchoring, not the headline. The
flagship — agent + calendar integration + follow-up engine + concierge
onboarding — is what all marketing leads with.

## 8. The $1M ARR math

~**250–450 clients** across markets on the flagship tier ≈ **$1M ARR**. At
₹14,999/mo (~$180), ~450 India clients ≈ $970k/yr; blended across higher-ARPU
Singapore/UAE clients the number lands sooner. The reseller channel is how you
get from ~25 founder-sold accounts to ~400 without a large direct sales team.

## 9. What this means for the build (the drift test)

Any of these is a red flag that the product is sliding back to a commodity CRM —
stop and correct:

- Copy that calls Nudge a "WhatsApp CRM" or leads with campaign blasting.
- A moat feature (calendar, follow-up, concierge) leaking to the free tiers
  instead of gating to the flagship.
- The agent behaving as a general-purpose chatbot instead of a scoped front desk.
- Runtime code reaching for an expensive model, or a send path that skips consent
  or the 24h window.

The distribution — not more features — is the bottleneck. Build the moat, keep it
demoable in simulation, and get it in front of 10 clinics/salons.
