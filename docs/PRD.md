# PRD — Nudge (AI Front Desk for WhatsApp)

> This PRD was reframed to match the current trajectory. The original document
> described a one-way "photo → campaign" marketing tool ("Nudge Reach"). That
> capability is **kept** (§6) but is no longer the product — it is one feature
> inside the flagship. North star + rationale: `docs/STRATEGY.md`. Contract +
> invariants: `AGENTS.md`. Compliance: `docs/META_COMPLIANCE_INBOUND.md` and
> `docs/META_COMPLIANCE_MARKETING.md`.

## 1. Problem

The businesses that most need this — **high-ticket, lead-gen clinics**
(hair-transplant, aesthetic/derma, cosmetic-focused dental, IVF; see
`STRATEGY.md` §5a) — run their sales on WhatsApp and lose money two ways:

1. **Slow / no lead response.** Leads arrive on WhatsApp 24/7 (often from paid
   ads the clinic already spent on). The owner is a practitioner, in procedures
   all day. Leads decay within the hour; a large share are answered late or never;
   the fastest-replying competitor wins.
2. **No-shows + ghosted leads.** 15–40% no-show rates; high-ticket prospects
   comparison-shop for weeks and go quiet. Nobody chases them.

A human receptionist (~₹18–25k/mo) covers one 8-hour weekday shift, one location,
one chat at a time — and the after-hours leads (when speed matters most) die.

## 2. The product

**An AI Front Desk** — a done-for-you AI *employee* that runs the clinic's
WhatsApp end-to-end, on the clinic's own number. It is sold as an outcome, priced
against the headcount it replaces (`STRATEGY.md` §6).

Two sides, both compliant, both on the same number:

- **Inbound (the service window).** Customer messages first → the scoped agent
  answers from the clinic's knowledge, **books into the real calendar** with
  availability checks, captures leads, and hands off to a human when needed.
  Free-form, no template, effectively free of WhatsApp fees.
- **Outbound (opt-in only).** To contacts who opted in, the agent **chases**:
  follow-ups to ghosted leads, booking reminders, no-show recovery, and curated
  **marketing campaigns** to the clinic's own first-party list — all via approved
  templates. **No paid ads required**; the audience is the clinic's existing,
  consented customers. Cold lists are forbidden (invariant #2).

The moats (`STRATEGY.md` §4): real actions in real systems, outbound revenue
generation, done-for-you concierge setup — precisely what Meta's free Business
Agent does not do.

## 3. MVP scope (the shippable core)

Much of this is built (see `PROGRESS.md`). The current-focus slice:

- Auth (Supabase), one org per user, roles enforced server-side.
- **Connect a WhatsApp number** — per-client manual entry of `WABA_ID` /
  `PHONE_NUMBER_ID` / access token (encrypted at rest) for the first clients;
  Embedded Signup is the scale path (not blocking MVP).
- **Inbound agent:** webhook (signature-verified, idempotent) → scoped reply via
  `lib/model-router` (Haiku) → send within the 24h window; on-topic guardrail +
  `handoff_to_human`; STOP → permanent opt-out.
- **Booking action:** `check_availability` + `book_appointment` against Google
  Calendar; write actions confirm with the customer before committing.
- **Outbound follow-up engine:** ghosted-lead follow-up, booking reminders,
  no-show recovery via approved templates, consent-gated + window-aware.
- **Campaigns (opt-in):** build a `MARKETING`/`UTILITY` template (see §7),
  submit for approval, send to an **opted-in** audience, rate-limited + double
  consent-gated. Live mode → Cloud API; simulation → mocked.
- **Dashboard:** per-conversation + per-campaign sent/delivered/read/clicked and
  cost; quality-rating + messaging-tier visibility.
- **Simulation mode** works end-to-end with zero external keys (invariant #4).

## 4. Explicitly out of scope (do NOT build now)

- **Cold outreach of any kind** — list scraping, purchased numbers, "warming"
  drips to non-opted-in strangers. Never (invariants #1, #2).
- Running Meta / Click-to-WhatsApp ads on behalf of clients as a required step
  (changes the client's cost base; optional lead engine only).
- Email channel (product 2, same platform).
- Generative AI images/video (runtime cost; later paid add-on).
- Languages beyond English + Hinglish (for now).
- Real payment processing (billing module stubbed; payment *links* are in scope
  as a moat action, processing is not).
- Beachheading salons / spas / gyms (blast-first, low-ticket — `STRATEGY.md` §5a).

## 5. Core flows

**Inbound (primary):** customer messages the clinic → agent answers from
knowledge → offers slots → books into calendar (confirmed) → captures lead →
hands off if out of scope. All inside the service window, free-form.

**Outbound follow-up:** lead goes quiet / appointment upcoming / no-show → engine
selects an approved template → **checks consent + window** → sends → replies land
back in the inbound flow (re-opening the window for free-form).

**Campaign (opt-in marketing):** describe product/offer or upload a photo →
**Generate campaign** (§7) → edit + preview → **Submit for approval** → pick an
**opted-in** audience → cost estimate → **Run** (enabled once APPROVED, or always
in simulation) → dashboard fills.

## 6. Data model (Prisma — current shape; adjust names as needed)

- **Org** { id, name, ownerUserId }
- **WhatsappAccount** { id, orgId, wabaId, phoneNumberId, displayName,
  accessTokenEncrypted, qualityRating, messagingTier, status }
- **AgentProfile** { id, orgId, vertical, businessDescription, tone, doNots,
  enabled }
- **Conversation** { id, orgId, contactId, status (open/handoff/…),
  lastInboundAt (drives the 24h window), lastMessageAt, unreadCount }
- **Contact** { id, orgId, name, phoneE164, optedIn Bool, optInSource,
  optInAt, optedOutAt }
- **Product** { id, orgId, name, photoUrl, attributes Json }
- **Campaign** { id, orgId, productId, name, status
  (DRAFT/TEMPLATE_PENDING/TEMPLATE_APPROVED/SENDING/SENT/FAILED), createdAt }
- **Template** { id, campaignId, name, language, category
  (MARKETING/UTILITY/AUTHENTICATION), componentsJson, metaTemplateId, metaStatus,
  rejectionReason }
- **Audience** { id, orgId, name } + **AudienceContact** { audienceId, contactId }
- **Message** { id, orgId, conversationId?, campaignId?, contactId, direction,
  status (QUEUED/SENT/DELIVERED/READ/CLICKED/FAILED), metaMessageId, errorCode,
  costMinorUnits, sentAt }
- **WebhookEvent** { id, raw Json, type, processedAt } — idempotent processing.

Consent (`optedIn` + `optInSource` + `optInAt`) is load-bearing: it is the proof
that defends every outbound send. Imports can never resurrect an `optedOutAt`.

## 7. Campaign generation spec (the marketing sub-feature)

Call through `lib/model-router` with the cheap default model. **Vision** path when
a photo exists; **text** path otherwise. Request **JSON only**.

### System prompt (starting point)
> You are a senior WhatsApp marketing strategist for Indian small businesses.
> Given a product/offer (image and/or short description), produce ONE
> high-converting, Meta-policy-compliant WhatsApp template. Rules: the body is
> warm, concrete and under 600 characters; it uses `{{1}}` exactly once near the
> start for the customer's first name; it states one clear offer and one clear
> next step; no ALL-CAPS shouting, no misleading claims, no prohibited content.
> Keep it local and personal (light Hinglish allowed if natural). Return ONLY a
> JSON object — no markdown, no commentary.

### Required JSON shape
```json
{
  "productName": "string",
  "campaignAngle": "one sentence on the strategy",
  "header": "string, <=55 chars",
  "body": "string containing {{1}} exactly once",
  "footer": "string, short, MUST contain an opt-out e.g. 'Reply STOP to unsubscribe'",
  "buttons": [
    { "type": "URL", "text": "Book now", "url": "https://example.com" },
    { "type": "QUICK_REPLY", "text": "Send details" }
  ],
  "sampleName": "a realistic Indian first name",
  "imageTreatment": "one sentence: how to shoot/crop/light this photo",
  "notes": "one short practical tip"
}
```

### Guardrails in code (not left to the model)
- Set the correct `category` (prefer `UTILITY` for service/booking content —
  cheaper + lower-risk — and `MARKETING` only for genuine promotions); reject/
  repair output missing the `{{1}}` variable or the opt-out footer.
- Strip code fences and parse defensively; on parse failure, retry once with a
  stricter instruction, then surface a friendly error.
- Cap `max_tokens` low; templates are short.

## 8. Cost transparency

Inbound agent replies inside the window carry **no WhatsApp fee** (only Haiku
tokens). For outbound templates, show an estimate before sending
(`recipients × per-message rate by category`; rate is config, see
`docs/WHATSAPP_CLOUD_API.md`), and reconcile with actual billable cost from
webhook pricing data in live mode. Surface the client's current **messaging tier**
and **quality rating** so they can see reach growing as consent + quality grow.
