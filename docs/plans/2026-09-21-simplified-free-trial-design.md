# Simplified Free Trial Design

**Date:** 2026-09-21  
**Status:** Approved  
**Supersedes:** The shared-trial positioning, visual direction, navigation,
guidance, and training allowances in
`docs/plans/2026-09-20-free-trial-funnel-design.md`

## Objective

Make the acquisition trial feel clear, calm, and credible rather than like a
feature-heavy AI product demo. The landing page should convert paid ad traffic
into a safe trial. The trial should let a business teach Nudge from several useful
sources, test grounded replies, and understand the next paid step without a
dashboard full of analytics or locked-feature widgets.

The paid product remains the full AI Front Desk. This change only simplifies
the acquisition-trial experience.

## Approved experience

The public page uses a restrained, editorial split layout. The authenticated
trial has exactly two primary pages:

1. **Inbox** — the private test conversation and the default trial page.
2. **Train AI** — source collection, draft review, and fact management in one
   continuous workspace.

There is no trial Home dashboard or Explore page in the navigation.

## Landing page

### Visual direction

- White canvas, dark ink type, and Nudge green as the single accent.
- Existing Geist typography and Nudge wordmark.
- A small page-specific header with the wordmark and a Sign in link.
- One desktop split: message on the left, signup form on the right, divided by
  whitespace or a fine rule rather than a floating card.
- One column on mobile, with the offer immediately followed by the form.
- No pills, sparkle/AI symbols, chat mockups, fake dashboards, gradients,
  decorative icons, hard shadows, floating cards, or animated marketing chrome.

### Content hierarchy

1. Direct outcome headline: the front desk answers before a lead goes cold.
2. Short explanation: teach Nudge with real business information, test 15 private
   replies, and then connect the full front desk through a paid setup.
3. Plain offer line: 7 days, 15 replies, no card, no live WhatsApp connection.
4. Existing secure signup fields and consent, with a plain primary button.
5. Three text-only steps: Train, Test, Go live.
6. A short explanation of the full outcome: answers, books, follows up, and is
   configured with the business.
7. Only the FAQ items that remove trial or purchase uncertainty.
8. Minimal legal footer.

The form's attribution, validation, duplicate recovery, Supabase handoff,
confirmation, and consent behavior do not change.

## Trial shell and navigation

Trial navigation contains only Inbox and Train AI. The paid workspace retains
its existing navigation and analytics.

- `/dashboard` becomes the canonical trial Inbox surface.
- `/inbox/try` remains a compatible alias or redirects to `/dashboard`.
- `/agent` is Train AI.
- `/trial/setup` redirects into Train AI rather than hosting a separate wizard.
- `/explore` redirects to the Inbox. It is removed from navigation, commands,
  checklists, and guided-tour steps.
- Attempts to visit paid-only trial routes return to Inbox with a restrained
  upgrade notice instead of routing through Explore.
- Trial command search is hidden because two destinations do not need it.
- The reply/time allowance remains visible as one compact status line.

The current Explore failure is caused by the server route calling non-component
exports from a `"use client"` module. Removing Explore from the active flow and
redirecting the route eliminates that user-facing failure.

## Inbox

The existing private, persisted test conversation becomes the page body rather
than a destination behind a Home checklist.

- Show the conversation and composer first.
- Keep the 15-reply and seven-day enforcement unchanged.
- If the business has no approved facts, show a short empty state linking to
  Train AI; never fabricate a grounded reply.
- Keep one quiet conversion line below or beside the conversation:
  **Connect your real WhatsApp — Book a demo · View plans.**
- Do not show analytics cards, progress percentages, locked preview cards, or a
  trial checklist.

### Guidance

First-time guidance is optional and non-blocking. It covers only:

1. Add business information in Train AI.
2. Ask a customer question in Inbox.
3. Review the grounded answer and remaining allowance.

It can be opened, closed, and reopened. It must not obscure the composer, trap
focus, or force completion.

## Train AI

Train AI is one continuous page, not a source-selection wizard.

### Source area

Use simple stacked controls rather than source cards:

- **Website:** one successful website or Google Business Profile import.
- **Documents:** up to three successful text-PDF imports, four megabytes each.
- **Manual information:** users may type, edit, and archive facts without an
  AI import charge.

Visible text counters communicate the boundary:

- Website: 0/1 or 1/1
- Documents: 0/3 through 3/3
- Facts: current/50

An import stays on the same page. It adds draft facts below the source controls
and never advances the user to another route or permanently hides the other
sources.

### Fact review

- Draft and approved facts appear on the same page.
- Draft facts can be approved or discarded individually or in bulk.
- Approved facts can be added, edited, or archived.
- Draft plus active facts are capped at 50 for acquisition trials. The server,
  not only the interface, enforces the cap.
- Once at least one fact is approved, a clear **Test in Inbox** action is
  available. The user may continue adding sources afterward.

### Import accounting

Preserve the existing first-source fields for attribution and backward
compatibility. Add small, atomic acquisition-trial counters for web and file
imports. Reserve a slot before ingestion and release it after an error or an
import that produces no drafts, matching the current concurrency-safe pattern.

Existing trials keep their learned facts. A successful legacy source counts
toward the appropriate new allowance.

## Safety and invariants

- The feature remains tenant-scoped and role-checked on the server.
- Trial facts ground only the current business's replies.
- Reply allowance and expiry are still enforced server-side.
- The trial never connects or sends through a real WhatsApp number.
- The full paid product continues to use the official Meta Cloud API and all
  consent and 24-hour-window safeguards.
- Website and file ingestion stay tightly bounded to control model spend.
- The complete path must work with `SEND_MODE=simulation` and no external keys.
  PDF ingestion therefore needs a deterministic keyless path. The acquisition
  trial does not advertise image ingestion; paid keyed image ingestion remains
  unchanged.

## Error handling

- Import failures remain inline beside the relevant source.
- A failed or empty import does not consume an allowance slot.
- Concurrent requests cannot exceed the source limits.
- Reaching a source or fact limit disables only that action and explains the
  boundary; existing facts and Inbox testing remain usable.
- Old bookmarked routes redirect safely instead of rendering a generic error.

## Conversion path

The experience supports one clear sequence:

1. Start the free trial and create a workspace.
2. Add real business knowledge and test private replies.
3. Book a free demo to connect WhatsApp and explore the full setup.
4. Choose a paid tier.

The trial does not position Nudge as merely an AI reply tool. Plain copy must
state that paid Nudge also books into real systems, follows up opted-in leads,
collects payments, and is configured with the business.

## Verification

Add or update focused tests for:

- semantic landing hierarchy and the absence of removed decorative widgets;
- preserved signup and attribution behavior;
- exactly two trial navigation destinations on desktop and mobile;
- trial `/dashboard` showing Inbox, with old trial routes redirecting safely;
- atomic one-web/three-file allowance reservation and refund;
- the 50-fact cap across draft and active facts, including manual additions;
- repeated website-plus-document imports on one Train AI page;
- setup completion leading to Inbox without blocking later imports;
- zero-key simulation behavior for supported uploads;
- optional guidance opening, closing, and reopening without blocking work; and
- a production build plus authenticated trial smoke check.
