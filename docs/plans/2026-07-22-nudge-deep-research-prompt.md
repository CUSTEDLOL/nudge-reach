# Nudge — Deep Research Brief (paste into ChatGPT Deep Research / Gemini Deep Research / Perplexity)

## Context — who we are and what we've already decided

I'm building **Nudge**, an "AI Front Desk" for small businesses on WhatsApp — a
done-for-you AI employee (not a self-serve tool) that runs a small business's
WhatsApp end-to-end. It's priced against the ₹18,000–25,000/month human
receptionist it replaces, not against ₹999/month CRM software.

**One-liner:** "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk
RUNS it — it books into your real calendar, chases every lead that goes quiet,
collects payments, and we set the whole thing up for you. It's not software.
It's your best employee, for a third of the salary."

**What's already shipped and working (in simulation + live via the official
WhatsApp Cloud API):**
- Inbound AI agent, scoped to one business's knowledge base, answering on the
  business's own WhatsApp number within the 24-hour service window.
- Real calendar booking: checks availability and books into Google Calendar,
  confirmed with the customer before committing.
- Outbound "Revenue-Recovery" engine: approved-template follow-ups to ghosted
  leads, booking reminders, no-show recovery — consent-gated, opt-in only.
- Payment links sent in-chat (deposit collection before no-shows).
- Knowledge ingestion from a business's website, PDFs/menus (vision), and
  Google Business Profile listing.
- A kept self-serve CRM/inbox/campaign layer as lower-priced tiers, purely for
  feature parity and price-anchoring — not the headline product.
- Concierge (founder-led) onboarding: we configure the knowledge base, flows,
  templates and integrations for the client.

**Chosen beachhead vertical:** high-ticket, lead-generation clinics —
hair-transplant, aesthetic/dermatology, cosmetic dentistry, IVF. Deliberately
NOT generic salons/gyms (low-ticket, blast-marketing-first, weaker fit for an
outbound-recovery pitch). Rationale: these businesses already pay for paid-ad
leads, the owner is a practitioner who can't answer WhatsApp all day, leads
decay within the hour, and no-show/ghosting rates are high (15–40%) on
high-value bookings — so "we chase every quiet lead and recover no-shows" is a
direct revenue argument, not a nice-to-have.

**Business model:** Meta "Tech Provider" (Model A) — the client's own WhatsApp
Business Account connects to us; Meta bills the client directly for
conversation costs; we earn only the subscription (zero message-cost
liability on our side). Distribution: founder-led direct sales for the first
10–25 clients in India, then a reseller/white-label channel (agencies,
freelancers) at 20–40% margin to scale toward ~250–450 flagship clients
(~$1M ARR target). Market sequencing: India → Malaysia → Singapore → UAE.

**Pricing (current, as of July 2026):** one-time implementation/setup fee +
flat monthly subscription, quoted as ONE flagship price per market (no
price-tiering on the flagship — only a single-location vs. multi-location SKU
split). India: ₹20,000 setup + ₹14,999/month (~65–85% of a receptionist's
salary). Malaysia ~RM1,199/mo, Singapore ~S$699/mo (proposed), UAE
~AED749/mo. Annual prepay = 10× monthly, setup waived. Self-serve CRM tiers
sit underneath at ₹0/999/2,499/5,999 (India) purely as anchors — not the
business.

**Competitive landscape as we currently understand it (2026):**
- **Commodity WhatsApp CRM tools** (AiSensy, WATI, Interakt, Gallabox,
  DoubleTick) — ₹999–17,000/month, huge install base, dominant SEO/YouTube
  funnels, some now bolting on shallow "AI" add-ons. We deliberately do not
  compete here on price or feature checklists.
- **Meta Business Agent** — Meta's own free native AI agent inside WhatsApp
  Business (launched June 2026), inbound-only, self-setup, learns from a
  Facebook page, no outbound chasing, no real external-system actions. This
  sets the floor for "AI replies on WhatsApp" at $0 and is the reason our
  entire price has to be justified by things it doesn't do.
- **Done-for-you AI agent shops** — Haptik and similar, ₹10,000–15,000/month
  plus ₹50,000–1,50,000 build fees; enterprise-scoped, slower, pricier to
  onboard.
- **Global inbound-voice/chat AI-employee tools** (Smith.ai, Goodcall, Rosie,
  Dialzara, Podium AI Employee) — mostly phone-answering, $49–99 headline but
  $400–900/month all-in; outbound is priced separately and steeply (e.g.
  Dialzara outbound ~$750/month). None of them appear to bundle outbound
  lead-chasing + real calendar/payment actions + fully done-for-you setup in
  one flagship price the way we're positioning Nudge.

**What I need from you:** I want an outside, evidence-based gut-check on all of
the above — not a restatement of what I already believe. Treat every claim
above as a hypothesis to verify, not a fact to assume.

---

## Research questions

### A. Market validation
1. How large is the addressable market for high-ticket lead-gen clinics
   (hair-transplant, aesthetic/derma, cosmetic dentistry, IVF/fertility) in
   India, Malaysia, Singapore, and the UAE — count of clinics, typical monthly
   ad/lead spend, and how much of their sales process already runs on
   WhatsApp today? Cite sources; flag where data is thin or estimated.
2. Is there public evidence (case studies, review sites, founder posts,
   Reddit/Twitter/LinkedIn discussion, G2/Capterra reviews) of these clinics'
   actual pain with slow WhatsApp response times and no-shows/ghosted leads —
   or is this pain assumed rather than demonstrated?
3. Are there other verticals with a comparably strong "high response speed +
   high no-show cost + already paying for leads" profile that we may be
   under-weighting versus the chosen beachhead?

### B. Competitive intelligence
4. Verify current (2026) pricing, feature scope, and positioning for AiSensy,
   WATI, Interakt, Gallabox, DoubleTick, Meta Business Agent, Haptik, and any
   other India/SEA-focused "WhatsApp AI agent for clinics/SMBs" product we may
   be missing. Has any of them announced or shipped outbound follow-up/lead
   recovery, real calendar booking, or payment-collection features since
   mid-2026 that would erode our stated moats?
5. Are there other startups (India, SEA, MENA, or global) explicitly
   positioning as a "done-for-you AI employee/front-desk" (not a CRM) for
   WhatsApp or similar messaging channels, priced against a human salary
   rather than software? Who, at what price, at what traction (funding,
   customer count, reviews)?
6. Independently assess: are Meta Business Agent's inbound-only + no
   outbound-chasing + no real-system-action limitations still true as of the
   research date, or has Meta expanded its scope? This is load-bearing for
   our entire moat argument.

### C. Pricing & willingness-to-pay
7. Sanity-check the receptionist salary anchors used (India ₹18–25k/month,
   Malaysia RM2,200–2,700, UAE AED3,400+allowances, Singapore S$2,600–2,800
   for a clinic-type receptionist) against current 2026 salary data for each
   market. Are these realistic, and does our flagship price genuinely land at
   the stated 25–85% of that salary in each market?
8. Is a "one-time setup fee + flat monthly, no price tiers on the flagship"
   model well-supported by how similar B2B SMB-services businesses
   (vertical SaaS, agency-style AI tools, done-for-you services) price and
   sell in these markets? Any evidence this converts better or worse than
   tiered subscription pricing for a similarly-priced SMB service purchase?
9. Would a performance guarantee ("book at least X appointments or the
   month's free") plausibly increase conversion for a founder-led sale at
   this price point, based on how comparable guarantee-backed B2B services
   are perceived/sold?

### D. Technical feasibility & risk
10. What are the realistic failure modes and reliability limits (as of 2026)
    of using an LLM as an agent that (a) books into a live Google Calendar
    with availability checks, (b) sends WhatsApp template messages via the
    official Cloud API within Meta's policy constraints, and (c) triggers
    real payment links — for a small, non-technical clinic's operations,
    unattended? Where do other companies doing similar agentic
    booking/payment flows report the highest error/complaint rates?
11. What are the current (2026) Meta WhatsApp Business Platform policies and
    likely trajectory around: 24-hour service-window rules, business-initiated
    template messaging, AI-agent-specific policy restrictions (the "agent
    must stay scoped to one business, not general-purpose" type rules), and
    Tech Provider / Embedded Signup requirements for scaling past manual
    per-client WABA setup? Any recent enforcement actions or policy changes
    relevant to an AI agent sending real actions on a client's behalf?
12. Given "cheap LLM at runtime" (small/cheap model class, not a frontier
    model) is a deliberate cost-control decision, what's the current
    state-of-the-art evidence on how much reliability/quality is sacrificed
    at that tier for agentic tool-calling tasks (structured booking,
    following domain-specific business knowledge, refusing out-of-scope
    requests) versus a frontier model — and is that gap closing or widening
    in 2026?

### E. Go-to-market
13. For a founder-led sales motion into ~10–25 high-ticket clinics in one
    city/region before opening a reseller channel: what does realistic sales
    cycle length, close rate, and CAC look like for comparable
    done-for-you SMB software/service sales in India? Any benchmarks or
    case studies?
14. What channels (associations, conferences, referral networks, paid
    acquisition, content/SEO) do hair-transplant/aesthetic-derma/cosmetic-
    dental/IVF clinic owners in India actually use to discover and evaluate
    new vendors — and which of those are realistically accessible to a
    solo/small founder team without an existing network in this vertical?

---

## Output format requested

1. **Executive summary** (10–15 bullets): for each hypothesis above, state
   CONFIRMED / PARTIALLY SUPPORTED / CONTRADICTED / INSUFFICIENT EVIDENCE,
   with the single strongest piece of evidence for each verdict.
2. **Market & competitive findings** — organized by section A/B above, with
   sources cited inline and dates on all pricing/feature claims (this space
   moves fast; note when a source is more than ~3 months old).
3. **Pricing sanity-check table** — our stated numbers vs. what you found,
   per market.
4. **Technical & policy risk list** — ranked by severity, each with what
   would have to be true for it to actually break the product or the
   business model.
5. **Top 5 things that most surprised you** — deliberately look for
   disconfirming evidence, not just confirming evidence. If everything above
   checks out cleanly, say so explicitly and explain why you're confident
   rather than just agreeing.
6. **Open questions you could not resolve** — be explicit about what's
   genuinely unknowable from public sources vs. what needs primary research
   (e.g., actually calling clinics).
