# Meta compliance — inbound AI agent (customer-initiated)

Scope: the **customer messages the business first**, and Nudge's AI agent replies
inside the service window. This is the *narrow, permissive* compliance surface —
the heavy stuff (opt-in consent, template pre-approval, marketing pricing, the
250-conversation cap) lives on the **business-initiated** side and is deliberately
**out of scope here**. See [GO_LIVE_WHATSAPP.md](GO_LIVE_WHATSAPP.md) for the
credential/setup runbook this doc sits next to.

Companion to the 7 invariants in [AUDIT_REPORT.md](AUDIT_REPORT.md) §6. Nothing
here re-opens strategy — see [STRATEGY.md](STRATEGY.md).

> **Confidence flags.** Rules on the 24-hour window, pricing, Tech Provider
> onboarding, and number migration are stable Meta primary-doc facts (high
> confidence). The **Jan-2026 "AI Providers" terms** and the **June-2026 Meta
> Business Agent** are recent; verify exact wording on Meta's live pages before
> relying on them commercially. Sources are linked inline.

---

## TL;DR

Inbound-only is the *easy* compliance job. Customer messages first → 24-hour
**customer service window** opens → agent replies **free-form, no template, no
pre-approval, and (today) free per message**. What you must not break: keep the
agent **scoped to one business** (invariant #7), keep a **human-handoff path**,
honor **STOP permanently** (invariant #2), and stay inside the **24h window**
(invariant #6). All four are already implemented.

---

## 1. AI-agent policy (the only genuinely new area)

**Jan-2026 "AI Providers" rule** — Meta's WhatsApp Business terms bar
**"AI Providers"** (developers of *general-purpose* AI — LLMs, generative-AI
platforms, general-purpose assistants) from using the platform when that
general-purpose AI *is the primary product*. Target: "ChatGPT-on-WhatsApp".

- **Does NOT ban Nudge.** A business-scoped agent answering one clinic's own
  customers on that clinic's number is *customer service*, not a general-purpose
  assistant offered as a product. This carve-out **is** invariant #7. Keep it
  hard: no open-domain chit-chat, deflect off-topic requests, never present the
  agent to the end customer as a standalone AI product.
- Source: `developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers`
  (corroborated: TechCrunch, 2025-10-18, WhatsApp terms change).

**Meta Business Agent (~2026-06-03)** — Meta's own first-party AI agent across
WhatsApp/Messenger/Instagram (answers questions, recommends catalog products,
books appointments, qualifies leads, escalates to humans). For us:
- **No rule prohibiting third-party agents was introduced.** It was a product
  launch, not a policy change; the Jan-2026 terms still govern and still permit
  business-scoped third-party agents. The threat is **competitive, not
  compliance.**
- Reporting indicates Meta monetizes it via **WhatsApp Business Premium** tiers
  (token-based for large businesses) — i.e. Meta's full agent is *also* paid.
- **Flag:** June-2026 specifics unverified in-repo — confirm on
  `about.fb.com/news/2026/06/meta-business-agent/` before using in sales copy.

**Bot disclosure / handoff** — Meta does **not** currently force an "you're
talking to AI" disclosure on WhatsApp, and India has no AI-transparency law in
force that does. Meta's Business Messaging Policy **does** require a human path
and honoring stop requests. Implemented: `handoff_to_human`
([src/modules/agent/tools/handoff.ts](../src/modules/agent/tools/handoff.ts))
flips the conversation to `handoff` and tells the customer a person will take
over. **Recommended (optional):** light honest self-identification in the system
prompt ("I'm [Name], the assistant for [Business]") — not required, but reduces
deception-style complaints that hurt quality rating. Copy-only change in
[src/modules/agent/prompt.ts](../src/modules/agent/prompt.ts).

---

## 2. The 24-hour customer service window

- **Opens** on any customer message/call; **resets** to a fresh 24h on each new
  inbound message.
- **Inside:** free-form service messages (text/media/docs/interactive) via Cloud
  API, **no template, no pre-approval**. This is where the agent lives.
- **Outside:** free-form blocked; only pre-approved templates. Enforced in
  [src/modules/agent/window.ts](../src/modules/agent/window.ts) (invariant #6).
- **Pricing (July-2025 per-message model):** customer-initiated free-form
  replies are **free/unlimited**. So inbound agent replies cost **₹0 in Meta
  fees** — only Anthropic Haiku cost applies. Utility templates *inside* the
  window free; *outside* charged; marketing templates always charged.
- **Free entry points:** Click-to-WhatsApp ads / Page CTA give a **72-hour**
  window (relevant to the later marketing side, not organic inbound).
- Sources: `.../whatsapp/pricing`, `.../whatsapp/messages/send-messages`,
  `.../whatsapp/pricing/conversation-based-pricing`.

> Niche: the AI-Providers pricing doc's early-2026 Italy/EEA per-message charge
> (later mostly reversed) applies only to the *general-purpose AI Provider*
> category — **not** a business-scoped front desk. Does not touch us.

---

## 3. Going live with a real number (inbound-only, Model A)

**Business verification**
- **Nudge:** must verify its own business to become a Tech Provider + get
  Advanced Access (below). One-time.
- **Client:** Meta Business Verification **not required just to receive/reply to
  inbound** at low volume. The 250-conversation cap and unverified limits apply
  to **business-initiated** conversations (out of scope now). An unverified
  clinic can go live and answer inbound. → onboarding-speed advantage.

**Display name** — every number needs an approved, non-misleading display name
(Meta review; usually quick).

**Phone number** — cannot already be active on regular WhatsApp / WhatsApp
Business app. Use a fresh number or **migrate** (§5). Mobile/landline/virtual OK
if it can receive the OTP and isn't tied to a live WhatsApp account.

**What Nudge must have built**
- **App Review / Advanced Access** for `whatsapp_business_messaging` (send/
  receive) + `whatsapp_business_management` (manage WABA/numbers/templates).
- **Embedded Signup** — Meta-hosted OAuth that creates/links the client's WABA
  and returns tokens. **Current gap** — repo has a manual connect form
  ([src/app/(app)/settings/whatsapp/connect-form.tsx](../src/app/(app)/settings/whatsapp/connect-form.tsx),
  "Embedded Signup comes later"). Manual is fine for a test number + first design
  partners; Embedded Signup is needed before self-serve.
- **Webhook** — one HTTPS endpoint subscribed to `messages`. Done:
  [src/app/api/webhooks/whatsapp/route.ts](../src/app/api/webhooks/whatsapp/route.ts)
  (GET verify handshake + HMAC-SHA256, invariant #7-adjacent).

**Billing (Model A)** — the **client's** WABA is billed by Meta directly; Nudge
is not the payer and needs **no Meta line of credit**. (Line-of-credit / markup
is the Solution Partner / Model B path — out of scope.) Matches AGENTS.md.

---

## 4. Ongoing operational compliance (light for inbound)

- **Quality rating & messaging limits** — the 1K→10K→100K→unlimited tiers apply
  to **business-initiated** conversations; inbound replies don't consume them.
  Only real risk: enough blocks/reports to drop quality → number restricted. A
  scoped, helpful agent with handoff keeps it Green.
- **Enforcement** is warning-first, then escalating restrictions — not instant
  bans. Source: `.../whatsapp/policy-enforcement`.
- **Data use** — Cloud API **Hosting Terms**: Meta processes messages on behalf
  of / at instruction of the business, will **not** use message content for ads,
  retains only transiently. On our side: Haiku via `lib/model-router` (invariant
  #3) + Anthropic's no-train-on-API-data posture. Don't route message content
  anywhere ad-targeting/training-adjacent.
- **Commerce policy** — prohibited verticals apply even inbound (alcohol,
  tobacco, drugs/pharma, weapons, gambling, adult, MLM…). Clinics/salons fine,
  but keep the agent off medical advice — scope to booking/info/handoff.
- **STOP / opt-out** — honor permanently even for inbound. Done:
  `isStopMessage` + permanent opt-out in
  [src/modules/agent/inbound.ts](../src/modules/agent/inbound.ts) (invariant #2).
- **India** — **DPDP Act 2023** applies (notice, purpose limitation, consent,
  breach notice, deletion) — a privacy/data-handling obligation, not a messaging
  gate. **TRAI DLT does NOT apply to WhatsApp Cloud API** (that's SMS). No
  DLT/template registration with TRAI; the only template registration is Meta's,
  and inbound free-form needs none.

---

## 5. Setup sequence — Indian clinic, zero → live inbound agent

**Stage 0 — Nudge, once**
1. Meta App (Business type) + WhatsApp product.
2. Verify Nudge's business in Meta Business Manager.
3. App Review for Advanced Access to `whatsapp_business_messaging` +
   `whatsapp_business_management`. **Longest pole — start now.**
4. Embedded Signup (or manual connect form for first partners).

**Stage A — test number (~1h, free)** — see GO_LIVE_WHATSAPP.md Stage A. Proves
the `handleInboundMessage` → Haiku → `sendMessage` loop before any client.

**Stage B — clinic's real number**
- **No WhatsApp on the number / fresh number:** Embedded Signup → connect WABA →
  pick number → OTP verify → approve display name → live (often same day).
- **Number already on WhatsApp Business App (common) — the migration, #1 gotcha:**
  - **Back up chats first — history does NOT transfer** to Cloud API.
  - The number is **removed from the WhatsApp Business app** — owner loses the
    phone-app inbox for it (they now work leads in Nudge's dashboard). Get
    explicit acknowledgement before migrating.
  - Register number to WABA via Cloud API → OTP verify. Disable 2FA/PIN first if
    set.
  - Source: `developers.facebook.com/docs/whatsapp/cloud-api/get-started/migrate-existing-whatsapp-number-to-a-business-account`.

**Timelines:** test number today; fresh-number clinic same day; migrating clinic
same day once they accept losing app access + history. Only multi-day item is
Nudge's one-time App Review.

**Top gotchas:** (1) number already active on WhatsApp → migrate or use new; (2)
clients not warned about lost history/app access; (3) display-name rejection; (4)
webhook not subscribed to `messages` (silent — no inbound arrives); (5) client's
payment method must be on the WABA (Model A).

---

## Build gaps (small — flow is compliant-by-construction)

The inbound flow already has: signature-verified webhook, 24h-window
enforcement, permanent STOP, Haiku-only, business-scoped agent, human handoff.
Remaining:

1. **Embedded Signup** — the one real engineering gap for onboarding beyond
   hand-held first partners. (Manual form OK for design partners.)
2. **Migration-consent checkpoint** in onboarding — UI step where the clinic
   acknowledges losing app access + chat history before migrating. Prevents the
   worst support tickets.
3. **App Review submission** — gates everything; slowest step; start now.
4. **Optional agent self-identification** copy tweak — protects quality rating.
