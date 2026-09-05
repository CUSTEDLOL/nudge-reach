# Enterprise Track — Manual Test Runbook (E0–E8)

Step-by-step verification of everything shipped 2026-09-04/05. Everything runs
locally in **simulation mode** — no real WhatsApp, Meta, or payment keys are
touched. Expected time: ~45 minutes for all phases.

**Conventions**
- `demo org` = the workspace of `demo.owner@nudge.test` / `NudgeDemo123!`
- ✅ lines are what you should see; if you don't, stop and report the phase + step.
- `$KEY` = the API key you mint in Phase 2.

---

## Phase 0 — Setup (5 min, once)

1. `cd ~/Desktop/NUDGE/WhatsAppCRM && git pull`
2. `npm install` (only if package.json changed)
3. `npm run db:push && npm run db:rls`
   ✅ ends with `Done: RLS enabled on 42 table(s).`
4. Confirm `.env.local` has `SEND_MODE="simulation"` — this is the global kill
   switch that keeps every send mocked, even after "connecting" fake numbers.
5. `npm test` → ✅ all green (597+). If red, stop.
6. `npm run dev` → app on http://localhost:3000, log in as the demo org.

---

## Phase 1 — Tiers & gating (E0)

1. Put the org on Free: `npm run plan:set -- --org demo.owner --plan free`
2. Reload the app. Visit each of these and confirm the **lock/upsell** view:
   - Integrations → API keys + Webhooks cards show upsell text, no create buttons
   - Settings → Agent actions → "An Enterprise feature"
   - Settings → AI model → "An Enterprise feature"
   - Settings → Website widget → "A paid-plan feature"
   - Settings → Voice → "An AI Front Desk feature"
   - Contacts → no Score column values (—)
3. Settings → Billing → ✅ the plan grid shows five tiers; **Enterprise is not
   listed** (contact-us only, by design).
4. Upgrade: `npm run plan:set -- --org demo.owner --plan enterprise`
   ✅ prints `free → enterprise`. Reload — every screen above is now unlocked.

---

## Phase 2 — Developer API + webhooks (E1)

1. Integrations → API keys → **Create key** (name "runbook") → copy the
   `nk_live_…` key once. Export it: `export KEY=nk_live_…`
2. Identity:
   `curl -s localhost:3000/api/v1/me -H "Authorization: Bearer $KEY"`
   ✅ JSON with your org name and `"plan":"enterprise"`.
3. Bad key → `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/v1/me -H "Authorization: Bearer nk_live_wrong"`
   ✅ `401` (JSON error, never a login redirect).
4. Create a contact:
   ```bash
   curl -s localhost:3000/api/v1/contacts -H "Authorization: Bearer $KEY" \
     -H "content-type: application/json" \
     -d '{"name":"Runbook Test","phone":"9876500001","opt_in":true}'
   ```
   ✅ `201`, phone normalized to `+919876500001`. Note the returned `id`.
5. **24-hour window enforced** — free-form to a contact who never wrote in:
   ```bash
   curl -s localhost:3000/api/v1/messages -H "Authorization: Bearer $KEY" \
     -H "content-type: application/json" \
     -d '{"phone":"+919876500001","text":"hello"}'
   ```
   ✅ `422` mentioning the 24-hour window. (Invariant 6 — the API can't bypass it.)
6. Open the window: Inbox → **Try your AI** → send any message as that phone
   number (set the tester's phone to 9876500001) — then re-run step 5.
   ✅ `200` with a `sim-…` provider message id; the reply appears in the inbox thread.
7. **Opt-out cannot be resurrected**: Contacts → open Runbook Test → Opt out.
   Re-run step 4's curl with `"opt_in":true`.
   ✅ `200` (update) but the contact remains opted out in the UI.
8. Webhooks: Integrations → Outbound webhooks → Add (`https://example.com/hook`,
   pick events) → **Test** → ✅ a delivery attempt is logged (status shown;
   example.com may reject — the logging is what's under test).

---

## Phase 3 — Custom agent actions (E2)

1. Settings → Agent actions → **Add action**. Keep the defaults
   (`check_order_status`, sample schema), any `https://` URL, save.
2. Press **Test** → ✅ output shows `"simulated": true` — proof no real network
   call happens in test mode.
3. Inbox → Try your AI → ask: *"Can you check my order status? Order id 12345."*
   ✅ the agent replies referencing the (simulated) action result rather than
   guessing. The thread shows a normal reply — no crash, no stall.
4. Try adding an action named `send_payment_link` → ✅ rejected (built-in names
   are protected).

---

## Phase 4 — Bring-your-own AI (E3)

1. Settings → AI model → ✅ provider dropdown (Anthropic/OpenAI/Google) with a
   short curated model list each — no free-text model field.
2. If you have a real OpenAI or Gemini key: pick the provider + model, paste it,
   Save, then **Test key** → ✅ "responded — your key works."
   Then Inbox → Try your AI → chat → Analytics later shows usage marked to
   your key. **Use Nudge's model** to disconnect when done.
3. If you don't want to burn a key: paste a fake key (`sk-fake…`), Save, Test →
   ✅ a clean "provider rejected the call" error — and chatting in Try your AI
   still works, because a broken BYO setup silently falls back to the platform
   model instead of taking the agent down.

---

## Phase 5 — Multiple numbers + staff walls (E4 + E4b)

1. Settings → WhatsApp → **Advanced: connect manually** → enter fake values
   (WABA `waba-A`, phone number ID `pn-100`, name `Delhi Line`, token `tok-A`)
   → Save. Repeat with `waba-B` / `pn-200` / `Mumbai Line` / `tok-B`.
   ✅ Both listed; the first carries the **Default** badge. (Safe: with
   `SEND_MODE=simulation`, sends stay mocked no matter what.)
2. ✅ "Make default" moves the badge; disconnect the default → the survivor
   inherits the badge automatically. Re-add so you have two again.
3. Inbox → open any thread → ✅ a "via <number>" chip appears in the header
   (only shown when an org has 2+ numbers).
4. Settings → Team → ✅ a **Numbers** column appears; on an AGENT row, chips
   toggle which numbers they see; leaving all off shows "all numbers".
   (Full wall verification needs a second real login — invite an agent email
   and sign up in a private window; their inbox then only shows their numbers'
   threads plus number-less ones. The server-side enforcement itself is
   covered by `tests/number-access.test.ts`.)
5. Campaigns → open/create one to the launch step → ✅ a **Send from** dropdown
   appears listing both numbers.
6. Cleanup for later phases: you can leave both numbers; they're inert in
   simulation.

---

## Phase 6 — Website widget (E5)

1. Settings → Website widget → toggle on, phone `9876543210`, Save.
   ✅ snippet card appears with `data-nudge-key="wk_…"`.
2. Create `/tmp/widget-test.html` containing:
   `<html><body><h1>Test page</h1><script src="http://localhost:3000/widget.js" data-nudge-key="PASTE_KEY" async></script></body></html>`
   and open it in the browser.
   ✅ a green floating WhatsApp button renders; clicking opens wa.me with your
   number + prefilled text (new tab).
3. Privacy check: `curl -s localhost:3000/api/widget/PASTE_KEY/config`
   ✅ only phone/prefill/position/color — no org id.
   `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/widget/wk_000000000000000000000000/config` → ✅ `404`.
4. Toggle the widget off → the config curl now returns 404, and the test page
   renders no button on reload.

---

## Phase 7 — Lead scoring + churn (E6)

1. Generate activity: Inbox → Try your AI → have a short conversation ending in
   a booking ("book me tomorrow 7pm, name Priya, party of 2").
2. Trigger a scoring pass: `curl -s localhost:3000/api/cron/process-queue`
   ✅ JSON includes a `rescored` count ≥ 1.
3. Contacts → ✅ **Score** column shows a number for the active contact
   (sortable; green ≥70, amber ≥40).
4. Open the contact → ✅ "Lead score N/100" with plain-English reasons like
   "replied in the last 2 days · has an upcoming booking".
5. Opt the contact out → re-run the cron curl → ✅ score drops to ≤5 with the
   single reason "opted out of messages".

---

## Phase 8 — Voice gating (E7 fix)

1. Settings → Voice (on Enterprise) → ✅ page renders; **Simulate a call** drops
   a scripted phone-call transcript into the inbox (thread with a "Phone call"
   chip).
2. `npm run plan:set -- --org demo.owner --plan growth` → reload Settings →
   Voice → ✅ locked with the AI Front Desk upsell. Restore:
   `npm run plan:set -- --org demo.owner --plan enterprise`.

---

## Phase 9 — AI chat summaries (E8)

1. Inbox → open the conversation from Phase 7 → in the right panel, next to
   **Internal notes**, click **AI summary**.
   ✅ toast confirms; a note from "AI Assistant" appears starting
   "Chat summary:" — with a real Anthropic key in `.env.local` it's a genuine
   3–5 line brief; without one it's a clearly-labeled sample (both are correct
   behavior).
2. ✅ the same note is visible on the contact's profile (notes are shared).
3. Click it ~10 more times fast → ✅ a rate-limit message appears (org-level).

---

## Phase 10 — Automated gates (the machines re-check everything)

```bash
npm test              # 597+ unit/integration tests
npx tsc --noEmit      # types
npm run lint
npm run build
npm run eval:agent    # 14 live agent scenarios ×5 — needs ANTHROPIC_API_KEY
                      # with credit; passing bar is ≥90% (recent runs: 99–100%)
```

Optional provider benchmark:
`EVAL_PROVIDER=openai EVAL_MODEL=gpt-5-mini EVAL_API_KEY=sk-… npm run eval:agent`

---

## Cleanup (returns the demo org to its starting state)

1. `npm run plan:set -- --org demo.owner --plan free`
2. Settings → WhatsApp → disconnect the fake numbers; Settings → Website
   widget → toggle off; Settings → Agent actions → delete the test action;
   Settings → AI model → "Use Nudge's model"; Integrations → revoke the
   runbook API key.
3. If the org shows as live instead of test mode afterwards (connecting a
   number flips it), reset:
   `node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.org.updateMany({where:{plan:'free'},data:{simulated:true}}).then(r=>console.log('reset',r.count)).finally(()=>p.\$disconnect())"`

## Known limitations (by design, not bugs)

- Templates for all numbers live under the **default** number's WABA
  (multi-WABA template sync deferred).
- Per-number live/test mode is org-level.
- Widget is a wa.me button, not embedded live chat (scoped decision F6).
- No founder admin panel yet — planned in
  `docs/plans/2026-09-05-admin-panel.md`.
