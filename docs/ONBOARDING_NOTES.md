# Onboarding & booking notes (founder walkthrough, 2026-09-17)

Collected while the founder onboards a fresh workspace as a real client would:
"Goldmine Infotech and Systems", Pro plan, country India (timezone
Asia/Kolkata saved at onboarding), test mode.

**Status: shipped 2026-09-17** (commits a4fb1c9 → 8115092). Every note below
is fixed in code except the ones marked *founder action*, which need keys or
a Vercel setting only the founder can add. Decisions taken along the way are
recorded under each note. Kept as the record of what was found and why.

| Note | Fixed by |
|---|---|
| A1 wrong booking time | `lib/timezone`, `parseWhen(text, now, timezone)`, tool formats on the business clock |
| A2 false reminder promise | tool promises a reminder only when Follow-ups is on |
| A3 no bookings page | `/bookings` in the sidebar, confirm / cancel / no-show / done |
| A4 AI off after onboarding | onboarding switches it on; "Your AI is switched off — Turn it on" notice on Home, Training, Try |
| A5 fake calendar, green badge | test calendar only in test workspaces, blue "Test calendar" badge, honest copy |
| A6 calendar gated on platform switch | `calendarModeFor`: workspace flag decides; real connection is Google or "unavailable", never faked |
| A7 real Google path untested | driver tests with fetch mocked; founder still to run one real booking once keys exist |
| A8 books outside hours | structured opening hours from the questionnaire, editable in Setup, enforced in booking |
| A9 Google changes ignored | events read back before reminders and on the Bookings page; moved → new time, deleted → cancelled |
| A10 no real alternatives | freeBusy sweep over 7 days, filtered to opening hours |
| E1 Client / Test choice | required on admin New workspace |
| E2 client never sees test mode | every mock keyed to the workspace flag |
| E3 Try your AI in a live workspace | +999 sandbox numbers, always the simulation sender |
| E4 platform switch | *founder action*: `SEND_MODE=live` in Vercel |
| B1 dead end after questionnaire | finish screen with facts count + next steps |
| B2 facts below the fold | Training leads with "Your AI knows N facts" |
| B3 facts skip review | finish screen sends them to check the library first (facts stay live: they are the owner's own words) |
| B4 checklist | plan-aware, test mode never ticks, no campaign step |
| C1 pale buttons | full colour, validate on click |
| D Google keys, duplicate workspace | *founder action* |

Each note: what happens, why it hurts, the fix, and where the code is.

---

## A. Blocks selling: must fix before any paying client

### A1. Booking times ignore the country chosen at onboarding
- **Found:** founder picked India at onboarding, and the workspace has
  `timezone = Asia/Kolkata` saved. A customer booked "Friday 18 September at
  4 PM". Stored `scheduledFor` = `2026-09-18T16:00:00Z` = **9:30 PM IST**.
- **Why:** `parseWhen` (`src/modules/calendar/when.ts`) builds the time with
  `setHours` / `getDay` / `setDate` in the **server's** timezone, which is UTC
  on Vercel. `bookAppointment` (`src/modules/calendar/index.ts:63`) never
  passes the workspace timezone in.
- **Everything else already uses the timezone correctly.** Checked 2026-09-17:
  the AI's "TODAY" line (`agent/prompt.ts`), Home stats (`dashboard/stats.ts`),
  and voice calling hours (`voice/reminder-calls.ts`). Only booking is wrong.
- **Impact:**
  - a real Google Calendar event lands 5½ hours late;
  - the 2-hour reminder fires at 7:30 PM, after a 4 PM appointment;
  - no-show detection runs 5½ hours late;
  - "tomorrow" said between 12:00 and 5:30 AM IST resolves to the wrong day,
    because the UTC date is still yesterday;
  - the test calendar's "1 PM is busy" demo (`drivers/calendar-simulation.ts`)
    checks UTC hours too.
  - Every client outside UTC is affected: India, Singapore, Malaysia, UAE.
- **Hidden by a second UTC mistake:** `formatWhen` in
  `src/modules/agent/tools/capture-booking.ts` also formats in server time, so
  the confirmation text and the staff note read "4:00 pm" and look right. Fix
  both together. Correcting only the parser would make the AI confirm
  "10:30 am".
- **Same bug with a real Google Calendar:** the event is sent as that wrong
  instant, so it appears at 9:30 PM in the owner's calendar.
- **Fix:** parse the wall-clock time in `org.timezone` and convert once to an
  instant. Make the test calendar read hours in the same timezone. Add tests
  for IST and SGT: a plain "4 PM", a weekday, and "tomorrow" said at 1 AM local.

### A2. Reminders are off, and the AI promises them anyway
- **Found:** the AI told the customer "You'll get a reminder soon." Nothing will
  be sent. Reminders only run for workspaces with follow-ups enabled
  (`src/modules/followup/reminders.ts:26`). Onboarding leaves follow-ups off,
  and nothing in setup asks you to turn them on.
- **Why:** the booking tool always instructs the AI to promise a reminder
  (`src/modules/agent/tools/capture-booking.ts:112`).
- **Founder decision (2026-09-17):** "I don't care about the reminders."
  Google Calendar's own reminders are enough once the AI books.
  **Note the limit:** Google reminds the *owner* (it is their calendar). The
  customer only gets a reminder from Nudge, and only when Follow-ups is on.
- **Fix:** the AI stops promising a reminder unless Follow-ups is on. No
  reminder step in setup.

### A3. The AI can book, but there is nowhere to see bookings
- **Found:** founder booked a demo and asked where to see it. The answer was
  nowhere: bookings show only as a count on Home and as messages inside the
  chat. No list, no calendar view, no way to confirm, cancel, or mark a no-show.
- **Why it hurts:** booking is the headline promise ("books into your real
  calendar"). A front desk whose bookings you can't see isn't one.
- **Fix:** a Bookings page (upcoming / past, customer, time in the workspace
  timezone, status, link to the chat, and confirm / cancel / no-show actions)
  in the sidebar. Show the next few on Home too. In test mode, label them
  practice bookings.

### A4. The AI is switched off after onboarding, and nothing says so
- **What happens:** onboarding creates the agent with `enabled: false`
  (`src/app/(app)/onboarding/actions.ts:124`). Home and Training never mention
  it. The only on-switch is the "Auto-reply" toggle on AI Front Desk, Setup tab.
- **Why it hurts:** "Try it in chat" gets no reply, only a grey line saying the AI is off.
- **Decision:** finishing onboarding switches the AI on. A workspace that
  skips onboarding already gets an enabled AI (`ensureAgentProfile`), so
  "off after onboarding" was the odd one out. Nothing reaches a customer
  until a number is connected anyway. The Setup toggle still turns it off,
  and Home shows a plain "Your AI is off" notice whenever it is.

### A5. Calendar "connects" to a fake account with a green Connected badge
- **What happens:** Apps, Google Calendar, Connect never shows Google sign-in.
  It saves `demo-calendar@nudge.local` and shows green "Connected". The copy
  contradicts itself: "books real appointments into demo-calendar@nudge.local
  (test calendar)".
- **Why:** `connectCalendarAction` mocks the calendar whenever
  `SEND_MODE=simulation` or Google keys are missing. Production has both
  (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set in Vercel, checked
  2026-09-17).
- **Fix:** blue "Test calendar" badge. One plain line: "Practice bookings only.
  Your real Google Calendar connects when you go live." Files:
  `src/app/(app)/integrations/calendar-actions.ts`, `calendar-card.tsx`, and
  the tile text in `src/modules/integrations/catalog.ts`.

### A6. A real calendar depends on a platform-wide switch, not the workspace
- **What happens:** `shouldUseGoogle` (`src/modules/calendar/index.ts:31`) and
  the connect action read the global `env.SEND_MODE`. One live client can't
  get a real calendar while the platform stays in simulation, and flipping
  `SEND_MODE=live` flips every workspace at once.
- **Fix:** gate on the workspace's own `org.simulated`, the way WhatsApp
  sending already does.

### A7. The real Google Calendar path has never run
- **What happens:** production has no Google keys, so every connection so far
  has been the test calendar. There are tests for the test calendar and the
  time parser, but none for the real driver
  (`src/modules/calendar/drivers/calendar-google.ts`).
- **Fix:** before the first client, connect a real Google account on a live
  test workspace and check: sign-in works; a booking appears at the right local
  time; a slot that's already busy is refused; disconnect works. Add driver
  tests with mocked Google responses.

### A8. The AI will book outside opening hours
- **What happens:** the real calendar only checks for clashes. An empty slot at
  3 AM on a Sunday counts as free, and nothing checks the business's hours.
- **Fix:** enforce opening hours in the booking tool, taken from Setup or the
  facts, before the calendar check. Also offer the nearest open slots.

### A9. Changes made in Google Calendar never reach Nudge
- **What happens:** Nudge writes the event and never reads it back. If the owner
  moves or deletes it in Google Calendar, Nudge still sends reminders for the
  old time and can mark the customer a no-show.
- **Fix:** before sending a reminder or marking a no-show, read the event with
  its stored `calendarEventId`. Skip it if the event is deleted, and use the new
  time if it moved.

### A10. When a real slot is busy, the AI has no alternatives to offer
- **What happens:** the test calendar suggests two other times. The real driver
  returns "busy" with no alternatives, so the AI can only say "another time".
- **Fix:** query the next few free slots inside opening hours and offer two.

---

## E. Client workspaces start in production (founder, 2026-09-17)

> "From now on in onboarding there should be no test mode. Start only with
> production mode. Only test mode I will use. In nudgeagent/admin there should
> be an option after add workspace: client or test."

### E1. Admin "New workspace" gets a Client / Test choice
- **Now:** every founder-created workspace starts in test mode
  (`simulated: true`, `src/modules/admin/create-workspace.ts`), and the admin
  "Switch to live" button refuses until a WhatsApp number is connected.
- **Fix:** a required choice on the form. **Client** = production from the
  first sign-in (`simulated: false`). **Test** = simulated. The choice is
  written to the audit log. The "Switch to live" control stays for older
  workspaces.

### E2. A client workspace never shows test mode
- **Now:** in a simulated workspace the calendar mocks itself, the voice page
  offers "Simulate a call", "Try your AI" runs the tester, and Home, the top
  bar and onboarding all show a "Test workspace" pill.
- **Fix:** in a live workspace none of that appears. Every app shows its real
  state ("Not connected" with a real Connect button). Test-mode pills appear
  only in test workspaces.

### E3. "Try your AI" must work in a live workspace without sending anything
- **Now:** the tester refuses in live mode ("message it from your phone"),
  so a client workspace could not try the AI before its number is connected.
- **Fix:** the tester always works. Its replies are forced through the
  simulation sender, so nothing ever leaves the platform, whatever the
  workspace mode. The real number, once connected, is unaffected.

### E4. Production runs the platform-wide test switch (founder action)
- **Now:** Vercel production has `SEND_MODE=simulation`. That switch wins over
  every workspace setting, so **no workspace can be live until it is changed
  to `live`**. Going live also needs the permanent Meta system-user token
  (readiness report, 2026-09-15). Test workspaces stay simulated on their own
  flag after the switch.
- **Code is ready for it:** every mode check reads the workspace flag once the
  platform switch is live.

---

## F. Go-live path (found 2026-09-18, before the first number was connected)

### F1. Test-mode templates would have failed at Meta — fixed
- **Found:** the workspace's six follow-up templates were "APPROVED" with mock
  ids (`sim-tpl-…`). Meta had never seen them, and nothing resubmitted them on
  go-live, so every reminder and lead nudge would have failed.
  A live workspace with no number yet had the opposite problem: turning on
  Follow-ups marked all six REJECTED ("Connect your WhatsApp…") for good.
- **Fix:** `src/modules/orgs/go-live.ts` `prepareWorkspaceForLive`, called when
  an owner connects a number and when a founder flips a workspace live:
  submits every library template Meta has never seen. Follow-ups turned on
  before a number exists now wait as PENDING instead of REJECTED.
  Campaign templates (they carry product images) are resubmitted from the
  campaign itself.

### F2. A real customer could have been booked into the test calendar — fixed
- **Found:** connecting a number makes a workspace live, but its test calendar
  stayed connected, and the test calendar says yes to everything except 1 pm.
- **Fix:** going live removes the test calendar. `bookAppointment` also refuses
  a test calendar in a live workspace and records the request for staff
  instead. The owner connects real Google in Apps.

### F3. Order matters when connecting the first number — founder action
- The connect form checks with Meta that the number belongs to the WABA, but
  only when the platform is live (`validateWhatsappConnection` skips the check
  under `SEND_MODE=simulation`). **Set `SEND_MODE=live` and redeploy first,
  then connect the number.** Production already has the three secrets live
  mode requires (`META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`,
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).

### F4. `CRON_SECRET` is not set in production — founder action
- Checked 2026-09-18: the variable is absent from Vercel production, so the
  cron endpoint that sends follow-ups and campaigns accepts unauthenticated
  calls. It is idempotent and consent-gated, but set it before going live,
  and set the same value as the `CRON_SECRET` secret in the GitHub repo (the
  10-minute tick workflow sends it).

---

## B. Onboarding flow: where people get stuck

### B1. Dead end after the questionnaire (founder reported)
- **What happens:** "Save all answers", and the interview's "See what it knows",
  land on Training: an import box and an empty "Nothing needs your answer" card.
  No next step.
- **Fix:** a result card with the next step ("Your AI learned 91 facts.
  Switch it on, then try it in chat"), or keep the setup checklist visible on
  /agent until setup is done.
- Code: both `router.push("/agent")` calls in
  `src/app/(app)/agent/questionnaire/questionnaire-client.tsx`.

### B2. What the AI learned is below the fold
- **What happens:** 20 answers became 91 live facts. The proof, the Fact
  library, sits under an import box and an empty state.
- **Fix:** once facts exist, lead Training with "Your AI knows 91 facts" and
  move the import box down or collapse it.

### B3. Questionnaire facts go live without review
- **What happens:** the AI distils each answer into facts and saves them
  `active` straight away. Nobody has read those 91 facts. Website and PDF
  imports, by contrast, wait as drafts for approval.
- **Why it hurts:** a mis-distilled price or warranty term gets quoted to customers.
- **Fix (decide):** a one-screen "check what it learned" review after saving,
  or at least a prompt to skim before switching the AI on.

### B4. Home checklist skips what matters and ticks test mode as "connected"
- **What happens:** the steps are Teach, Try, Connect WhatsApp, Import
  customers, Send a campaign. "Connect WhatsApp" is ticked whenever the workspace
  is in test mode (`buildChecklist`, `src/modules/dashboard/stats.ts`). There
  are no steps for switching the AI on, reminders, calendar, voice, or seeing
  bookings. A campaign counts as one of five (AGENTS.md: never the headline).
- **Fix:** a plan-aware checklist: Teach, Check facts, Switch on, Try, Connect
  calendar, Turn on reminders, (Pro) Hear it on a call, Import customers, Go live
  on WhatsApp. Test mode never ticks the go-live step; say "we do this with you".

---

## C. Polish

### C1. Disabled primary buttons look broken
- "Find my listing" and "Import" on Training are pale green until you type.
  Keep them full colour and validate on click, or use a neutral disabled style.

---

## D. Founder actions (config, not code)
- **Google Calendar keys:** create the Google sign-in app with the Calendar
  scope, then add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
  `GOOGLE_OAUTH_REDIRECT_URI` (the app's `/api/integrations/google/callback`
  URL) to Vercel. Without the redirect URI, Google sign-in fails.
  Calendar is a sensitive scope, so start Google's app verification early.
  Don't run real clients on an app left in "Testing" status, because Google
  expires those sign-ins after about a week. Check Google's current OAuth docs
  before relying on the exact limits.
- **Duplicate workspace:** production has "Goldmine Infotech" (2026-09-16,
  empty) and "Goldmine Infotech and Systems" (2026-09-17, in use). Delete the
  older one when done.
