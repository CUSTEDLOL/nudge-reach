# First High-Volume WhatsApp Client Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task. Human-owned Meta, banking, vendor, and production cutover steps must pause for the named human approval; they are not delegated.

**Goal:** Move one existing-vendor client with approximately 100 WhatsApp leads per day onto Nudge's AI Front Desk without losing the phone number, misrouting Meta charges, sending duplicate AI replies, or violating consent and the 24-hour service window.

**Architecture:** Use the existing per-client manual path: the client owns its Meta Business Portfolio, WhatsApp assets, phone number, client-specific Meta app/system user, and payment method; Nudge stores the client token encrypted and supplies the AI Front Desk. Rehearse the complete workspace in simulation, prove a controlled live path, pause the old automation, cut over with rollback available, then ramp traffic in cohorts.

**Tech Stack:** Meta Business Suite and WhatsApp Manager, Meta Developers and WhatsApp Cloud API, Nudge (Next.js, Supabase/Postgres, Prisma), Anthropic/OpenAI/Google BYOK through `lib/model-router`, Google Calendar, payment links, and the client's CRM.

**Spec:** `docs/META_COMPLIANCE_INBOUND.md`, with outbound requirements from `docs/META_COMPLIANCE_MARKETING.md` and commercial limits from `docs/plans/2026-09-11-tiered-pricing-design.md`.

## Global Constraints

- Use the official Meta WhatsApp Cloud API only; QR-code, WhatsApp Web, session-cookie, or browser automation is prohibited.
- The client owns the Meta Business Portfolio, WhatsApp account, phone number, Meta app/system user, and payment method.
- For the first approximately 1–10 clients, use a separate client-owned Meta app and manual connection; do not present Nudge as a Meta Tech Provider or reuse one unreviewed Nudge app across client accounts.
- Meta bills the client directly. Nudge does not collect card details, extend a Meta credit line, or mark up the client's Meta invoice.
- Do not cancel the old vendor, delete a WhatsApp account, remove a phone number, disable two-factor authentication, or revoke working access before the migration path and rollback have been approved.
- No credentials, access tokens, PINs, chat transcripts, phone numbers, patient data, or other client PII may be committed to Git, pasted into tickets, or included in screenshots stored in the repository.
- Marketing sends require recorded WhatsApp opt-in and are double-gated; STOP and other opt-outs are permanent, and imports must never resurrect them.
- Free-form messages are allowed only within 24 hours of the customer's latest message. Business-initiated messages outside the window use an approved template.
- Every query remains tenant-scoped, human roles remain server-enforced, and the AI remains grounded in one client's approved business knowledge.
- Platform-paid runtime AI stays behind `lib/model-router` on an allowed Sonnet or Haiku model. This high-volume client should use an approved BYOK model unless the commercial agreement includes a committed credit block.
- Local rehearsals keep `SEND_MODE=simulation`; on a production deployment whose global mode is live, the client workspace remains `simulated=true` until an explicit founder Controls action at UAT/cutover. Never change the global mode to onboard one tenant.
- Approximately 100 leads/day is an Enterprise deal, not Pro at list price. Included AI credits are not yet metered or capped in the product, so usage must be reviewed manually during the pilot.
- This plan does not build Embedded Signup, make Nudge a Tech Provider, transfer Meta billing to Nudge, launch cold outreach, or add new product behavior.

## Roles and evidence

| Role | Responsibility |
|---|---|
| Client executive sponsor | Owns the decision, signs the commercial/data terms, approves cutover and rollback. |
| Client Meta administrator | Controls the Business Portfolio, WhatsApp assets, phone verification and system user. |
| Client finance administrator | Adds the client card and tax information in Meta; verifies the charged account. |
| Client operations owner | Supplies business knowledge, calendars, follow-up rules, staff handoffs and UAT approval. |
| Nudge onboarding lead | Runs the checklist, keeps the decision log, coordinates the old vendor and obtains approvals. |
| Nudge technical lead | Configures Nudge, verifies credentials, executes tests, monitors cutover and owns rollback. |
| Old vendor contact | Confirms ownership/billing, exports data, pauses its AI/queues and completes offboarding or migration. |

All evidence belongs in a restricted client onboarding folder outside Git. Maintain five records there: `Readiness Record`, `Asset and Billing Matrix`, `Template Register`, `UAT Evidence`, and `Cutover Log`. Each record must show the date, operator and approver without containing reusable secrets.

## Target timeline

| Timing | Gate |
|---|---|
| Days -10 to -8 | Commercial scope, lead-source classification and ownership audit |
| Days -8 to -6 | Vendor handover, export, consent audit and migration decision |
| Days -7 to -4 | Client-owned Meta access, billing and template submission |
| Days -6 to -2 | Nudge workspace, BYOK, knowledge and integration configuration |
| Days -3 to -1 | Simulation rehearsal and controlled live UAT |
| Day 0 | Production cutover |
| Days 1 to 7 | Cohort ramp and hypercare |
| Day 30 | Outcome, cost and renewal review |

The Meta asset/billing path and template approval are the critical path. If the old vendor owns the number or the billing account cannot be reassigned, move Day 0; do not compress testing.

---

### Task 1: Fix the commercial scope and success measures

**Owners:** Nudge onboarding lead, client executive sponsor, client operations owner

**Uses:** `docs/plans/2026-09-11-tiered-pricing-design.md:170`

**Produces:** Signed scope and completed `Readiness Record`

- [ ] **Step 1: Record the lead source**

Classify each source as one of: customer-initiated WhatsApp, click-to-WhatsApp ad, Meta lead form with explicit WhatsApp consent, website form with explicit WhatsApp consent, or no valid WhatsApp consent. Do not treat possession of a phone number as consent.

- [ ] **Step 2: Establish the baseline**

Record the preceding 30 days of lead count, first-response time, unanswered rate, booked consultations, show rate, sales, current vendor fee, Meta charge, and estimated human handling cost. If the old vendor cannot export a metric, record it as unavailable rather than inventing it.

- [ ] **Step 3: Define the first 30-day outcome**

Use these technical acceptance targets: zero duplicate AI replies, zero known consent/window violations, zero permanent opt-outs resurrected, at least 95% of eligible inbound leads receiving a first response within 60 seconds, at least 95% successful calendar actions, and every human-handoff request visible to staff. Business conversion remains a measured outcome, not a guaranteed claim.

- [ ] **Step 4: Contract the high-volume deal correctly**

Quote an Enterprise arrangement. Prefer the pricing design's approximately ₹35,000/month BYOK structure; alternatively scope the committed-credit structure at approximately ₹57,500/month. A separately scoped ₹75,000–₹1,50,000 implementation is allowed for migration, knowledge, templates and integrations. The signed order must state that Meta message charges and BYOK provider charges are paid by the client.

- [ ] **Step 5: Complete the authority and data documents**

Obtain written authority to configure the client's Meta assets, a processor/data-handling agreement, the client's warranty that imported outbound recipients have WhatsApp opt-in, and acknowledgement that the AI handles front-desk information and booking—not diagnosis or medical advice.

- [ ] **Step 6: Pass Gate 1**

The client executive sponsor approves the commercial scope, named owners, data handling, success measures and target cutover week. Without this approval, stop.

### Task 2: Audit ownership, billing and the old integration

**Owners:** Nudge onboarding lead, client Meta administrator, client finance administrator

**Uses:** Meta Business Suite, WhatsApp Manager, the old vendor dashboard

**Produces:** Completed `Asset and Billing Matrix` and one approved migration path

- [ ] **Step 1: Conduct a client-controlled screen-share**

Have the client log in themselves. Record the Business Portfolio ID, WhatsApp/WABA or WhatsApp Account ID, Messaging Account ID if displayed, Phone Number ID, display number, display name, quality rating, messaging limit, connected Meta app, current system user owner, and business-verification state.

- [ ] **Step 2: Identify billing ownership**

Open the payment settings for the exact WhatsApp or Messaging Account. Record whether it uses the client's card, Meta monthly invoicing, or the old vendor's shared credit line. Record only the billing owner and last four card digits; never copy full card details.

- [ ] **Step 3: Identify the technical connection**

Classify the old tool as official Cloud API, WhatsApp Business App Coexistence, or unofficial WhatsApp Web/QR automation. Record whether the client still uses the phone app, which app receives webhooks, and whether the old AI can be paused independently from the number.

- [ ] **Step 4: Select exactly one path**

Use this decision:

1. Client owns assets and pays Meta: keep the number and establish the new client-owned app/system-user connection.
2. Client owns the number but the vendor supplies credit: establish client-paid messaging/billing first, then remove the vendor credit line.
3. Vendor owns the number or legacy WABA: require the vendor's official ownership/phone-number migration process and Meta Support if necessary.
4. Business App Coexistence: preserve the phone app and history unless the current Meta flow explicitly says the number is ineligible.
5. Unofficial automation: export permitted business data and move to Cloud API; do not transfer sessions or cookies.

- [ ] **Step 5: Check dual-integration behavior**

Assume both integrations may receive inbound events until proven otherwise. Document how the old AI will be paused before Nudge is enabled; disconnecting the number itself is not the pause mechanism.

- [ ] **Step 6: Pass Gate 2**

The client Meta administrator and Nudge technical lead sign the matrix. It must identify the owner and billing route for every asset and state the exact migration path. Any unknown owner or credit line blocks cutover.

### Task 3: Secure the vendor handover and consent-safe data export

**Owners:** Nudge onboarding lead, old vendor contact, client operations owner

**Produces:** Handover package, consent import decision and rollback contact

- [ ] **Step 1: Send the vendor handover request**

Request ownership confirmation, account identifiers, billing arrangement, two-step-verification procedure, template export, quality rating, messaging limit, scheduled sends, data-export format, migration/offboarding procedure, support contact and a proposed cutover window. Explicitly instruct the vendor not to deactivate the number.

- [ ] **Step 2: Export operational data securely**

Export conversations, contacts, open lead state, templates, template statuses, consent source/timestamp, opt-outs, scheduled follow-ups and unresolved handoffs to the restricted onboarding folder. Do not put these exports in the repository.

- [ ] **Step 3: Build the suppression list first**

Create the permanent suppression set from all vendor opt-outs, STOP events and client suppression sources before preparing any positive-consent import. A phone number appearing in both sets remains opted out.

- [ ] **Step 4: Approve only provable consent**

The client operations owner reviews each imported source. Import as `opted_in` only when the source and timestamp demonstrate WhatsApp permission; import uncertain contacts without marketing permission or exclude them.

- [ ] **Step 5: Back up before any number change**

If the approved path requires a number migration rather than account sharing, finish the conversation/contact export and have the client acknowledge what history or app access Meta says will not transfer. Do not rely on Nudge to recreate historical chat state.

- [ ] **Step 6: Pass Gate 3**

The handover package is readable, the suppression list has been reviewed, the old vendor has acknowledged the cutover/rollback window, and no campaign is scheduled across that window.

### Task 4: Establish client-owned Meta access and direct billing

**Owners:** Client Meta administrator, client finance administrator, Nudge technical lead

**Produces:** Client-owned production credentials, active billing method and one correctly billed test delivery

- [ ] **Step 1: Protect client ownership**

Confirm two trusted client administrators have full control of the Business Portfolio. If a new app is required, create a Business-type Meta app inside the client's Portfolio and add the WhatsApp product. Nudge personnel may guide the screen-share but do not become the sole administrator.

- [ ] **Step 2: Establish the client system user**

Create or select a client-owned system user, assign the exact WhatsApp/Messaging Account and phone asset, and generate the durable token with `whatsapp_business_messaging` and `whatsapp_business_management`. Do not use the temporary API Setup token for production.

- [ ] **Step 3: Register or share the existing number through the approved path**

For an ownership migration, arrange OTP access and the two-step-verification action during the agreed window. For a currently shareable number, select the existing number rather than creating a duplicate. Never delete the Business App account merely to make the screen advance without checking current Coexistence eligibility.

- [ ] **Step 4: Add Meta billing**

The client finance administrator opens **Business Settings → Accounts → WhatsApp accounts**, selects the exact account used by the new integration, chooses **Payment settings**, adds the client's card and tax details, and sets it as **Default**. If Meta now labels the billing container a Messaging Account, match its ID to the matrix before saving.

- [ ] **Step 5: Resolve a vendor credit line explicitly**

If the vendor credit line remains attached, use the vendor's offboarding process or Meta Support to establish the client-paid account. Do not infer that adding a card displaced the credit line.

- [ ] **Step 6: Prove billing ownership**

Send one approved template from the new app to a consenting internal test recipient. Confirm the Cloud API response, delivered webhook, sending app/Messaging Account and the corresponding usage in the client's Meta billing view. A successful send without confirmed billing attribution does not pass.

- [ ] **Step 7: Pass Gate 4**

The client Meta and finance administrators sign that the client owns the assets, the default payment method belongs to the client, and the test message was attributed to the expected account.

### Task 5: Configure the Nudge Enterprise workspace in simulation

**Owners:** Nudge technical lead, client operations owner

**Uses:** `docs/TESTING_ENTERPRISE.md`, `src/app/(app)/settings/whatsapp/connect-form.tsx`

**Produces:** Complete simulated AI Front Desk workspace and approved knowledge set

- [ ] **Step 1: Create the tenant and assign Enterprise**

Create the client owner and workspace without production secrets. Resolve the exact owner email prefix into a local shell value named `CLIENT_OWNER_LOOKUP`, then run:

```bash
npm run plan:set -- --org "$CLIENT_OWNER_LOOKUP" --plan enterprise
```

Expected: the command prints the previous plan followed by `enterprise`. Do not sell or promise unlimited AI credits; the current ledger does not enforce them.

- [ ] **Step 2: Connect BYOK**

In **Settings → AI model**, have the client enter its own approved Anthropic, OpenAI or Google key and select a model from Nudge's curated list. Use **Test key** and confirm a provider response. The key must remain encrypted and all calls must continue through `lib/model-router`.

- [ ] **Step 3: Build the business knowledge**

Enter approved services, prices, locations, hours, eligibility boundaries, consultation process, refund/cancellation rules, financing wording, staff contacts, FAQs and prohibited answers. Add the explicit rule that the AI does not diagnose, recommend treatment or invent clinical outcomes.

- [ ] **Step 4: Configure actions and integrations**

Connect Google Calendar; define staff, appointment types, duration, buffers and timezone. Configure payment links, the selected CRM, lead stages and the human-handoff destination. Use client test calendars/payment links before production objects.

- [ ] **Step 5: Configure the conversation policy**

Set the immediate greeting, qualification questions, information the AI may collect, handoff triggers, after-hours behavior, response tone and languages. Every unsupported request must hand off rather than general-chat.

- [ ] **Step 6: Run knowledge acceptance**

The client operations owner tests at least 25 representative questions, including five out-of-scope or adversarial questions. Pass only when all factual responses are grounded and every out-of-scope/medical question refuses or hands off correctly.

- [ ] **Step 7: Pass Gate 5**

The client operations owner approves the knowledge, actions, calendars, payment wording, CRM mapping and escalation path while the workspace remains simulated.

### Task 6: Approve templates and follow-up behavior

**Owners:** Nudge onboarding lead, client operations owner

**Produces:** Approved `Template Register` and consent-gated follow-up sequence

- [ ] **Step 1: Prepare the minimum template set**

Create and submit: lead follow-up, final lead follow-up, appointment confirmation, appointment reminder, reschedule, no-show recovery and payment reminder. Marketing templates must contain `Reply STOP to unsubscribe`; utility templates must remain tied to a user action and contain no promotional copy.

- [ ] **Step 2: Classify the templates honestly**

Classify sales nurturing, re-engagement and ghosted-lead chasing as `MARKETING`. Classify a specific requested appointment or payment update as `UTILITY` only when it is non-promotional. Record Meta's final category, language, template ID, status and approval date.

- [ ] **Step 3: Define stop conditions**

Stop every follow-up sequence immediately when the customer replies, books, pays, requests a human, opts out, becomes ineligible, or is manually suppressed. STOP must win over queued work.

- [ ] **Step 4: Configure a conservative sequence**

Use an immediate inbound response, one relevant follow-up while the customer window remains open, one approved marketing follow-up after the window closes, and one final approved follow-up. Do not add more touches until the first two weeks of block, reply and conversion data have been reviewed.

- [ ] **Step 5: Pass Gate 6**

At least the lead follow-up, appointment confirmation and appointment reminder templates are approved, and every live outbound source maps to a consent rule and stop condition. Template rejection blocks only the flow that needs that template, never invites free-form bypass.

### Task 7: Run automated verification and end-to-end UAT

**Owners:** Nudge technical lead, client operations owner

**Produces:** Passing automated checks and completed `UAT Evidence`

- [ ] **Step 1: Run the protected-path tests**

```bash
npm test -- tests/whatsapp-connection-validator.test.ts tests/webhook-verify.test.ts tests/webhook-inbound-dedupe.test.ts tests/agent.test.ts tests/api-v1-messages.test.ts tests/consent.test.ts tests/template-payload.test.ts tests/send-payload.test.ts tests/followup-pack.test.ts tests/calendar-sim.test.ts tests/payment-link.test.ts tests/byok.test.ts
```

Expected: all selected Vitest files pass. A failure blocks live UAT.

- [ ] **Step 2: Verify the production build**

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Run live-environment preflight**

```bash
npm run preflight:live
```

Expected: deployment, webhook-secret, token, WhatsApp reachability and other required checks report `PASS`. Do not copy secret-bearing output into the client record.

- [ ] **Step 4: Exercise the simulated customer journey**

Test new inquiry, price question, qualification, calendar availability, booking confirmation, payment link, ghosting, approved follow-up, reply reopening the service window, rescheduling, no-show recovery, human handoff and STOP. Save redacted screenshots/status IDs as UAT evidence.

- [ ] **Step 5: Exercise failure paths**

Test duplicate inbound webhook, Meta send failure, expired/invalid BYOK key fallback, unavailable calendar, unsupported medical question, free-form send after 24 hours, opted-out recipient and staff takeover. Expected results are one stored event, no duplicate reply, safe failure/handoff, no out-of-window free-form send and no opted-out send.

- [ ] **Step 6: Save the real connection without activating it**

In the founder control room, open the client's **Integrations → Connect a number**, enter the real display name, WABA ID, Phone Number ID and permanent token, provide the audit reason, and choose **Validate & save**. Expected: Meta validates that the number belongs to the WABA, the token is encrypted, and the workspace remains in test mode.

- [ ] **Step 7: Run controlled live UAT**

With the old AI paused or using a separate Meta test number, use founder **Controls → Switch to live**, test only consenting internal recipients, and then return the workspace to test mode until Day 0. Confirm exactly one inbound reply, webhook status updates, calendar booking, approved template delivery, human handoff and correct Meta billing attribution.

- [ ] **Step 8: Pass Gate 7**

The Nudge technical lead and client operations owner sign UAT. All protected paths pass, there are no unexplained duplicate responders, and rollback can be performed without deleting the number.

### Task 8: Execute the production cutover

**Owners:** Client executive sponsor, Nudge technical lead, old vendor contact

**Produces:** Live Nudge routing, completed `Cutover Log` and an available rollback path

- [ ] **Step 1: Hold the go/no-go call**

Confirm Gates 1–7, named operators, old-vendor contact, client Meta/finance admins, approved templates, valid token, current backup, no pending campaigns and a two-hour observation window. The client executive sponsor says `GO` in writing.

- [ ] **Step 2: Pause the old sender**

Have the vendor pause its AI replies, automations and outbound queues without deleting the phone number or immediately revoking the recovery path. Record the last message ID/time from the old system.

- [ ] **Step 3: Enable Nudge on the production number**

Confirm the production deployment uses `SEND_MODE=live`, the Nudge webhook is verified and subscribed to `messages`, the client number is the workspace default, the agent is enabled and the intended approved templates are visible. In founder **Controls**, use **Switch to live** and complete its confirmation; do not alter other tenants or the global mode.

- [ ] **Step 4: Run the five-message cutover script**

Use consenting test phones to send: a new inquiry, a booking request, an out-of-scope medical question, a human request and STOP. Then send one approved follow-up to an eligible test contact outside the service window. Expected: one AI responder, successful booking, safe handoff/refusal, visible staff handoff, permanent opt-out and template-only outbound.

- [ ] **Step 5: Observe production**

For two hours, watch webhook errors, response latency, duplicate replies, handoffs, bookings, token errors, template failures and Meta billing. The client operations owner verifies that real leads are visible to staff.

- [ ] **Step 6: Apply rollback if a trigger fires**

Rollback triggers are repeated duplicate replies, any consent/window breach, inability to receive inbound events, more than 5% eligible inbound failures over 15 minutes, wrong Meta billing attribution, unsafe clinical advice or calendar writes to the wrong resource. Disable Nudge's live agent/send path, keep the number intact, notify the client, and re-enable the old vendor only after its operator confirms queues will not duplicate messages.

- [ ] **Step 7: Pass Gate 8**

After the observation window, the client executive sponsor accepts the cutover or invokes rollback. Record the decision, message IDs, account IDs, timestamps and operators without recording secrets.

### Task 9: Ramp safely to 100 leads per day

**Owners:** Nudge onboarding lead, Nudge technical lead, client operations owner

**Produces:** Stable full-volume operation and daily hypercare report

- [ ] **Step 1: Apply the cohort schedule**

Process 10–20 representative leads on the first live day, 25–50 on the second, up to 75 on the third, and up to 100/day from the fourth day. Hold the current cohort whenever an acceptance threshold is missed.

- [ ] **Step 2: Review the daily technical measures**

Record eligible inbound leads, first-response latency, duplicates, send failures, webhook retries, bookings attempted/succeeded, human handoffs, opt-outs, template delivery, Meta quality rating, portfolio messaging limit, Meta spend, AI reply count and BYOK provider spend.

- [ ] **Step 3: Enforce the ramp thresholds**

Advance only with zero duplicate replies, zero consent/window violations, zero unsafe reviewed responses, at least 95% first response within 60 seconds, at least 95% successful calendar actions, under 2% unexplained send failures, and no deterioration below acceptable Meta quality. Correct operational data errors before increasing volume.

- [ ] **Step 4: Sample conversation quality**

The client operations owner reviews at least 20 conversations/day during hypercare, including every handoff and every failed booking. Correct the knowledge or deterministic rules; do not broaden the agent into a general chatbot.

- [ ] **Step 5: Reconcile costs**

Compare Nudge AI usage with the client's provider dashboard and compare delivered template/service activity with the Meta billing account. At approximately 3,000 monthly leads and eight AI replies per lead, treat 24,000 replies as the working capacity estimate until real usage replaces it.

- [ ] **Step 6: Remove old-vendor access after stability**

After at least 48–72 stable hours and client approval, cancel remaining old automations, remove the old app/partner/system-user access appropriate to the migration path, rotate any credential the old vendor could access, and confirm the number and client billing remain healthy.

- [ ] **Step 7: Pass Gate 9**

The client has operated at the agreed full volume for two consecutive days within thresholds, the old vendor is offboarded, and both Meta and AI cost attribution are understood.

### Task 10: Handover operations and review the first 30 days

**Owners:** Nudge onboarding lead, client executive sponsor, client operations owner

**Produces:** Client operating procedure, incident contacts and 30-day outcome report

- [ ] **Step 1: Train the client team**

Train staff to take over a conversation, resolve a handoff, pause the AI, add an approved knowledge fact, identify the 24-hour window, distinguish marketing from utility templates, honour opt-outs and report an unsafe reply. Verify each operator can perform their role without owner privileges.

- [ ] **Step 2: Establish the operating rhythm**

For week one, hold a 15-minute daily review. Thereafter, review weekly: unresolved handoffs, unanswered leads, bookings, no-shows, template quality, opt-outs, quality rating, Meta spend, BYOK spend and conversion outcomes.

- [ ] **Step 3: Document incident ownership**

Meta ownership/billing problems go to the client Meta/finance admin plus Meta Support; Nudge routing/AI/integration problems go to Nudge technical support; number migration issues include the old vendor until closure. The client operations owner remains responsible for medical/business accuracy.

- [ ] **Step 4: Produce the day-30 report**

Compare the Task 1 baseline with response time, unanswered rate, qualified leads, bookings, show rate, sales, handoff volume, opt-outs, Meta cost, AI cost and Nudge fee. Separate correlation from causation and do not manufacture missing baseline values.

- [ ] **Step 5: Decide the next commercial and product step**

Continue, revise or end the client rollout based on the signed outcome report. Product defects found during the pilot receive their own spec and implementation plan. Repeat manual onboarding for design clients only; start the Tech Provider and Embedded Signup program before manual setup becomes the scale bottleneck.

- [ ] **Step 6: Close the plan**

The client executive sponsor signs the operational handover, the restricted evidence folder has correct retention/access, no client data exists in Git, and Nudge records the reusable lessons without copying client PII.

## Final go-live checklist

- [ ] Client owns and can administer the Meta assets and number.
- [ ] Exact sending/Messaging Account and billing owner are recorded.
- [ ] Client card is the default payment method and a test delivery is correctly attributed.
- [ ] Old vendor AI and queues can be paused without deleting the number.
- [ ] Suppression list is loaded before opted-in contacts.
- [ ] Minimum templates are approved and mapped to their correct categories.
- [ ] Knowledge, calendar, payment links, CRM and handoff pass UAT.
- [ ] Protected-path tests, lint, types, build and live preflight pass.
- [ ] Cutover has written `GO`, a two-hour observation window and explicit rollback triggers.
- [ ] Traffic ramps in cohorts; 100/day is not enabled on assumption alone.
- [ ] Old vendor access is removed only after 48–72 stable hours and client approval.
- [ ] Day-30 cost and outcome review is scheduled before go-live.
