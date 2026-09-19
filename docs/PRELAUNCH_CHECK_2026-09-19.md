# Pre-launch check — 19 Sep 2026

Run before the first production client is onboarded. Every line has evidence.
"Walkthrough" means: a throwaway **Client (live)** workspace was created through
the real admin code path, its owner signed in through the real invite path, and
the whole client journey was driven in a real browser on the latest code against
the production database, in live mode. It was deleted afterwards.

## 0. Do these BEFORE creating the client's workspace (founder only)

| # | Action | Why |
|---|---|---|
| 1 | ~~Set `SEND_MODE=live` in Vercel and redeploy.~~ **DONE 19 Sep, at the founder's request.** | Set with the Vercel CLI on the custedlol project, redeployed, and production re-probed on the new deployment: every route answers correctly, which also proves the three secrets live mode requires are present (the app refuses to boot without them). Vercel values are write-only, so the one remaining proof is visual: after you create the client, Home must say **Live workspace**. |
| 2 | ~~Mark your own test workspace "active".~~ **DONE.** | "Goldmine Infotech and Systems" is active, paid to 19 Oct, 5,000 credits, still in test mode. Done through the real admin function, so it is in the audit log. The older empty "Goldmine Infotech" was left inactive: delete it. |
| 3 | ~~Set `CRON_SECRET` in Vercel and GitHub.~~ **DONE 19 Sep.** | A random 64-character secret, set in Vercel production and as the GitHub Actions secret, redeployed. Verified on production: no secret → 401, wrong secret → 401, right secret → 200, and a manually triggered GitHub tick → HTTP 200. A copy is in the git-ignored `.env.local` for the external pinger in step 4. It is one-time; rotate only if it leaks, by setting a new value in both places at once. |
| 4 | **Add a 5–10 minute pinger** (cron-job.org or similar) on `https://nudgeagent.app/api/cron/process-queue`, with the header `Authorization: Bearer <CRON_SECRET from .env.local>`. | The GitHub "every 10 minutes" schedule really runs every 2–4 hours (run log, 18–19 Sep). Scheduled campaigns and follow-ups are late by that much. |
| 5 | Permanent Meta system-user token, then connect the number **after** step 1. | The connect form only checks the number with Meta when the platform is live. |
| 6 | Optional today: Google keys (calendar), Razorpay keys (payment links), Zoho/Salesforce keys, Resend key (emails). | Each missing one now shows the client an honest "Not switched on yet". Nothing is faked. Without Resend you copy the owner's setup link by hand; the admin screen gives it to you. |

## 1. Fixed during this check (all shipped to main)

| Found | Impact | Fix |
|---|---|---|
| A workspace created in admin started "inactive" with no paid period | In live mode it has **zero AI credits**: the AI refuses its first reply with "credits used up". Test mode hid it. | `b768bd5` New workspaces start active, paid for a month, with the plan's credits. Re-marking "active" after the month ends renews it (was impossible). Admin directory flags credit-less workspaces. |
| Any AI provider error on a live customer message was re-thrown | **Permanent silence** for that customer: the message is stored first, so Meta's retry is skipped as a duplicate. | `9b1734d` Degrades to the hand-off line, flags the thread "Needs human", logs the error. Verified in the browser. |
| Live workspace + no payment keys → practice pay page | The AI would send a **real customer a pretend checkout** that marks itself paid. | `9b1734d` Refuses; the AI says the team will share payment details. Tile and panel say "Not switched on yet". |
| Live workspace + no CRM keys → simulated CRM | Green "Connected" over a CRM that receives nothing. | `9b1734d` Start route refuses; card shows "Not switched on yet", no Connect link. |
| Confirmed booking with no parsed time read "Time to confirm" | Confusing next to a "Confirmed" badge. | `9b1734d` Shows the customer's own words. |
| The workspace's own "Connect a number" form never asked Meta | In live mode it accepted **made-up IDs and a fake token**, showed a green "Connected" and flipped the workspace live. Inbound messages route by Phone Number ID, so one typo means the AI never hears a customer. Only the admin-assisted path checked. | This commit. The form now asks Meta first and saves nothing on a refusal. Verified against the real Graph API: "Meta rejected the access token. Check it and try again." The answer now stays on screen instead of fading with the toast. |

## 2. Results by area

| Area | Result | Evidence |
|---|---|---|
| Deploy | PASS | Latest main live (new `/whatsapp-ai-automation` page 200). All deployments Ready on the custedlol account. |
| Health and access control | PASS | 20 probes: public pages 200; app pages redirect to login; webhook wrong token 403; unsigned webhook 401; voice endpoints 401; public API 401 without key; www → apex 308. |
| Static quality | PASS | 1,393 tests, typecheck, lint, production build: all clean. |
| Admin → New workspace (Client) | PASS | Real code path in live mode: `simulated:false`, Pro, active, paid to 19 Oct, 5,000 credits issued, India timezone and currency, audit row written. |
| Owner setup link | PASS | Production rendered `/invite/<token>`: "Secure owner setup… Choose your private password… expires 26 September 2026. It works once." A wrong token does not crash. |
| First sign-in | PASS | Invite auto-accepted, owner claimed the workspace, landed on onboarding. No test-mode pill anywhere. |
| Onboarding wizard | PASS | Priority → identity → recommendations → Home. AI is ON afterwards. |
| Home | PASS | "Live workspace"; checklist 3 of 8 with calendar, follow-ups, call, go-live steps; go-live not ticked; no campaign step. |
| Questionnaire | PASS | 20 questions; finish screen "Your AI learned 2 facts" with next steps; opening hours parsed into Mon–Sat 10:00–20:00, Sunday closed (checked in the database). |
| Training / Setup | PASS | Leads with "Your AI knows 2 facts"; hours editor pre-filled; Setup saves. |
| Try your AI (live) | PASS | Works; test customer got `+9999876500002`; nothing can reach a phone. |
| Bookings | PASS | Appointment shown "Mon 21 Sept, 11:00 am" in Asia/Kolkata; Confirm moved a request from "Needs confirming" to "Upcoming"; no "Practice" label for a live client. |
| Google Calendar | PASS (honest) | No Google keys: "isn't switched on for this workspace yet… Nothing was connected." Tile stays Not connected. Never a test calendar. |
| Payments | PASS after fix | See section 1. |
| CRM | PASS after fix | See section 1. |
| Follow-ups | PASS | Switched on in a live workspace with no number: six templates wait as PENDING (not REJECTED); they are submitted to Meta when the number connects. |
| Team | PASS | Invite created, pending, audited. |
| Voice | PASS | ElevenLabs agent healthy: Haiku model, 5 tools, initiation webhook set, post-call webhook attached, enabled, no failures. Page shows 100 minutes, no "Simulate a call". **No phone number imported yet** (0 in ElevenLabs): browser call only until a carrier number is added. |
| WhatsApp connect form | PASS after fix | See section 1. Refusal verified against Meta itself. |
| API keys (Apps drawer) | PASS | Key created and shown once: `nk_live_…`. |
| Outbound webhooks (Apps drawer) | PASS | Endpoint created with six event choices; signing secret shown once. HubSpot bridge recipe opens and links to it. |
| Website widget | PASS | Page renders with the embed snippet; `/widget.js` is public (200). |
| Leads | PASS | Lead added by hand lands as **No consent**, as invariant 2 requires. |
| Creation pages | PASS | New campaign, new template, new automation, Actions, AI model, Data export: all render, zero errors. |
| Every other page | PASS | Inbox, Leads, Campaigns, Templates, Analytics, Apps, Actions, all 9 Settings pages: rendered, zero console errors, zero 5xx. |
| Cron | PASS with caveat | Endpoint healthy, heartbeat ok, now requires the secret (see 0.3). Real cadence 2–4 hours (see 0.4). |
| Credits ledger | PASS | Grant issued at creation; none leaked after cleanup. |
| Tenant isolation, consent, 24h window, official API, cheap-model guard | PASS | Covered by the invariant tests in the suite. |
| WhatsApp webhook, positive path | NOT RE-VERIFIED | This machine no longer has production's verify token or app secret, so a signed test could not be made. Proven end to end on 25 Jul and 29 Aug; those two secrets have not changed since. First real message after connecting the number is the check. |
| Supabase password creation on the invite page | NOT EXERCISED | Would create a real auth user in production. The page renders correctly; you will exercise it with the client. |

## 3. Left in production by this check
Two throwaway workspaces were created and both were deleted with all their data
(verified after each: two workspaces remain, both yours; no WhatsApp numbers, no
stray credit grants). Two deliberate changes remain, both listed in section 0:
`SEND_MODE=live`, and your test workspace marked active.
