# First Real Retailer — Onboarding & Go-Live Runbook

_How to take the app from "deployed in simulation" to "one real shop owner sends a real WhatsApp campaign to their real customers." This is the activation gate everything hinges on._

---

## 0. Where the repo stands today (audit, 2026-06-24)

- **Branch `main`, clean.** Last commit `909156a` (11 days ago). Only an untracked local `.claude/settings.local.json`. Nothing in flight.
- **Built & deployed:** Phases 0–5 complete. Live at **https://nudge-reach.vercel.app** in **`SEND_MODE=simulation`**. 61 unit tests passing (per PROGRESS.md; the suite runs on your Mac — it couldn't run in the cloud sandbox due to a macOS-vs-Linux native-binary mismatch in `node_modules`, which is an environment artifact, not a code issue).
- **Full MVP loop works in simulation:** sign in → upload photo → AI generates compliant campaign → edit + preview → import opted-in audience → run (simulated) → delivery/read/click stats + INR cost estimate.
- **Live WhatsApp path: code-complete but unverified.** The live driver, template submission, and webhook handling exist, but there's **no Meta Business Account connected**. `.env.local` is missing the live credentials: `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (only `META_APP_SECRET`, `WHATSAPP_API_VERSION`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_MARKETING_RATE_INR` are set).

**Bottom line:** nothing needs *building* to demo. To onboard a *real* retailer who sends to *real* customers, the gap is **Meta WhatsApp setup + flipping to live mode + verifying the live path** — mostly account/ops work, not code.

---

## 1. Two onboarding tracks — pick per retailer

**Track A — Demo/validation (today, zero setup):** Keep `SEND_MODE=simulation`. Onboard the shop, import their contacts, generate and "send" a campaign, show the stats dashboard. Perfect for discovery and getting a verbal commit. Customers don't actually receive messages.

**Track B — Real send (the activation gate):** Requires the Meta steps below. The shop's customers actually receive the WhatsApp campaign. Do this for your **first 1–3 committed shops** only, once.

Run Track A in every discovery meeting. Graduate the most excited shop to Track B.

---

## 2. Track B prerequisites — Meta WhatsApp setup (one-time)

> This is the part that takes real-world time (ID verification, template review). Start it early. There is **no code** to write — the app already speaks the Cloud API.

1. **Meta Business Manager** — create/verify a Business account (business.facebook.com). Business verification can take 1–3 days; start now.
2. **Meta Developer App** — create an app, add the **WhatsApp** product.
3. **WhatsApp Business Account (WABA) + phone number.**
   - Easiest for the *retailer's own* number: **Embedded Signup** (not yet built in-app — see §4). For your *first* shop, the manual path is fine.
   - Manual path: in the app's WhatsApp setup, add a phone number to the WABA. Meta gives a free **test number** for early testing; use it before the shop's real number.
4. **Get the three credentials:** `WABA_ID`, `PHONE_NUMBER_ID`, and a long-lived/system-user `ACCESS_TOKEN`.
5. **Webhook:** point the Meta app's webhook to `https://nudge-reach.vercel.app/api/webhooks/whatsapp` using the **same** `WHATSAPP_WEBHOOK_VERIFY_TOKEN` already in your env. The GET handshake + signed POST handling already exist.

## 3. Flip the app to live mode

1. In Vercel project `nudge-reach` env vars (and `.env.local` for local), set:
   - `SEND_MODE=live`
   - `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
   - confirm `TOKEN_ENCRYPTION_KEY` is set (the app refuses to boot in live mode without the full `WHATSAPP_*` set — by design).
2. Redeploy. The app validates env at boot; a missing var fails fast.
3. **Verify the live path end-to-end with the Meta test number + your own phone as the "customer"** before any real shop:
   - Connect the WABA in `/settings/whatsapp`.
   - Generate a campaign → submit the template → confirm it reaches **APPROVED** (real Meta review now, not the 10s mock — can take minutes to hours).
   - Add your own opted-in number to an audience → run → confirm you receive the WhatsApp message, and that delivered/read/clicked statuses flow back via the webhook.
   - Test an inbound **STOP** → confirm it permanently opts that contact out.
4. **Verify the founder action from Phase 5:** Supabase → Authentication → URL Configuration → Site URL = production URL + add to Redirect URLs (otherwise new production sign-ups bounce to localhost). Still outstanding per PROGRESS.md.

## 4. Onboarding the actual shop (Track B, ~30–45 min with you)

1. Sit with the owner (in person or screen-share). Create their account; org is auto-created on first dashboard visit.
2. **Consent first.** Only import contacts who've opted in. Use the CSV-paste import (it forces an explicit consent confirmation). Never resurrect an opted-out contact. This is enforced in code — respect it operationally too.
3. Photograph a real product → generate → edit copy with the owner so it sounds like *them* → preview.
4. Submit the template, wait for Meta approval (set expectations: not instant in live mode).
5. Once approved, pick the opted-in audience → show the cost estimate → **send a small first batch** (e.g., 20–50 customers), not the whole list.
6. Watch the stats dashboard together. The activation win = **a real customer replies or clicks.** Capture that moment (screenshot/quote/testimonial).

---

## 5. Known gaps / decisions to make before scaling Track B

- **Embedded Signup not built.** Manual creds work for 1–3 shops; you'll want Embedded Signup before onboarding shops at volume (each shop needs its own WABA/number). This is the **single biggest pre-scale engineering item.**
- **One WhatsApp account per org (MVP).** Fine for now.
- **Cost rate** is the configurable `WHATSAPP_MARKETING_RATE_INR` (₹0.99 default). Re-verify against Meta's current India pricing (~₹0.86 marketing / ₹0.115 utility as of Apr 2026) so the in-app estimate is honest.
- **Local `next dev` OOMs** on long idle (per PROGRESS); use `npm run build && npx next start` locally.
- **Template approval latency** is real in live mode — bake it into the onboarding expectation and the demo (don't promise instant).

---

## 6. Build / test / deploy — what's actually left

| Area | State | Action needed |
|---|---|---|
| Core MVP (simulation) | ✅ Done, deployed | None — demo today |
| Unit tests (61) | ✅ Passing on Mac | Re-run on your machine before any change; CI optional |
| Live WhatsApp send | ⚠️ Code-complete, unverified | Meta account + creds + live verification (§2–3) |
| Webhook (status/STOP) | ✅ Code exists | Verify with real Meta events (§3) |
| Supabase prod auth URL | ⚠️ Outstanding | 1-min config fix (§3.4) |
| Embedded Signup | ❌ Not built | Build before scaling Track B (§5) |
| Cost rate accuracy | ⚠️ Default ₹0.99 | Re-verify vs Meta India pricing |

**To onboard your first real retailer, you do NOT need to write code.** You need: Meta Business verification + WABA + creds, flip to live mode, verify once, then sit with the shop. The only code item before *scaling* is Embedded Signup.
