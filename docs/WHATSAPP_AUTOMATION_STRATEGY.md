# WhatsApp Automation Strategy — Conversational Layer + Multi-Vertical Agents

> Research briefing + build plan for turning Nudge Reach from a one-way campaign
> tool into a two-way, AI-conversational WhatsApp platform that serves many
> business verticals. Synthesized 2026-06 from a deep-research pass + domain
> knowledge. **Confidence note:** the automated verification step of the research
> harness failed on an auth error, so claims below combine credibly-sourced
> search results with established platform knowledge. The single load-bearing
> fact (Meta's 2026 AI policy) was independently re-verified — see §1.

---

## 0. The headline that reshapes the product

**Meta bans general-purpose AI chatbots on the WhatsApp Business Platform,
effective Jan 15, 2026** (new API registrations bound since Oct 15, 2025).
Sources: TechCrunch, respond.io, Alibaba Cloud, imbrace.

- **Banned:** open-domain / ChatGPT-style assistants where the AI is the core
  product or WhatsApp is just a distribution channel for a general assistant.
- **Allowed:** business-specific automation — FAQs, customer support, bookings,
  order tracking, lead qualification, appointment reminders, authentication —
  where AI supports *one business's* operations.

**Implication for us:** every agent must be **scoped and grounded to its
business** (its knowledge, its tools, its domain) and must decline open-domain
chit-chat. This is a moat, not a constraint — it rules out lazy "ChatGPT on
WhatsApp" clones and matches the per-tenant, knowledge-grounded, tool-using
design that's correct anyway.

---

## 1. WhatsApp two-way / conversational rules (the economic engine)

- **The 24-hour customer service window.** When a customer messages the
  business, a 24-hour window opens. Inside it, the business can send **free-form
  "session" messages** (any text — including AI replies). Outside it, the
  business can only re-initiate with a **pre-approved template**.
- **Pricing (per-message model since July 1, 2025):** billing is per delivered
  *template* message, by category — **marketing** (most expensive),
  **utility/authentication** (much cheaper). **Service conversations — a
  business replying to a user inside the 24h window — are effectively free of
  WhatsApp fees.**
  - **So the "reply to people" feature is cheap:** inbound auto-replies inside
    the window cost only LLM tokens, not WhatsApp message fees. The money is on
    the **outbound campaign** side (marketing templates).
- **Inbound triggers automation:** Meta POSTs the inbound message to our webhook
  (`/api/webhooks/whatsapp`, already built). That's the entry point for the
  agent: inbound → route to agent → generate reply → send within the window.
- **Messaging limits / quality tiers:** numbers start capped (e.g.
  250–1,000 business-initiated conversations/day) and scale automatically with a
  healthy quality rating; poor quality (blocks, reports) drops the tier.
- **Opt-in / opt-out:** marketing requires prior opt-in; STOP must be honored
  permanently (already enforced in code). Conversational replies to a
  user-initiated message don't need marketing opt-in (the user started it).

---

## 2. Architecture decision: native core, n8n only as optional glue

**Recommendation: build the conversational layer natively in the existing
Next.js app. Do NOT make n8n the core.**

| Option | Verdict |
|---|---|
| **n8n as the core** (the YouTube-tutorial pattern: webhook → n8n → OpenAI node → reply) | ❌ Great for a 1-off demo, wrong for a multi-tenant SaaS. Per-customer flows in a visual tool become unversioned, untestable, hard to scale to thousands of tenants, and a debugging nightmare — exactly the "glitchy/buggy" outcome to avoid. |
| **Native conversational layer** (inbound webhook → our agent runtime → model-router → send) | ✅ Recommended. We already own the webhook, send queue, model-router, consent gate, per-org accounts. The agent is just one more module on a tested foundation: versioned, unit-testable, scalable. |
| **Hybrid** (native core + n8n for *per-customer integrations*) | ✅ Later. Once a customer wants "when someone books, add a row to *my* Google Sheet / *my* CRM," n8n (or our own connectors) is a fine way to let them wire their own tools without us coding each one. n8n is the *integration glue*, never the brain. |

How established platforms actually do it (AiSensy, WATI, Gallabox, Interakt):
LLM-backed agents + a **per-tenant knowledge base (RAG)** + **tool/function-
calling against REST APIs** + a **no-code builder** (structured prompt sections
+ per-industry templates). We copy this pattern.

---

## 3. Multi-vertical "training" — the concrete pattern

A business owner never "trains a model." Each tenant's agent = three configured
layers, all per-org data, no ML training:

1. **System-prompt template (per vertical).** Pick an industry → preset behavior
   (a real-estate template vs a clinic-receptionist template vs a restaurant
   template). Plus owner-filled sections: *About your business*, *Tone &
   personality*, *How it should handle requests*, *What to avoid*. (This is
   exactly AiSensy's "AI Agent Builder" structure.)
2. **Knowledge base (RAG).** Owner uploads documents / pastes text / gives a
   website URL. We chunk + embed + store per-tenant (isolated), and retrieve the
   relevant pieces into the agent's context at reply time. This is how the agent
   "knows" *this* shop's catalogue, hours, policies, price list.
3. **Tools (function-calling, per vertical).** The agent can take real actions
   by calling typed functions: `check_availability`, `book_appointment`,
   `lookup_order`, `list_properties`, `create_lead`, `handoff_to_human`.
   - **Safety:** read-only tools auto-run; **write/booking actions confirm with
     the customer before committing**; everything scoped to the tenant; a
     `handoff_to_human` tool when unsure (never hallucinate a price/booking).

How the non-technical owner sets it up: pick vertical template → fill 4 boxes →
upload a menu/price list/FAQ → toggle which tools to enable → connect a calendar
or sheet if booking is needed. No code, no training.

---

## 4. Market & targeting

**Target high-adoption WhatsApp markets; mostly skip the US/Western Europe.**

- **Tier 1 (go here first): India** — massive WhatsApp + WhatsApp Business
  penetration, price-sensitive SMEs, the exact wedge. Then **Indonesia, Brazil,
  Mexico, UAE/Saudi, Nigeria/South Africa, SE Asia.** WhatsApp is the default
  business channel in all of these.
- **Tier 3 (deprioritize): US & Western Europe** — SMS/iMessage/email dominate
  the US; Western Europe is mixed (Spain/Italy higher, UK/Germany lower).
  Not worth building *for* initially; revisit only for specific niches.
- **Beachhead verticals (canonical ranking in `STRATEGY.md` §5a).** The customer
  who *really* needs this is high-ticket, lead-driven, appointment-based, and
  owner-operated — where WhatsApp is the sales counter and slow replies + no-shows
  cost real money:
  1. **Hair-transplant clinics** — highest ticket, ~100% WhatsApp-lead-driven,
     brutal multi-week ghosting. Cleanest ROI.
  2. **Aesthetic / derma / skin clinics** — best scale × ticket × DM-first.
  3. **Cosmetic-focused dental** (implants/aligners/ortho) — biggest owner-
     operated base, best-documented no-show pain.
  4. **IVF / fertility** — highest LTV, best outbound-nurture fit (sequence
     after the top three).
  - **Alt-vertical pilot:** study-abroad consultants (purest test of the *chase*
    moat — first-to-reply wins).
- **Expansion / later tiers (NOT the beachhead):**
  - **Retail / e-commerce / D2C** — catalogues, order updates, re-engagement.
  - **Real estate** — lead qualification + site-visit booking (strong chase fit,
    but partly broadcast-driven).
  - **Restaurants / cloud kitchens** — reservations, orders.
  - ⚠️ **Salons / spas / gyms** — deprioritize as targets: their WhatsApp value
    is **promotional broadcasts** (built last) on low tickets → weak
    receptionist-replacement ROI. Self-serve lower tiers, not founder-sold.
- **Competitors (for positioning/pricing):** AiSensy, WATI, Interakt, Gallabox,
  DoubleTick — typically ~₹999–2,500+/mo tiers plus per-message markup on top of
  Meta's rate (consolidated billing is a major revenue stream). Our wedge stays
  **"photo/setup → done"** simplicity + the conversational agent, priced for the
  smallest shops.

---

## 5. Compliance & unit economics

- **Stay on the right side of Meta's AI policy (§0):** scope every agent to its
  business; add a guardrail so it refuses open-domain questions and hands off
  when out of scope. Never market the product as a "general AI assistant."
- **Consent / privacy:** marketing opt-in + permanent opt-out (built). India
  **DPDP Act**: store consent w/ source+timestamp, support deletion, encrypt
  tokens at rest (built). **GDPR** only matters if EU contacts are processed —
  another reason to stay Tier-1 first.
- **Keep LLM replies cheap:** cheapest capable model (Haiku) via the
  model-router (rule 3); **retrieve only the relevant knowledge chunks** instead
  of stuffing whole docs; **prompt-cache** the static system prompt + business
  profile; cap reply tokens. Inbound replies carry no WhatsApp fee (service
  window), so cost ≈ a fraction of a rupee per reply.
- **Onboarding many businesses (the platform play):** become a Meta **Tech
  Provider**, pass App Review for `whatsapp_business_management` +
  `whatsapp_business_messaging`, implement **Embedded Signup** (our per-org
  `WhatsappAccount` table is already built for this), and later **Solution
  Partner** status for consolidated billing + per-message markup (the AiSensy
  revenue model).

---

## 6. What to build in THIS codebase (phased)

We already have: inbound webhook, send queue, model-router (Haiku), consent
gate, per-org `WhatsappAccount`, Prisma + Supabase Postgres. The conversational
layer plugs onto this.

- **Phase 6 — Inbound conversation foundation.** `Conversation` +
  `ConversationMessage` models; webhook stores inbound messages + tracks the
  24h window per contact; a simulation path to inject inbound messages for
  testing. *(No AI yet — plumbing.)*
- **Phase 7 — Scoped, compliant auto-reply (the core).** `AgentProfile` per org
  (vertical template + business description + tone + do-nots); extend the
  model-router for multi-turn messages; generate a grounded reply from the
  business profile; send free-form within the window; on-topic guardrail +
  `handoff_to_human` fallback. Fully testable in simulation.
- **Phase 8 — Knowledge base (RAG).** Document/text/URL upload → chunk → embed
  (Voyage AI embeddings recommended) → pgvector in Supabase → retrieve into
  context. (Start simpler with Postgres full-text if we want to defer the
  embeddings dependency.)
- **Phase 9 — Tools / actions.** Per-vertical function-calling
  (`check_availability`, `book_appointment`, `lookup_order`, `create_lead`),
  read-only auto / writes confirmed; optional Google Calendar / Sheets / n8n
  integration for per-customer wiring.
- **Phase 10 — No-code agent builder UI + per-vertical templates + analytics.**

**First build = Phase 6 + 7:** the heart of "reply accordingly to these
people," compliant by design, testable end-to-end in simulation without a live
WhatsApp account.

---

## 7. Key decisions for the founder

1. **Architecture:** native core (recommended) vs n8n-centric. → native.
2. **First vertical template** to ship (shapes the prompt template + tools).
3. **Embeddings provider** for RAG in Phase 8 (Voyage AI recommended) — can defer.
4. **Tech Provider / Embedded Signup** application — start in parallel (it gates
   multi-business self-onboarding and takes Meta weeks to review).
