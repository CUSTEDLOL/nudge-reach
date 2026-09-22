# Free Trial Acquisition Funnel — Design

**Date:** 2026-09-20  
**Status:** Superseded for the shared acquisition-trial experience by
`docs/plans/2026-09-21-simplified-free-trial-design.md`; retained as the
original clinic-campaign rationale.

**Owner:** Nudge

## 1. Decision

Build a clinic-focused, no-card acquisition trial that gives a prospect a real,
tenant-isolated Nudge workspace in simulation mode. The trial ends after **seven
days or 15 AI-generated replies, whichever comes first**.

The campaign flow is:

1. A Meta ad sends the prospect to `/free-trial`.
2. The prospect creates a trial and teaches the AI about their business.
3. A guided product tour helps them test the AI and inspect the resulting inbox.
4. The product leads them to book a free setup demo.
5. They can buy a paid plan after the demo, or check out immediately if already
   convinced.

This is a time- and usage-limited trial, not a new permanent free plan. The
commercial plans and prices in
`docs/plans/2026-09-11-tiered-pricing-design.md` remain unchanged.

## 2. Strategic fit

The landing page must still sell Nudge as an **AI Front Desk**, not as another
WhatsApp CRM and not merely as an AI reply bot. The trial lets a prospect prove
that Nudge can learn their business and handle a customer conversation. The
locked previews and demo then sell the differentiated paid outcome:

- connecting the official business WhatsApp number;
- booking into the real calendar;
- following up with quiet leads and no-shows;
- sending payment links;
- connecting business systems; and
- concierge setup.

The initial ad page is for the approved high-ticket clinic beachhead: aesthetic
dermatology, cosmetic dental, hair transplant, and similar lead-gen clinics.
The implementation may reuse generic components, but the campaign copy must not
broaden the positioning back to generic blast-first small businesses.

## 3. Offer and copy contract

The primary promise is:

> Build your clinic's AI Front Desk in minutes. Test 15 customer replies free —
> no card and no WhatsApp connection required.

Supporting copy must make these points clear:

- The prospect tests with a simulated customer and mock inbox.
- The AI answers only from business facts the prospect supplied and approved.
- The allowance is 15 AI replies, not 15 contacts, campaigns, or real WhatsApp
  messages.
- The trial lasts at most seven days.
- No card is collected for the trial and there is no automatic charge.
- Connecting a real WhatsApp number is a paid/setup step reached through the
  demo or checkout.
- Trial data remains readable after expiry; AI generation pauses until purchase.

Do not describe the trial as a trial of Growth. It is a deliberately restricted
product preview with its own capabilities. Do not advertise a permanent free
tier.

## 4. End-to-end user journey

### 4.1 Ad landing page

Create `/free-trial` as a fast, focused public page separate from the cinematic
homepage. It uses the existing Nudge brand system but avoids the homepage's long
scroll, GSAP sequence, and autoplay video.

The page contains:

1. A compact navbar with logo, sign in, and the trial CTA.
2. The offer, no-card/no-connection reassurance, and a DOM-based WhatsApp
   conversation preview.
3. Three steps: teach it, test it, then book the setup demo.
4. A concise "what the trial includes" / "what unlocks after the demo" split.
5. The signup form.
6. Preview cards for real WhatsApp, bookings, follow-ups, payments, integrations,
   and voice.
7. A short privacy/compliance note and FAQ.

The signup form requires:

- owner name;
- business name;
- WhatsApp/mobile number with country code;
- email;
- password; and
- explicit consent for Nudge to contact the prospect about this trial and demo.

Consent to receive trial/demo contact is not consent for arbitrary marketing and
must not be copied into a customer `Contact` or treated as campaign opt-in.
Website, Google listing, and file details remain optional after authentication so
the ad conversion form stays short.

### 4.2 Account creation

The global `SIGNUP_OPEN` switch remains closed. A valid, unclaimed trial token is
an additional explicit path to workspace creation; it does not make general
self-serve signup available.

The public form first validates, normalizes, rate-limits, and stores a pending
trial. It returns a short-lived random claim token. The browser then asks Supabase
Auth to create the user, passing only the opaque trial id and claim token in auth
metadata. Nudge never receives or stores the password.

After email confirmation, the first authenticated request:

1. hashes and verifies the claim token;
2. verifies that the normalized auth email matches the pending trial;
3. rejects expired, claimed, or mismatched tokens;
4. creates the `Org` and OWNER `Membership` in simulation mode;
5. links the trial to the org and consumes the token idempotently; and
6. redirects into the short trial setup.

Invitation-based owner/team signup and founder-created workspaces keep their
existing behavior.

### 4.3 Short setup

The trial setup asks only for identity/country information that was not already
captured, then offers one primary knowledge source:

- paste a website URL or find a Google Business Profile;
- upload one supported PDF/image menu, brochure, or price list; or
- answer a five-question guided interview.

The five questions cover business summary, services/prices, hours, location,
and the most common customer question. Imported facts remain drafts and must be
approved before the agent can use them. The prospect can edit facts manually.

The initial trial permits one successful import source. A failed or empty import
does not consume that choice and must immediately offer the other methods. This
bound controls acquisition cost without trapping the user.

### 4.4 First dashboard visit

After setup, the prospect lands on Home and the interactive dashboard tour starts
automatically. A persistent trial bar shows:

- replies remaining, expressed as "15 test replies left" rather than a vague
  credit balance;
- whole days remaining;
- a primary "Book free demo" action; and
- a way to restart the tour.

After the first successful AI reply, show a small non-blocking demo prompt. Do
not interrupt the conversation with a full-screen conversion wall.

### 4.5 Trial end and conversion

When time or reply allowance runs out:

- new AI replies are disabled immediately on the server;
- knowledge and conversation history remain readable;
- no uploaded knowledge or inbox history is deleted;
- the primary action is "Book your free setup demo";
- "Choose a plan now" remains available as the secondary action; and
- successful payment activates the existing workspace rather than provisioning
  a replacement.

Growth and Pro should be guided toward the demo because setup is part of the
outcome. Checkout is not technically blocked for an already-convinced buyer.

## 5. Trial product surface

An unconverted acquisition trial gets a simplified application shell with four
active destinations:

| Destination | Purpose |
|---|---|
| Home | Progress, next task, trial status, and conversion CTA |
| Train AI | Add/review business knowledge |
| Test Inbox | Send simulated customer messages and view replies |
| Explore | Preview locked paid capabilities |

The account menu continues to expose account basics, help, sign out, and the
appropriate privacy/data controls. It must not become a back door to paid
settings.

The following appear as locked previews rather than normal active navigation:

- Connect WhatsApp (first and most prominent)
- Calendar booking
- Automated follow-ups and no-show recovery
- Payment links
- Campaigns/templates
- Contacts/team workspace
- CRM/API integrations
- Analytics
- Voice

Every locked card opens the same small conversion panel:

1. **Book your free setup demo** — primary.
2. **View paid plans** — secondary.

Unsupported trial routes redirect to the corresponding Explore preview. Their
server actions also reject the operation. Hiding a navigation item is never the
entitlement boundary.

## 6. Guided dashboard tutorial

Use a route-aware coach-mark system layered on top of the real dashboard. Do not
build a video tour or a separate fake dashboard.

The initial sequence is:

1. Explain the status bar, reply allowance, and setup checklist.
2. Highlight Train AI and the knowledge source/review area.
3. Explain that only approved facts reach customers.
4. Open Test Inbox and highlight where to type as a customer.
5. After a reply, point to "Open in shared inbox" and show the real thread.
6. Open Explore and explain what the demo/paid plans unlock.

Implementation rules:

- Interactive targets use stable `data-tour` identifiers, never brittle CSS
  selectors or visible text.
- Tour steps explicitly own their route. Advancing may navigate to that route
  before placing the coach mark.
- Missing targets fall back to a centered explanatory panel instead of crashing
  or leaving an invisible overlay.
- Users can go back, skip, dismiss, resume, and restart.
- Progress is stored server-side and resumes across devices.
- Desktop uses anchored coach marks. Mobile uses an accessible bottom sheet.
- The guide respects reduced-motion preferences, keyboard navigation, focus
  management, and Escape.
- A persistent task checklist remains after the automatic tour so the user can
  continue without replaying it.

The checklist is derived from real workspace state, not manually checked boxes:

- business profile saved;
- at least one active knowledge fact;
- imported facts reviewed;
- first test reply received;
- resulting inbox conversation opened;
- paid features explored; and
- demo clicked/booked.

## 7. Test Inbox experience

The existing simulation path remains the source of truth. Trial messages go
through the same scoped agent and persistence path as simulated inbound messages
today; no alternate prompt or fake answer engine is introduced.

For the trial UI, keep the simulated customer conversation on one page rather
than redirecting after every message. The page shows:

- a phone-style customer/AI conversation;
- a single customer-message composer;
- suggested clinic questions;
- replies remaining;
- a clear test-mode label; and
- "Open in shared inbox" after the first exchange.

The mock customer number is supplied by Nudge and does not imply that the
prospect's submitted mobile is a customer, a WhatsApp sender, or marketing
opt-in.

## 8. Data model

Add an `AcquisitionTrial` platform-level model. It begins before authentication
and becomes linked one-to-one with an org when claimed.

Required fields:

- `id`
- `orgId` (nullable, unique after claim)
- `ownerName`
- `businessName`
- `email` and normalized unique email
- normalized unique `phoneE164`
- `contactConsentAt`
- `claimTokenHash` and `claimExpiresAt`
- `claimedAt`, `startedAt`, and `expiresAt`
- `replyLimit` (15) and `repliesUsed`
- selected/successful knowledge source and timestamp
- tour step, completion, and dismissal timestamps
- first reply, exhausted, expired, demo-clicked, demo-booked, checkout-clicked,
  and converted timestamps where applicable
- landing path, safe referrer origin, UTM fields, GA client id, and source
- `createdAt` and `updatedAt`

The trial state is derived consistently:

- `pending`: no linked org;
- `active`: linked, not converted, before expiry, replies below the limit;
- `exhausted`: linked, not converted, reply limit reached;
- `expired`: linked, not converted, current time at/after expiry;
- `converted`: a paid subscription/checkout succeeded.

Do not rely only on a mutable status string when the authoritative timestamps,
counter, and subscription state can derive the answer.

Add an append-only `AcquisitionTrialEvent` with trial id, optional org id, event
name, small non-PII properties JSON, and timestamp. This is the internal funnel
source of truth. Direct contact data stays on `AcquisitionTrial`, not inside
event properties.

`DemoBooking` may link to an acquisition trial when the signed Cal webhook can
correlate it safely. Payment webhooks set conversion data idempotently after the
existing payment-integrity checks succeed.

Both new tables are platform-level, server-only data. Enable RLS with no browser
policies, matching existing `AccessRequest`/`DemoBooking` treatment.

## 9. Domain boundary and capability enforcement

Create `src/modules/trial/` for:

- form parsing and normalization;
- pending-trial creation and claim verification;
- trial state derivation;
- reply reservation/refund;
- capability and route gates;
- bounded knowledge-source rules;
- tour state transitions;
- funnel event recording; and
- founder/admin trial queries.

The trial uses the existing modules for knowledge, agent replies, inbox,
simulation, billing, Cal.com, and checkout. Routes stay thin.

An unconverted acquisition trial resolves to a restricted effective capability
set regardless of the stored legacy plan id:

- no connected WhatsApp numbers;
- no campaign messages;
- no automations;
- one owner seat;
- no calendar/payment/follow-up actions;
- no API, webhooks, CRM, widget, lead scoring, custom actions, BYOK, or voice;
- AI knowledge and simulated replies allowed only through the acquisition-trial
  paths.

All shared mutation boundaries consult the effective capability set. Successful
payment stops applying the acquisition restrictions and exposes the purchased
plan without copying workspace data.

## 10. Reply allowance

The limit is server-enforced and concurrency-safe.

Before a simulated trial turn calls the agent:

1. Load the trial by org.
2. Reject if converted logic no longer applies, time expired, or the limit was
   reached.
3. Atomically increment only where `repliesUsed < replyLimit` and
   `expiresAt > now`.
4. Run the existing simulated inbound/agent path.
5. Keep the increment only if the user receives an outbound reply.
6. Atomically refund it on a thrown generation failure or a path that generated
   no AI reply (for example STOP or disabled agent).

The UI counter is advisory; the server result is authoritative. A simultaneous
request at reply 14 can produce at most one reply 15. Time is checked in the
action as well as by cron, so a delayed expiry job never creates a grace window.

## 11. Cost and abuse controls

- One acquisition trial per normalized email and mobile number.
- Existing public-form rate limiting extended to trial creation.
- Hidden honeypot field and fixed request-size limits.
- Short-lived, high-entropy, single-use claim token stored only as a hash.
- Website import keeps the public-HTTPS/SSRF guard and uses a smaller trial crawl
  budget than paid workspaces.
- One successful initial source: bounded website/GBP import, one file up to the
  existing 5 MB limit, or five questionnaire answers.
- Imported facts are capped and stored as drafts.
- Only allowed MIME types reach file ingestion.
- The 15-reply gate does not depend on client state or on the advertised AI
  credit system.
- Trial orgs remain simulated even when the deployment itself is live.
- Founder overrides must not silently let an acquisition trial send to real
  customers.

No CAPTCHA dependency is required for the first version. Add one only if the
event/admin data shows that the rate limit and honeypot are insufficient.

## 12. Funnel measurement and founder operations

Record these internal events and matching browser data-layer events where a
browser action exists:

- `trial_landing_viewed`
- `trial_signup_started`
- `trial_signup_completed`
- `trial_workspace_activated`
- `trial_knowledge_source_added`
- `trial_facts_approved`
- `trial_first_reply`
- `trial_five_replies_used`
- `trial_exhausted`
- `trial_expired`
- `trial_demo_clicked`
- `trial_demo_booked`
- `trial_checkout_opened`
- `trial_converted`

Capture first-touch attribution once and carry it through the trial, signed Cal
webhook, and verified payment webhook. Do not put names, email addresses, phone
numbers, patient data, message bodies, or uploaded knowledge into GA/Meta event
payloads.

Extend the founder admin leads area with acquisition trials. It should show:

- owner/business and safe contact details;
- source and campaign;
- pending/active/exhausted/expired/converted state;
- replies used out of 15;
- knowledge source added or not;
- first-reply status;
- demo clicked/booked; and
- paid conversion.

Aggregate counts should make the funnel drop-offs visible without exporting raw
customer conversation data.

## 13. Error handling

| Failure | User-facing behavior | State behavior |
|---|---|---|
| Duplicate email/mobile | Offer sign in/resume; do not create another trial | Preserve the original trial |
| Stale/mismatched claim | Explain that the link cannot activate a trial and offer sign in/support | Create no org |
| Website unreadable/empty | Offer Google listing, file, or interview | Do not consume source choice |
| File invalid/too large | Name supported formats and 5 MB cap | Store nothing |
| Extraction returns no facts | Offer another source | Do not consume source choice |
| AI provider fails | Keep the customer's test message visible and allow retry | Refund reserved reply |
| Missing tour target | Show a centered fallback step | Preserve progress |
| Trial expires mid-session | Replace composer with conversion state on next server response | Preserve all data |
| Payment gateway unavailable | Keep demo booking primary and explain checkout is unavailable | Do not alter trial/plan |
| Payment succeeds twice/webhook repeats | Treat redelivery as a no-op | Convert once |

## 14. Accessibility and responsive behavior

- All trial forms have explicit labels, inline errors, and a validation summary.
- The landing page and tester work without animation.
- Coach marks use dialog semantics and managed focus.
- The highlighted control remains operable by keyboard.
- The mobile tour uses a bottom sheet that never covers the active input.
- Reply/time status is text, not color alone.
- Locked cards explain what unlocks and are reachable by keyboard.
- Reduced motion removes animated scrolling/transitions without removing content.

## 15. Verification

Automated coverage must include:

- public form validation, phone normalization, deduplication, rate limiting, and
  honeypot behavior;
- claim-token hashing, expiry, mismatch, single use, and idempotent concurrent
  claim;
- closed signup still refusing an authenticated stranger without an invite or
  valid trial claim;
- org membership and tenant isolation;
- active/exhausted/expired/converted state derivation;
- reply 15 succeeds and reply 16 fails;
- two concurrent reply-15 requests produce at most one reply;
- failed/no-reply paths refund the reservation without going negative;
- time expiry enforced without waiting for cron;
- all paid mutation boundaries reject acquisition trials;
- successful checkout preserves the same org, knowledge, and conversations;
- trial orgs remain simulated;
- knowledge imports stay draft until approval;
- trial crawl/file/questionnaire budgets;
- route-aware tour transitions, persistence, skip/restart, missing-target
  fallback, and mobile presentation contract;
- GTM events contain no direct contact or conversation data;
- Cal and payment correlation remains signature/payment verified and idempotent;
- `/free-trial` metadata, public routing, keyboard landmarks, and reduced-motion
  fallback; and
- existing consent, 24-hour-window, model guard, tenant isolation, and simulation
  invariant suites remain green.

Before completion, run targeted trial tests, the complete test suite, lint, and
the production build. Manually exercise desktop and mobile paths from ad landing
through signup, knowledge source, first reply, shared inbox, locked preview,
demo click, exhaustion, and paid conversion.

## 16. Explicitly out of scope

- A permanent free plan or recurring monthly free allowance.
- Connecting a real WhatsApp number during the acquisition trial.
- Sending a real campaign, follow-up, payment link, booking, or voice call.
- Phone OTP verification in the first version.
- Cold-list uploads or any relaxation of consent rules.
- A second/fake trial dashboard or a separate trial answer engine.
- A broad redesign of paid-product navigation.
- New pricing or changes to the Entry/Starter/Growth/Pro entitlements.
- Mandatory demo booking before checkout.
- Automated WhatsApp nurturing of trial leads beyond the explicit consent and
  approved-template requirements.

## 17. Success criteria

The feature is successful when a qualified clinic prospect can come from a Meta
ad, create a no-card trial, teach Nudge enough facts to get a grounded answer,
send a simulated customer message, see the reply in the shared inbox, understand
which business actions are paid, and book a setup demo without founder help.

Operationally, the founder must be able to see where each trial sits in that
funnel and attribute demo bookings and verified purchases back to the source
campaign. Technically, no trial can exceed 15 AI replies, access a paid mutation,
send a real customer message, cross tenant boundaries, or bypass the protected
Nudge invariants.
