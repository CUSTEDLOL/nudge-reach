# Free Trial Conversion and Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the trial funnel by correlating demo bookings, preserving the same workspace through paid checkout, recording privacy-safe milestones and expiry, and giving founders one operational view of trial leads and funnel health.

**Architecture:** `src/modules/trial/events.ts` is the one server-side milestone recorder. It conditionally stamps milestone columns and appends an event only on the first transition. Signed Cal and payment webhooks remain the sources of truth for bookings and purchases; trial correlation enriches those verified paths without replacing them. Founder reporting projects acquisition trials into the existing leads desk.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Postgres, Cal.com signed webhooks, Razorpay/Stripe signed payment paths, Vitest

**Spec:** `docs/plans/2026-09-20-free-trial-funnel-design.md`

## Global Constraints

- Complete the foundation and guided-experience plans first.
- Demo booking is the primary conversion action; paid checkout remains available and must upgrade the existing trial org rather than creating another workspace.
- Browser analytics and server events must never include passwords, claim tokens, message bodies, imported facts, file contents, or arbitrary form text.
- Cal correlation requires both the bounded trial id from metadata and the normalized attendee email matching the trial email; do not link on an untrusted id alone.
- `convertedAt` is written only after a verified paid activation path sets the org subscription active.
- Webhook redelivery, duplicate clicks, overlapping cron ticks, and client-confirm/webhook races must be idempotent.
- Expiry makes the workspace read-only for new AI replies but does not delete history or trial data.
- Founder sales status (`new`, `contacted`, and so on) remains separate from product lifecycle (`pending`, `active`, `exhausted`, `expired`, `converted`).
- Do not add speculative email sequences, lead scoring, data deletion schedules, or ad-platform server APIs in this phase.
- Do not edit or stage unrelated worktree changes.

## Review Focus

- Signed Cal input with a mismatched attendee email must not attach to a trial; Task 2 pins the dual match.
- A valid Razorpay client confirmation and its webhook redelivery must create one conversion milestone and keep the same org id; Task 3 pins this race.
- Expiry and exhaustion events must be first-transition-only under concurrent workers; Tasks 1 and 4 use conditional updates.
- Trial leads must remain founder-only and cannot become browser-readable platform data; Task 5 uses existing founder auth and RLS posture.
- Every funnel number must be derivable from durable server milestones, not only `dataLayer`; Tasks 1 and 5 cover this.

---

### Task 1: Idempotent server-side milestones

**Files:**
- Create: `src/modules/trial/events.ts`
- Modify: `src/modules/trial/signup.ts`
- Modify: `src/modules/trial/claim.ts`
- Modify: `src/modules/trial/knowledge.ts`
- Modify: `src/modules/trial/replies.ts`
- Modify: `src/app/(app)/trial/setup/actions.ts`
- Create: `tests/trial-events.test.ts`
- Modify: `tests/trial-signup.test.ts`
- Modify: `tests/trial-claim.test.ts`
- Modify: `tests/trial-knowledge.test.ts`
- Modify: `tests/trial-replies.test.ts`

**Interfaces:**
- Produces: `recordTrialMilestone(input)` for org-bound transitions and `trialEventData(name, trialId, orgId?, props?)` for nested/transactional creates.
- Consumes: milestone columns on `AcquisitionTrial` and `AcquisitionTrialEvent`.

- [ ] **Step 1: Write failing idempotency and privacy tests**

Pin the supported names and their columns:

```ts
expect(TRIAL_MILESTONES).toEqual({
  setup_completed: "setupCompletedAt",
  knowledge_ready: "knowledgeSourceUsedAt",
  first_reply: "firstReplyAt",
  allowance_exhausted: "exhaustedAt",
  trial_expired: "expiredAt",
  demo_clicked: "demoClickedAt",
  demo_booked: "demoBookedAt",
  checkout_clicked: "checkoutClickedAt",
  converted: "convertedAt",
});
```

The schema from Plan 1 must gain `setupCompletedAt DateTime?`. Mock a first conditional update returning `{ count: 1 }` and assert one event is created. Mock `{ count: 0 }` and assert no event. Assert the props sanitizer accepts only booleans, finite numbers, and bounded allowlisted strings, and rejects keys named `email`, `phone`, `password`, `token`, `message`, `fact`, or `content`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-events.test.ts tests/trial-signup.test.ts tests/trial-claim.test.ts tests/trial-knowledge.test.ts tests/trial-replies.test.ts`

Expected: FAIL because the milestone recorder and setup column do not exist.

- [ ] **Step 3: Add the setup milestone and recorder**

Add `setupCompletedAt DateTime?` to `AcquisitionTrial`. Implement each milestone in a transaction:

```ts
export const TRIAL_MILESTONES = {
  setup_completed: "setupCompletedAt",
  knowledge_ready: "knowledgeSourceUsedAt",
  first_reply: "firstReplyAt",
  allowance_exhausted: "exhaustedAt",
  trial_expired: "expiredAt",
  demo_clicked: "demoClickedAt",
  demo_booked: "demoBookedAt",
  checkout_clicked: "checkoutClickedAt",
  converted: "convertedAt",
} as const;

type MilestoneName = keyof typeof TRIAL_MILESTONES;
type MilestonePatch = {
  where: Prisma.AcquisitionTrialWhereInput;
  data: Prisma.AcquisitionTrialUpdateManyMutationInput;
};
const MILESTONE_PATCH: Record<MilestoneName, (at: Date) => MilestonePatch> = {
  setup_completed: at => ({ where: { setupCompletedAt: null }, data: { setupCompletedAt: at } }),
  knowledge_ready: at => ({ where: { knowledgeSourceUsedAt: null }, data: { knowledgeSourceUsedAt: at } }),
  first_reply: at => ({ where: { firstReplyAt: null }, data: { firstReplyAt: at } }),
  allowance_exhausted: at => ({ where: { exhaustedAt: null }, data: { exhaustedAt: at } }),
  trial_expired: at => ({ where: { expiredAt: null }, data: { expiredAt: at } }),
  demo_clicked: at => ({ where: { demoClickedAt: null }, data: { demoClickedAt: at } }),
  demo_booked: at => ({ where: { demoBookedAt: null }, data: { demoBookedAt: at } }),
  checkout_clicked: at => ({ where: { checkoutClickedAt: null }, data: { checkoutClickedAt: at } }),
  converted: at => ({ where: { convertedAt: null }, data: { convertedAt: at } }),
};

export async function recordTrialMilestone(input: {
  orgId: string;
  name: MilestoneName;
  at?: Date;
  props?: TrialEventProps;
}) {
  const at = input.at ?? new Date();
  const patch = MILESTONE_PATCH[input.name](at);
  return prisma.$transaction(async tx => {
    const changed = await tx.acquisitionTrial.updateMany({
      where: { orgId: input.orgId, ...patch.where },
      data: patch.data,
    });
    if (changed.count !== 1) return false;
    const trial = await tx.acquisitionTrial.findUniqueOrThrow({
      where: { orgId: input.orgId },
      select: { id: true },
    });
    await tx.acquisitionTrialEvent.create({
      data: trialEventData(input.name, trial.id, input.orgId, input.props),
    });
    return true;
  });
}
```

`trialEventData` sanitizes an explicit property allowlist: `source`, `planId`,
`knowledgeSource`, `replyLimit`, `reason`, and `surface`.

- [ ] **Step 4: Record creation, claim, setup, knowledge, and reply milestones in their owning transactions**

- `createPendingTrial`: nested-create `trial_created` with attribution source only.
- `claimAcquisitionTrial`: create `trial_claimed` inside the successful claim transaction.
- `completeTrialSetupAction`: call `recordTrialMilestone({ name: "setup_completed" })` after `Org.onboardedAt` succeeds.
- Successful knowledge source: stamp `knowledgeSourceUsedAt` and create `knowledge_ready` in the same transaction rather than calling the generic recorder after the fact.
- First reply: record `first_reply` only after `handleInboundMessage` returned a reply.
- Reply 15: when the successful conditional increment reaches `replyLimit`, stamp `exhaustedAt` and append `allowance_exhausted` in the reservation transaction.

Keep `trial_created` and `trial_claimed` outside `TRIAL_MILESTONES` because they do not map to nullable milestone columns; their existing unique state transitions make them one-time.

- [ ] **Step 5: Run milestone and quota tests**

Run: `npx prisma format && npx prisma generate && npx vitest run tests/trial-events.test.ts tests/trial-signup.test.ts tests/trial-claim.test.ts tests/trial-knowledge.test.ts tests/trial-replies.test.ts tests/trial-setup.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit durable milestones**

```bash
git add prisma/schema.prisma src/modules/trial/events.ts src/modules/trial/signup.ts src/modules/trial/claim.ts src/modules/trial/knowledge.ts src/modules/trial/replies.ts src/app/'(app)'/trial/setup/actions.ts tests/trial-events.test.ts tests/trial-signup.test.ts tests/trial-claim.test.ts tests/trial-knowledge.test.ts tests/trial-replies.test.ts tests/trial-setup.test.ts
git commit -m "feat(trial): record durable funnel milestones"
```

### Task 2: Demo-click tracking and signed Cal booking correlation

**Files:**
- Modify: `src/components/marketing/book-demo.tsx`
- Modify: `src/modules/marketing/analytics.ts`
- Modify: `src/modules/marketing/cal-webhook.ts`
- Modify: `src/app/(app)/trial/actions.ts`
- Modify: `src/components/features/trial/upgrade-dialog.tsx`
- Modify: `src/components/features/trial/trial-home.tsx`
- Modify: `tests/marketing-analytics.test.ts`
- Modify: `tests/cal-webhook.test.ts`
- Modify: `tests/cal-webhook-route.test.ts`
- Modify: `tests/trial-tour-actions.test.ts`

**Interfaces:**
- Extends: `BookDemoButton` with optional bounded `trialId`; Cal metadata with `metadata[acquisitionTrialId]`.
- Produces: `markTrialDemoClickAction()`, parsed `acquisitionTrialId`, and correlated `DemoBooking.acquisitionTrialId`.

- [ ] **Step 1: Write failing Cal metadata and correlation tests**

```ts
expect(JSON.parse(buildCalTriggerConfig(true, context, "trial_123"))).toMatchObject({
  "metadata[acquisitionTrialId]": "trial_123",
});
```

Test `parseCalBooking` accepts only `/^[A-Za-z0-9_-]{1,128}$/` for the optional metadata id. For `ingestCalBooking`, assert:

- matching trial id + attendee email links the booking and records `demo_booked` once;
- matching id + different attendee email stores the booking without a trial link;
- matching email + missing id stores without a link;
- webhook redelivery does not duplicate the event;
- invalid signatures still do no database work.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/marketing-analytics.test.ts tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts`

Expected: FAIL because trial metadata is not parsed or correlated.

- [ ] **Step 3: Add bounded trial metadata to the existing Cal trigger**

Change `calMetadata` and `buildCalTriggerConfig` to accept an optional trial id. Add it only when it matches the opaque-id regex. `BookDemoButton` accepts `trialId?: string`, passes it to the config builder, and on click invokes `markTrialDemoClickAction()` when present before opening Cal. The server action ignores any client-supplied org and derives the current org through `requireOrgContext`, then records `demo_clicked`.

Keep the direct `https://cal.com/hqnudge/30min` fallback and existing aggregate `generate_lead` event intact. Also emit the privacy-safe `trial_demo_click` browser event.

- [ ] **Step 4: Correlate only verified bookings with a dual match**

Extend `ParsedCalBooking` with `acquisitionTrialId?: string`. Inside `ingestCalBooking`, use one transaction:

```ts
const trial = input.acquisitionTrialId && input.attendeeEmail
  ? await tx.acquisitionTrial.findFirst({
      where: {
        id: input.acquisitionTrialId,
        emailNormalized: input.attendeeEmail.trim().toLowerCase(),
      },
      select: { id: true, orgId: true, demoBookedAt: true },
    })
  : null;

const booking = await tx.demoBooking.upsert({
  where: { calUid: input.calUid },
  create: { ...mappedInput, acquisitionTrialId: trial?.id },
  update: {
    startTime: input.startTime,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    attendeePhoneE164: input.attendeePhoneE164,
    ...(trial ? { acquisitionTrialId: trial.id } : {}),
  },
});
```

If `trial.demoBookedAt` is null, conditionally stamp it and create one `demo_booked` event with no attendee fields. Never detach a previously verified correlation on redelivery with incomplete metadata.

- [ ] **Step 5: Pass trial id from every authenticated conversion surface**

Pass `workspace.id` to `BookDemoButton` in Trial Home, the exhausted/expired status strip, and every Explore upgrade dialog. Public marketing buttons continue without the id.

- [ ] **Step 6: Run Cal and trial conversion UI tests**

Run: `npx vitest run tests/marketing-analytics.test.ts tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts tests/trial-explore.test.ts tests/trial-shell.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit demo correlation**

```bash
git add src/components/marketing/book-demo.tsx src/modules/marketing/analytics.ts src/modules/marketing/cal-webhook.ts src/app/'(app)'/trial/actions.ts src/components/features/trial/upgrade-dialog.tsx src/components/features/trial/trial-home.tsx tests/marketing-analytics.test.ts tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts tests/trial-tour-actions.test.ts
git commit -m "feat(trial): correlate demo bookings"
```

### Task 3: Paid checkout conversion on the same workspace

**Files:**
- Create: `src/modules/trial/conversion.ts`
- Modify: `src/app/(app)/settings/billing/page.tsx`
- Modify: `src/app/(app)/settings/billing/actions.ts`
- Modify: `src/app/(app)/settings/billing/checkout-button.tsx`
- Modify: `src/app/api/webhooks/razorpay/route.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Create: `tests/trial-conversion.test.ts`
- Modify: `tests/billing-confirm.test.ts`
- Modify: `tests/global-markets.test.ts`
- Modify: `tests/credit-topup.test.ts`

**Interfaces:**
- Produces: `recordTrialCheckoutClick(orgId, planId)` and `markTrialConverted(orgId, planId, now?)`.
- Consumes: verified existing activation paths; never verifies a payment itself.

- [ ] **Step 1: Write failing same-org and redelivery tests**

Test:

```ts
expect(await markTrialConverted("org_1", "starter", now)).toBe(true);
expect(acquisitionTrialUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
  where: { orgId: "org_1", convertedAt: null },
  data: { convertedAt: now },
}));
expect(await markTrialConverted("org_1", "starter", now)).toBe(false);
```

In each activation-path test, assert the existing org id is updated, no `org.create` occurs, `subscriptionStatus` becomes active, `trialEndsAt` clears, and exactly one `converted` event is appended across client confirm plus webhook redelivery. Credit-pack purchases must not mark conversion.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-conversion.test.ts tests/billing-confirm.test.ts tests/global-markets.test.ts tests/credit-topup.test.ts`

Expected: FAIL because paid activation does not stamp acquisition conversion.

- [ ] **Step 3: Implement checkout and conversion transitions**

`recordTrialCheckoutClick` conditionally stamps `checkoutClickedAt` and appends one event with allowlisted `planId`. `markTrialConverted` first verifies the org currently has `subscriptionStatus: "active"` and `plan` equal to the passed non-free plan, then conditionally stamps `convertedAt` and creates one `converted` event in a transaction.

Do not let either helper change the org plan, payment state, credit grants, or trial expiry; those remain owned by billing.

- [ ] **Step 4: Wire only successful billing boundaries**

- `startCheckoutAction`: after validating a paid plan and successfully creating the Razorpay order or Stripe session, call `recordTrialCheckoutClick(ctx.org.id, plan.id)` before returning checkout data.
- `confirmCheckoutAction`: after the verified order updates the org and `ensureIncludedGrant` succeeds, call `markTrialConverted(ctx.org.id, plan.id)`.
- Razorpay `payment.captured`: after org activation and included grant, call `markTrialConverted(orgId, plan.id)`.
- Stripe `checkout.session.completed`: only inside the paid-plan, `payment_status === "paid"` branch and after included grant, call `markTrialConverted(orgId, plan.id)`.

Never call conversion helpers in cancellation, payment-link, or credit-pack branches.

- [ ] **Step 5: Emit client checkout intent without treating it as revenue**

The billing page passes `trialMode={true}` only when `getTrialWorkspace`
returns an unconverted acquisition trial. When `CheckoutButton` receives a
successful checkout payload/redirect for `kind === "plan"` and `trialMode` is
true, emit `trial_checkout_click` with the allowlisted plan id. Do not emit
`purchase` from the browser handler; verified server activation remains
authoritative.

- [ ] **Step 6: Run all billing-integrity tests**

Run: `npx vitest run tests/trial-conversion.test.ts tests/billing-confirm.test.ts tests/global-markets.test.ts tests/credit-topup.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit same-workspace paid conversion**

```bash
git add src/modules/trial/conversion.ts src/app/'(app)'/settings/billing/page.tsx src/app/'(app)'/settings/billing/actions.ts src/app/'(app)'/settings/billing/checkout-button.tsx src/app/api/webhooks/razorpay/route.ts src/app/api/webhooks/stripe/route.ts tests/trial-conversion.test.ts tests/billing-confirm.test.ts tests/global-markets.test.ts tests/credit-topup.test.ts
git commit -m "feat(trial): convert paid trial workspace in place"
```

### Task 4: Idempotent expiry lifecycle

**Files:**
- Create: `src/modules/trial/expiry.ts`
- Modify: `src/app/api/cron/process-queue/route.ts`
- Create: `tests/trial-expiry.test.ts`

**Interfaces:**
- Produces: `expireAcquisitionTrials(now?, limit?) -> Promise<number>`.
- Consumes: `AcquisitionTrial.expiresAt`, `expiredAt`, `convertedAt`, and append-only events.

- [ ] **Step 1: Write failing expiry tests**

Cover active-due, converted, already-expired, future, and a two-worker conditional-update race. Assert the due row keeps its org, contacts, conversations, messages, and knowledge untouched; only `expiredAt` and the event change.

```ts
expect(updateMany).toHaveBeenCalledWith({
  where: {
    id: "trial_1",
    expiredAt: null,
    convertedAt: null,
    expiresAt: { lte: now },
  },
  data: { expiredAt: now },
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-expiry.test.ts`

Expected: FAIL because only the legacy billing trial expiry runs.

- [ ] **Step 3: Implement bounded first-transition expiry**

Query at most 200 due ids ordered by `expiresAt`, then for each use a transaction with the conditional update above and append `trial_expired` only when `count === 1`. Return the number transitioned. Do not clear `AcquisitionTrial.expiresAt`; historical state remains auditable.

- [ ] **Step 4: Add expiry to the existing cron**

Immediately after the legacy `expireTrials()` call:

```ts
step = "expire-acquisition-trials";
const expiredAcquisitionTrials = await expireAcquisitionTrials();
```

Add `expiredAcquisitionTrials: boundedCount(expiredAcquisitionTrials)` to the heartbeat summary. Keep error detail to the stable step label.

- [ ] **Step 5: Run lifecycle and cron tests**

Run: `npx vitest run tests/trial-expiry.test.ts tests/trial-replies.test.ts tests/trial-state.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit expiry lifecycle**

```bash
git add src/modules/trial/expiry.ts src/app/api/cron/process-queue/route.ts tests/trial-expiry.test.ts
git commit -m "feat(trial): expire acquisition trials idempotently"
```

### Task 5: Founder trial pipeline and funnel summary

**Files:**
- Modify: `src/modules/admin/leads.ts`
- Modify: `src/app/admin/leads/page.tsx`
- Modify: `src/app/admin/leads/lead-row.tsx`
- Modify: `src/app/admin/leads/actions.ts`
- Create: `src/components/features/admin-shell/trial-funnel-summary.tsx`
- Modify: `tests/admin-leads.test.ts`
- Create: `tests/admin-trial-funnel.test.ts`

**Interfaces:**
- Extends: `LeadKind` with `trial` and `LeadRow` with optional trial lifecycle detail.
- Produces: `trialFunnelCounts()` for created, claimed, setup, first reply, demo booked, checkout clicked, and converted totals.

- [ ] **Step 1: Write failing lead projection and funnel tests**

```ts
expect(LEAD_KINDS).toEqual(["access", "waitlist", "booking", "trial"]);
expect(row).toMatchObject({
  kind: "trial",
  name: "Aster Clinic",
  secondary: "owner@aster.in",
  lifecycle: "exhausted",
  repliesUsed: 15,
  replyLimit: 15,
  knowledgeSource: "website",
  demoBooked: true,
  converted: false,
});
```

Test status/search/kind pagination, duplicate matching by email/phone across all four sources, founder notes/status updates, `newLeadsCount`, and that funnel counts use milestone columns rather than event-row counts.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/admin-leads.test.ts tests/admin-trial-funnel.test.ts`

Expected: FAIL because trials are absent from the leads desk.

- [ ] **Step 3: Project acquisition trials into the existing pipeline**

Add `trialWhere` using `leadStatus`, `businessName`, `ownerName`, `email`, and `phoneE164`. Select no claim hash and no event props. Map:

```ts
{
  id: trial.id,
  kind: "trial",
  name: trial.businessName,
  secondary: trial.email,
  email: trial.email,
  phoneE164: trial.phoneE164,
  source: trial.utmSource ?? trial.source,
  status: isLeadStatus(trial.leadStatus) ? trial.leadStatus : "new",
  lifecycle: deriveTrialStatus({ ... }, now),
  repliesUsed: trial.repliesUsed,
  replyLimit: trial.replyLimit,
  knowledgeSource: trial.knowledgeSourceUsedAt ? trial.knowledgeSource : null,
  demoBooked: Boolean(trial.demoBookedAt),
  converted: Boolean(trial.convertedAt),
}
```

Include trial groupBy in `leadCounts`, trial count in `newLeadsCount`, and `acquisitionTrial.update` in `updateLead`. Return `gaClientId` for trial status transitions using the same conflict-safe update strategy as bookings.

- [ ] **Step 4: Render lifecycle separately from sales status**

Add “Free trials” to the kind filters. Trial rows show:

- lifecycle badge;
- `repliesUsed / replyLimit`;
- source used to train;
- setup, demo-booked, checkout-clicked, and converted indicators;
- expiry date when active/expired;
- the existing founder-controlled sales-status select and notes.

Do not reuse the sales-status badge as the lifecycle badge.

- [ ] **Step 5: Add a compact funnel summary**

`trialFunnelCounts` returns all-time totals and trailing-30-day created count. Render a compact server component above the list:

```txt
Created → Claimed → Setup → First reply → Demo booked → Checkout → Paid
```

Show counts, not percentages, until the sample is large enough for rates to be useful. The component is founder-only because the page already calls `requireFounder()`.

- [ ] **Step 6: Run founder and analytics regression tests**

Run: `npx vitest run tests/admin-leads.test.ts tests/admin-trial-funnel.test.ts tests/admin-gate.test.ts tests/ga4-leads.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit founder trial operations**

```bash
git add src/modules/admin/leads.ts src/app/admin/leads/page.tsx src/app/admin/leads/lead-row.tsx src/app/admin/leads/actions.ts src/components/features/admin-shell/trial-funnel-summary.tsx tests/admin-leads.test.ts tests/admin-trial-funnel.test.ts
git commit -m "feat(admin): add trial funnel to leads desk"
```

### Task 6: Copy, privacy disclosure, end-to-end verification, and progress record

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/free-trial/page.tsx`
- Modify: `PROGRESS.md`
- Create: `tests/free-trial-copy.test.ts`
- Modify: `tests/privacy-policy.test.ts`

**Interfaces:**
- Consumes: the completed end-to-end funnel.
- Produces: honest public disclosure and a fully verified implementation record.

- [ ] **Step 1: Write failing copy and legal tests**

Assert the public flow clearly says:

- trial ends after seven days or 15 generated replies, whichever comes first;
- no card is required;
- no real WhatsApp number is connected during the trial;
- imported material is used to ground that business’s AI;
- history remains readable after expiry while new AI replies stop;
- demo/trial contact consent is not customer marketing consent;
- the Privacy Policy names trial profile data, uploaded business material, simulated chats, usage milestones, and attribution data.

Assert there is no claim of a fixed deletion period unless the approved legal copy already contains one.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/free-trial-copy.test.ts tests/privacy-policy.test.ts`

Expected: FAIL until the final disclosures are present.

- [ ] **Step 3: Add concise disclosures without inventing policy**

Update the free-trial FAQ and form helper text. Add trial data categories and purposes to the existing Privacy Policy while preserving its current no-fixed-retention-schedule statement. Link Terms and Privacy beside the consent control. Keep customer marketing opt-in language separate and state that trial/demo consent does not opt the business’s customers into messages.

- [ ] **Step 4: Run the full automated verification**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm test
npm run lint
npm run build
```

Expected: all commands exit 0. If real-database concurrency tests require `TEST_DATABASE_URL`, record a skip rather than using a shared or production database.

- [ ] **Step 5: Verify the complete flow in simulation mode**

Run: `npm run dev`

Using a fresh email, verify:

1. Meta-style UTM URL → `/free-trial` → account confirmation → `/trial/setup`.
2. One training source → fact approval → trial Home.
3. Coach marks and persistent checklist across all four destinations.
4. Inline customer/AI exchange through the real simulated inbound path.
5. Reply 15 succeeds and reply 16 performs no model call.
6. Locked WhatsApp preview → demo modal with trial metadata.
7. Signed Cal fixture links only matching trial/email.
8. Paid checkout test fixture activates the same org and unlocks standard navigation.
9. Expiry fixture preserves history but blocks another generated reply.
10. Founder Leads shows the trial lifecycle and funnel counts.

- [ ] **Step 6: Record the completed funnel**

Append to `PROGRESS.md`:

```md
## 2026-09-20 — Free-trial conversion funnel

- Correlated signed demo bookings and verified paid activation to the originating trial while preserving the same workspace.
- Added durable, privacy-safe trial milestones, idempotent expiry, and founder funnel reporting.
- Verified the complete simulation-first flow from clinic landing page through setup, guided testing, demo, expiry, and paid conversion.
```

- [ ] **Step 7: Commit final disclosure and progress record**

```bash
git add src/app/privacy/page.tsx src/app/free-trial/page.tsx PROGRESS.md tests/free-trial-copy.test.ts tests/privacy-policy.test.ts
git commit -m "docs(trial): finalize funnel disclosures"
```
