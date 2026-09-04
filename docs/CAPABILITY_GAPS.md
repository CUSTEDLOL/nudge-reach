# CAPABILITY GAPS — what to build from the competitor matrix (2026-08-29)

> **Superseded in part.** The founders decided (same day) to build Instagram/Facebook/
> TikTok, voice, Shopify, copilot + summaries, CRM integrations and a developer API —
> see `docs/ROADMAP.md` for the sequence. The evidence below still stands.

Input: the 57-row capability matrix (Nudge vs WATI, Gallabox, AiSensy, Interakt,
Respond.io, Yellow.ai, Gupshup, Manychat). Method: every row Nudge does not tick
was scored against (a) the beachhead buyer — high-ticket lead-gen clinics
(`docs/STRATEGY.md` §5, `AGENTS.md`), (b) the three moats, (c) what Meta's platform
actually requires today, (d) what the repo already has. The matrix is written in
the incumbents' frame; the ranking below is written in ours.

## The verdict in one table

| Priority | Row(s) in the matrix | Verdict | Why (evidence) | Effort |
|---|---|---|---|---|
| **1** | CTWA attribution · Campaign ROI / revenue attribution · Click-to-WhatsApp Ads | **Build now** | Clinics live on Meta ads: >65 % of social-influenced hair-transplant enquiries come from Instagram, CPL ₹1,200–2,400. Meta already attaches a `referral` object to the first inbound message from an ad (`source_url, source_id, source_type, headline, body, media_type, image_url, video_url, thumbnail_url, ctwa_clid`); ad conversations open a **72-hour free** window. Our webhook ignores it today (0 mentions). Storing it gives "leads → consults → deposits *per ad*" on the dashboard; posting `ctwa_clid` to Meta's Conversions API (`action_source: business_messaging`, event `Lead`) lets Meta optimise the client's ads toward leads that actually book — a moat-2 story no ₹999 tool tells. | 1–2 days (store + dashboard); +2 days CAPI |
| **2** | Instagram inbox/automation · Omnichannel inbox · Facebook Messenger | **Build now (after go-live)** | Instagram is lead source #1 for aesthetic clinics; 78 % of patients check IG before enquiring. Same Meta app, same agent, one more webhook. Permissions `instagram_business_basic` + `instagram_business_manage_messages`; **Advanced Access (App Review) is required to serve accounts we don't own** — the same review the Tech-Provider path needs, so file both together. 24-hour window, `messages` webhook. Messenger is ~free once IG is done (same platform). Zero IG code exists today. | 1–2 weeks |
| **3** | Multiple WhatsApp numbers | **Build now** | `WhatsappAccount.orgId @unique` (schema comment: "one connected number per org (MVP)"). Inbound already routes by `phone_number_id`, so the change is schema + Settings + sender choice on outbound. `docs/PRICING.md` already sells **AI Front Desk Pro — multi-location (₹24,999)** with nothing behind it. Unverified businesses get 2 numbers, verified up to 20 per Business Manager. | ~1 week |
| **4** | Website chat | **Cheap win** | Don't build a widget. A "chat on WhatsApp" button/QR (wa.me link with prefilled text) routes website visitors into the same agent, and a user-initiated conversation is a **free** service window. Ship a snippet generator in Settings. | 1 day |
| **5** | AI Copilot for human agents | **Small, later** | On hand-off the agent already knows the thread; a "suggest reply" button in the inbox composer reuses `generateAgentActionReply`. Nice for the concierge/owner UX, not a moat. | 2 days |
| **6** | WhatsApp chatbot / Flows (native forms) | **After Meta verification** | Flows = in-chat forms (booking, intake). Static Flows need no code; endpoint Flows (live slots) need a signed data-exchange endpoint. Cloud-API only; Meta approves the Flow and the template that opens it (1–3 days); no fee beyond message pricing. The agent already collects booking details conversationally, so value is moderate (pre-consult intake with photos/preferences). Do it once verified, when template review and tiers are unlocked. | 1 week |
| **7** | WhatsApp Payments / WhatsApp checkout | **After verification + PG partnership** | India in-chat UPI payments run through BillDesk/Razorpay/PayU/Zaakpay; the **merchant must be verified and the WABA marked verified**; still described as alpha ("work closely with Meta and the PG teams to unlock"); UPI cap ₹5,00,000. Today the hosted pay page + Razorpay link already delivers "collect the deposit" (moat 1). Revisit after verification. | 1 week when unlocked |
| **8** | WhatsApp product catalog · Abandoned cart · Order tracking · Shopify · WooCommerce | **On demand only** | Retail/D2C buyer, not clinics; incumbents' strongest ground (WATI/Interakt Shopify apps are years old). Cart recovery is *marketing* → opt-in must come from the store's consent checkbox (invariant 2). Build the day a store signs at ₹14,999/mo; the queue, consent gate and template pipeline make it ~2 weeks. | 2 weeks, on signature |
| **9** | HubSpot · Salesforce · Developer API | **On demand** | Clinics run Practo/Zoho/nothing. Outbound webhooks + API keys already exist (`dispatchWebhook`, Integrations); a read/write REST surface is a partner ask, not a clinic ask. | 3–5 days each |
| **10** | Voice calls · AI voice agent · Voice + chat + email | **Only if a paying clinic asks** | Different stack (telephony, STT/TTS, per-minute cost), none of the three moats, no voice code in the repo today. If built, it must ride the same knowledge base and booking tools, never a second brain. | weeks |
| **11** | Customer segmentation · AI conversation summaries · quality scoring · automated AI testing | **Already have (partly)** | Audiences/segments exist (`AudienceContact`, 24 files); summaries and CSAT-style scoring exist in code; the agent eval harness (`npm run eval:agent`, 14 scenarios) is the "automated AI testing" row. Tick these in the matrix. | — |
| **12** | BYO AI / multi-LLM / OpenAI-Claude-Gemini selection · 35+ channels · TikTok · SSO · IP whitelisting · dedicated hosting · predictive churn · enterprise compliance | **Never (for this company)** | Enterprise/agency rows that keep WATI and Yellow.ai as tools sold to thousands. BYO AI breaks invariant 3 (cheap, guarded runtime model) and moat 3 (done-for-you). Predictive churn is a vanity row. | — |

## The gate above all rows: Meta Business Verification → App Review → Tech Provider

- **Unverified today:** 250 business-initiated conversations / rolling 24 h, **2 phone
  numbers**, 250 templates. Verified + display-name review: tiers from 1,000/24 h
  upward, up to 20 numbers.
- **Tech Provider enrolment is now mandatory for ISVs; Embedded Signup is the default
  onboarding path.** Requirements: business verification, Tech Provider terms, App
  Review (Advanced Access for `whatsapp_business_messaging` /
  `whatsapp_business_management`). Default 10 new client businesses per 7 days; 200
  once verification + review + access verification are complete.
- Needs the legal entity (India proprietorship/GST decided). This unblocks rows 2, 6,
  7 and the "connect your own number in five minutes" promise. Nothing in the matrix
  matters more.

## What Meta's free agent does and does not do (why the moats hold)

Meta Business Agent (global since 2026-06-03): answers FAQs, recommends products,
books its own appointments, qualifies leads, hands off to a human. **Inbound only,
"no broadcast or campaign tools", self-serve tier runs on the WhatsApp Business app
"not the WhatsApp Business API", no team inbox, no CRM/external systems, no API or
webhooks.** Platform tier is invite-only, per-token, not resellable. Every row in
priorities 1–3 is something it cannot do.

## Sequence

1. Tonight: first client live (runbook in `PROGRESS.md`).
2. Week 1: CTWA attribution (row 1) + wa.me snippet (row 4) + start the Meta
   verification/App Review paperwork, requesting Instagram permissions in the same
   submission.
3. Weeks 2–3: multiple numbers (row 3) → makes the Pro SKU real.
4. Weeks 3–5: Instagram DM (row 2) — ships the day Advanced Access is granted.
5. After verification: Flows (row 6), in-chat UPI (row 7).
6. Everything in rows 8–10 waits for a signed client who asks.

## Sources

- Referral object fields, `referral_conversion` origin — 360dialog webhook reference:
  https://docs.360dialog.com/docs/messaging/webhook/webhook-reference
- `ctwa_clid` → Conversions API (`business_messaging`, `Lead`):
  https://whapi.cloud/blog/track-click-to-whatsapp-ctwa-clid
- Instagram messaging permissions / Advanced Access:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Flows (static vs endpoint, approval): https://developers.facebook.com/blog/post/2024/02/27/appointments-with-whatsapp-flows/ ,
  https://docs.360dialog.com/docs/messaging/flows
- Payments in India via PG (verified merchant, alpha, ₹5L UPI cap):
  https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg/ ,
  https://docs.360dialog.com/partner/messaging/commerce-and-payments/payments-india-only/receive-whatsapp-payments-via-payments-gateway
- Unverified limits (250 / 2 numbers) and tiers: https://blueticks.co/blog/whatsapp-api-without-meta-verification ,
  https://www.infobip.com/docs/whatsapp/get-started/business-verification
- Tech Provider / Embedded Signup mandate and onboarding limits:
  https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers ,
  https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide
- Clinic lead sources (Instagram share, CPL): https://ichelonconsulting.com/instagram-marketing-for-hair-transplant-clinics ,
  https://ichelonconsulting.com/insights/aesthetic-meta-ads-agency-india-2026
- Meta Business Agent scope/limits: https://www.wati.io/en/blog/meta-business-agent/ ,
  https://about.fb.com/news/2026/06/meta-business-agent/
