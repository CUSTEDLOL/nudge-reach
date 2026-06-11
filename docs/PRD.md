# PRD — Nudge Reach (WhatsApp)

## 1. Problem
Small retailers in India (boutiques, kirana, F&B, salons) know WhatsApp is where their customers are, but they cannot run real campaigns: the official WhatsApp Business Platform is a bureaucratic maze (Business Manager → WABA → number registration → template approval), and writing a good promotional message is its own skill. Existing tools (WATI, AiSensy, Interakt) assume marketing literacy and still leave onboarding clunky.

## 2. The wedge
**Photo in → compliant campaign out.** The retailer uploads one product photo. The app generates the full campaign: a punchy header, a personalized body, a compliant footer with opt-out, CTA buttons, and a Meta-ready template — plus a one-line tip on how to shoot/edit the photo. The AI copywriting is table stakes; the moat is removing the two genuinely painful things: **onboarding** and **compliance**. Make those invisible.

## 3. MVP scope (build this)
- Email/Google sign-in (Supabase Auth), one org per user.
- Connect a WhatsApp Business Account (Meta Embedded Signup). For MVP, also allow manual entry of `WABA_ID`, `PHONE_NUMBER_ID`, and a system-user access token so the founder can test before Embedded Signup is approved.
- Upload a product photo (Supabase Storage) or type a short product description.
- Generate a campaign via `lib/model-router` (see §7). Fields are editable after generation.
- Live WhatsApp-style preview that updates as fields are edited.
- Build the Meta `MARKETING` template payload from the campaign; submit it for approval; track approval status (PENDING/APPROVED/REJECTED) via webhook + polling fallback.
- Contacts: CSV import + manual add, each with an explicit opt-in flag and source. Audiences (simple segments).
- Send a campaign to an audience: queued, rate-limited, consent-gated. Live mode hits the Cloud API; simulation mode mocks it.
- Dashboard: per-campaign sent / delivered / read / clicked, plus an estimated and (in live mode) actual cost.

## 4. Explicitly out of scope (do NOT build now)
- Email channel (this is product 2, on the same platform).
- Generative AI images / video (runtime cost; later paid add-on). Use the retailer's own photo with deterministic framing/branding only.
- Languages beyond English + Hinglish.
- Real payment processing (stub the billing module).
- Anything that contacts non-consenting numbers or scrapes numbers.

## 5. Core user flow
1. Sign in.
2. (First run) Connect WhatsApp — Embedded Signup, or manual token entry.
3. Upload photo / describe product → **Generate campaign**.
4. Review & edit header/body/footer/buttons; watch the live preview.
5. **Submit for approval** → template goes to Meta; status shown.
6. Import or pick an opted-in audience; see the cost estimate.
7. **Run campaign** (only enabled once template is APPROVED, or always in simulation mode).
8. Watch the dashboard fill in delivery/read/click events.

## 6. Data model (Prisma — adjust names as needed)
- **Org** { id, name, ownerUserId }
- **WhatsappAccount** { id, orgId, wabaId, phoneNumberId, displayName, accessTokenEncrypted, qualityRating, status }
- **Product** { id, orgId, name, photoUrl, attributes Json }
- **Campaign** { id, orgId, productId, name, status (DRAFT/TEMPLATE_PENDING/TEMPLATE_APPROVED/SENDING/SENT/FAILED), createdAt }
- **Template** { id, campaignId, name, language, category (MARKETING), componentsJson, metaTemplateId, metaStatus, rejectionReason }
- **Contact** { id, orgId, name, phoneE164, optedIn Bool, optInSource, optedOutAt }
- **Audience** { id, orgId, name } + **AudienceContact** { audienceId, contactId }
- **Message** { id, campaignId, contactId, status (QUEUED/SENT/DELIVERED/READ/CLICKED/FAILED), metaMessageId, errorCode, costMinorUnits, sentAt }
- **WebhookEvent** { id, raw Json, type, processedAt } — for idempotent processing.

## 7. Runtime AI generation spec
Call through `lib/model-router` with the cheap default model. **Vision** path when a photo exists; **text** path otherwise. Request **JSON only**.

### System prompt (use verbatim as a starting point)
> You are a senior WhatsApp marketing strategist for Indian small retail businesses. Given a product (image and/or short description), produce ONE high-converting, Meta-policy-compliant WhatsApp MARKETING template. Rules: the body is warm, concrete and under 600 characters; it uses `{{1}}` exactly once near the start for the customer's first name; it states one clear offer and one clear next step; no ALL-CAPS shouting, no misleading claims, no prohibited content. Keep it local and personal (Indian retail voice; light Hinglish allowed if natural). Return ONLY a JSON object — no markdown, no commentary.

### Required JSON shape
```json
{
  "productName": "string",
  "campaignAngle": "one sentence on the strategy",
  "header": "string, <=55 chars",
  "body": "string containing {{1}} exactly once",
  "footer": "string, short, MUST contain an opt-out e.g. 'Reply STOP to unsubscribe'",
  "buttons": [
    { "type": "URL", "text": "Shop now", "url": "https://example.com" },
    { "type": "QUICK_REPLY", "text": "Send catalog" }
  ],
  "sampleName": "a realistic Indian first name",
  "imageTreatment": "one sentence: how to shoot/crop/light this photo",
  "notes": "one short practical tip"
}
```

### Guardrails in code (not left to the model)
- Force `category = MARKETING`; reject/repair output missing the `{{1}}` variable or the opt-out footer.
- Strip code fences and parse defensively; on parse failure, retry once with a stricter instruction, then surface a friendly error.
- Cap `max_tokens` low (campaigns are short) to control cost.

## 8. Cost transparency (show the retailer)
Display an estimated campaign cost before sending: `recipients × per-message marketing rate`. Make the rate a config value (see `docs/WHATSAPP_CLOUD_API.md` for current India figures) and label it an estimate. In live mode, reconcile with actual billable cost from webhook pricing data.
