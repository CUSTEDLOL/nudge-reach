# WhatsApp Cloud API — Integration Reference

This is reference material for building the messaging layer. **Meta changes endpoints, versions, and rates — verify against the official "WhatsApp Business Platform" docs and pricing page during the build.** Treat the numbers here as accurate-as-of-early-2026 starting points, not gospel.

## Accounts and onboarding
- Hierarchy: **Meta Business Account → WhatsApp Business Account (WABA) → phone number**. A display name and the number must be approved.
- Best onboarding for SMEs: **Embedded Signup** — a Meta-hosted flow you embed so the retailer provisions their own WABA + number inside your app in minutes. This is the heart of "stupidly simple"; prioritize getting it working, but ship manual-token entry first so the founder can test.
- For local dev/testing, Meta provides a test number and a limited set of test recipients without full business verification.

## Templates (required for marketing)
- Business-initiated marketing must use a **pre-approved template**. Create via:
  `POST https://graph.facebook.com/<API_VERSION>/<WABA_ID>/message_templates`
- A template has `name`, `language`, `category` (MARKETING | UTILITY | AUTHENTICATION), and `components` (HEADER, BODY, FOOTER, BUTTONS).
- Approval is **asynchronous**. Listen for the `message_template_status_update` webhook and also poll `GET /<WABA_ID>/message_templates` as a fallback.
- Rejections are common; surface `rejection_reason` to the user and let them edit + resubmit. Avoiding rejections (clean copy, correct category, valid variable examples) is a real product value.

### Example create payload
```json
{
  "name": "summer_kurta_promo",
  "language": "en",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "IMAGE", "example": { "header_handle": ["<media-handle-from-resumable-upload>"] } },
    { "type": "BODY", "text": "Hi {{1}}, our new summer kurtas just arrived — 20% off this week only.", "example": { "body_text": [["Priya"]] } },
    { "type": "FOOTER", "text": "Reply STOP to unsubscribe" },
    { "type": "BUTTONS", "buttons": [
      { "type": "URL", "text": "Shop now", "url": "https://shop.example.com" },
      { "type": "QUICK_REPLY", "text": "Send catalog" }
    ]}
  ]
}
```
Image headers require uploading the media first (resumable upload API) to get a handle; for body-variable values you pass an `example`.

## Sending
`POST https://graph.facebook.com/<API_VERSION>/<PHONE_NUMBER_ID>/messages`
```json
{
  "messaging_product": "whatsapp",
  "to": "<recipient-e164>",
  "type": "template",
  "template": {
    "name": "summer_kurta_promo",
    "language": { "code": "en" },
    "components": [
      { "type": "header", "parameters": [ { "type": "image", "image": { "link": "https://cdn.example.com/kurta.jpg" } } ] },
      { "type": "body", "parameters": [ { "type": "text", "text": "Priya" } ] }
    ]
  }
}
```
- Auth: `Authorization: Bearer <access_token>`.
- Marketing templates may only be sent to **opted-in** users — enforce this in your send pipeline.
- Respect **messaging limits / quality rating** tiers per number; throttle the send queue accordingly.

## Webhooks
- Subscribe to the `messages` field. Verify the subscription with your verify token, and verify each payload's `X-Hub-Signature-256`.
- You receive **status updates**: `sent` → `delivered` → `read`, plus `failed` with error codes, and **inbound messages** (use these to detect STOP/opt-out and to open the free 24-hour service window).
- Make webhook processing **idempotent** (store raw events, dedupe by message id).

## Pricing (per-message model — verify current rates)
- Since **July 1, 2025**, billing is **per delivered template message** (not per 24-hour conversation).
- Categories: **marketing** (most expensive), **utility** and **authentication** (~80–90% cheaper), **service** (replies inside the customer's 24-hour window — **free**).
- India example base rate (early 2026): **~$0.0118 per marketing message**, plus a BSP/markup of roughly **$0.003–$0.010**. India moved to **local-currency (INR) billing in Jan 2026** with marketing up ~10%.
- Product implications to build around:
  - Make the per-message rate a **config value** and show cost estimates before sending.
  - Favor flows that pull customers into the **free service window** (click-to-WhatsApp entry points, QR codes) so follow-ups cost nothing.
  - Steer transactional sends (order/appointment updates) to **utility** templates to cut cost.

## Compliance checklist (enforce in code + UX)
- [ ] Capture and store **opt-in** with source and timestamp; only opted-in contacts receive marketing.
- [ ] Provide and honor **opt-out** (STOP). Set `optedOutAt`; never message opted-out contacts again.
- [ ] Use the correct **category** for each template; don't disguise marketing as utility.
- [ ] No purchased/scraped lists. CSV import must include an opt-in confirmation step.
- [ ] India **DPDP Act 2023**: store consent, support data access/deletion requests, encrypt access tokens at rest.
- [ ] Surface template rejection reasons; never auto-bypass review.
