# AI follow-ups — design (2026-09-19)

Status: approved by founder 2026-09-19 (all four sections). Supersedes the
builder-first Follow-ups page shipped 2026-09-17/18.

## Why

The Follow-ups page exposed engine primitives — pick a trigger, add a wait,
pick a template you first wrote and got approved on another screen — instead of
the owner's intent. Founder verdict after testing: "too manual, too difficult to
understand and implement." The product promise is a done-for-you AI employee
that *chases every lead that goes quiet*; the page should read like that.

Two defects found while investigating, both fixed by this design:

1. **The engine never cancels a follow-up when the customer replies.** A
   `WAITING` run resumes purely on time (`engine.ts` `resumeWaitingRuns`), so the
   pack's quiet-lead nudge sends "still thinking it over?" on day three even if
   the lead replied on day two and booked. For a "chases leads that go quiet"
   product this is the one thing that must be right.
2. **"Went quiet" cannot be expressed.** The trigger vocabulary is
   `message_received | keyword | contact_created | tag_added | campaign_reply |
   booking_created`; the pack fakes quietness with "campaign reply → wait 3
   days". There is no trigger for "showed interest, then silence."

Known constraint, not solved here: the cron runs nightly at 03:00
(`vercel.json`), so every wait and reminder fires at the next nightly run. The
UI is honest about it (delays in days, a "goes out during the nightly run"
note) until the schedule returns to every-5-minutes on Vercel Pro.

## Decisions (founder, 2026-09-19)

| Question | Decision |
| --- | --- |
| First open | AI drafts a tailored starter set (4–6) from `AgentProfile` + knowledge; a text bar adds custom ones |
| Trust | Every AI draft lands **off**; a human switches it on |
| Stop rule | **Any customer reply cancels** the pending chase; booking and payment also cancel (per spec); opt-out always cancels |
| Who | Client self-serve on `/automations` **and** founder from the admin org page, same module functions |
| Architecture | **Compile onto the existing automation engine** and add what it lacks — not a second engine, not a bar that pre-fills the builder |

## 1. The follow-up as data

A follow-up is one plain object the AI writes and the owner reads:

```
FollowUpSpec
  name
  situation   — one of:
     went_quiet     { afterDays, stage? }   showed interest, no reply for N days
     booked         { }                      a booking was created
     campaign_reply { }                      replied to a campaign
     keyword        { keywords[] }           sent a keyword
     new_lead       { }                      first ever message
  messages    — 1..3 of { afterDays, category, header, body, footer, buttons? }
  stopOn      — subset of reply | booking | payment   (default: all three)
```

A pure, unit-tested **compiler** (`modules/followup/compile.ts`) turns a spec into
what the engine already runs:

- one `Automation` — `trigger` from the situation, `wait` / `send_template`
  steps from the messages;
- library `Template` rows named `fu_<slug>_<n>` (`campaignId: null`), built with
  `buildTemplatePayload`, submitted to Meta live and auto-approved in
  simulation — the exact path `installRevenueRecoveryPack` uses today.

Rules the compiler enforces structurally:

- Only `wait` and `send_template` steps, never `send_message` → the 24-hour
  window invariant (#6) holds without review.
- Each gap between messages ≤ 14 days, chunked into ≤ 7-day waits (the engine's
  `MAX_WAIT_MINUTES` clamp). Longer gaps (annual recall) are out of scope; they
  belong beside the booking reminders as time-absolute ticks.
- MARKETING messages get the opt-out footer via `repairOptOutFooter`; a body
  carries `{{1}}` exactly once (the pack tests already assert this shape).

Storage: `Automation.spec Json?` (the spec, for rendering the card and
recompiling on edit) and `Automation.source String @default("builder")`
(`ai` | `pack` | `builder`). Editing a spec recompiles the steps and upserts the
templates by name; changed copy goes back to `PENDING` and is resubmitted, the
existing template-editor rule. A builder edit drops the spec and sets source to
`builder`; the card then shows a generic summary.

The pack's quiet-lead nudge is re-expressed through the same compiler
(`went_quiet { afterDays: 3 }` → nudge 1, then nudge 2 three days later,
`stopOn` all). `installRevenueRecoveryPack` writes it with source `pack`,
idempotent by name as before. Pack, AI and hand-built follow-ups become one
kind of object. Template names are keyed on the automation id, and an edit
re-uses the templates the automation already sends, so renames never orphan
approved templates; the pack's nudge keeps its historical `lead_nudge_1/2`
names.

## 2. Engine fixes

**Cancel-on-reply.** `cancelWaitingRuns(orgId, contactId, signal)` in the
engine sets the contact's `WAITING` runs to a new `CANCELLED` status and appends a
log line naming the signal. Called from the four places the signal happens:

- inbound message — `modules/agent/inbound.ts`, **before**
  `runInboundAutomations`, so an inbound never cancels the run it just started;
- booking created — the `fireBookingCreated` site in `capture-booking`;
- payment paid — `modules/payments/index.ts`;
- opt-out — the consent path.

A reply cancels every chase — `went_quiet`, `campaign_reply`, `keyword`,
`new_lead` — whatever its `stopOn` says: the customer is talking to us. A reply
does **not** cancel a follow-up built on the `booked` situation unless its
`stopOn` names `reply` (founder decision 2026-09-20: a customer saying "thanks,
see you then" after booking was cancelling the reminder and the post-visit
review ask). A booked spec that arrives without `stopOn` therefore defaults to
`["booking", "payment"]`, not all three. Booking and payment cancel runs whose
`spec.stopOn` includes them; automations without a spec take the default (cancel
on all). Opt-out always cancels. The pack and every builder-made automation get
the fix for free.

**`conversation_quiet` trigger.** Added to `AUTOMATION_TRIGGERS`; config
`{ hours, stage? }`. Evaluated on the cron tick by `fireQuietConversations(now)`
in `modules/automation/triggers.ts`: for each enabled automation with this
trigger, select org conversations where `lastInboundAt` is older than `hours`
and not null (they messaged, so they showed interest), status `open` or
`pending`, contact not opted out, lead stage matches if set, and **no
`AutomationRun` exists for this automation + contact** — one chase per person
per follow-up, ever, the same structural cap the pack encodes. Batched at 200,
like the reminder tick. Starts runs through the existing `runAutomation`.

## 3. AI drafting

`modules/followup/draft.ts` — one prompt, two entry points:

- `draftFollowUp({ orgId, request })` — the bar;
- `draftStarterSet({ orgId })` — first open, 4–6 specs for the vertical.

Both call `generate()` from `lib/model-router` (`RUNTIME_MODEL`; BYOK resolved by
the router; attribution purpose `followup_draft`, so credits are debited like
campaign copy). The system prompt carries: the situation vocabulary and when to
use each; the template rules (`{{1}}` once near the start, ≤ 600 chars, STOP
footer on MARKETING, UTILITY only for booking-transactional messages, no
pressure or claims); and the business — `AgentProfile` name, vertical,
`businessInfo`, tone, do-nots, plus the top knowledge facts — so drafts are
grounded in this business only (invariant #7). Output: JSON → zod
`followUpSpecSchema` → one repair retry, the guardrail pattern of
`modules/campaign/generate.ts`.

**Keyless simulation path.** `draftOffline(request)` deterministically maps
phrasings ("quiet", "booked", "no-show", "review", "new lead", "keyword X") to
canned specs using the pack's copy; the starter set in test mode *is* the pack.
Records synthetic usage like `distillAnswer`. Invariant #4 holds with zero keys.

Failure is never load-bearing: a drafting error is a friendly message; nothing
is saved until a spec validates; the automation row is written first (off and
step-less, so the engine ignores it), then its templates go to Meta, then its
steps — a Meta failure leaves an off, empty automation rather than orphaned
templates; every draft lands with `enabled: false`.

## 4. The page and the admin

`/automations` (nav label "Follow-ups") becomes **one list of follow-up cards**;
the two-section split is removed. Each card:

- a plain-English situation line — "When someone asks and goes quiet for 2 days";
- the message(s), with "then N days later" between them;
- a status chip — Off · Waiting for Meta · On;
- a switch; inline Edit (message text, days); "Open in builder" for the
  advanced view; delete.

The appointment reminder, no-show and review follow-ups keep their hour fields
in the same card style (they are tick-driven, not spec-driven; no builder link).
The "Ready-made follow-ups" toggle card is replaced by **"Write my starter
set"**, which shows the credit cost before the click. The bar sits on top with
three example chips per vertical; submit → drafting → preview card → Create.
ADMIN + AI Front Desk plan gate, as today.

The founder admin org page (`/admin/orgs/[id]/agent`) gets an identical card —
same module functions, org id from the route, founder allowlist — so concierge
onboarding uses exactly the path the client sees later.

While the cron is nightly the page says "Follow-ups go out during the nightly
run"; that line comes out when the schedule is every-5-minutes.

## Schema

- `Automation.spec Json?`
- `Automation.source String @default("builder")`
- `AutomationRunStatus` + `CANCELLED`

One `npm run db:push` + `npm run db:rls` (founder step).

## Tests

- Spec schema + compiler: trigger mapping, wait chunking at 7 days, 14-day cap,
  no `send_message` ever, footer repair, `{{1}}` exactly once.
- Offline drafter: phrase → spec mapping; starter set = pack in test mode.
- Quiet-selection predicate (pure): age, status, opt-out, stage, one-run cap.
- Cancel-on-reply (engine, mocked Prisma): inbound cancels before the new run
  starts; `stopOn` honoured; opt-out always cancels.
- Pack compiles through the compiler and installs idempotently.
- Page source guards: the bar, the single list, the admin card.
- The seven invariant tests are untouched.

## Out of scope

Gaps over 14 days (annual recall), multi-language templates, A/B copy,
per-contact overrides, re-chasing the same person after a cooling-off period,
syncing builder edits back into a spec, and changing the cron cadence.
