# HANDOVER — AI Front Desk course correction

What this session did, what it deliberately did not do, and the founder's ordered
next steps. The bottleneck from here is **distribution, not more features.**

---

## 1. What changed (8-phase branch chain)

Executed as one branch per phase, each green (tests + build + lint) at its
boundary. `phase-8-final` contains everything; branch chain:
`phase-1-audit → phase-2-structure → phase-4-hardening → phase-3-purge →
phase-5-product → phase-6-landing → phase-7-docs → phase-8-final`.

| Phase | Branch | What |
|---|---|---|
| 1 | `phase-1-audit` | Read-only audit → `docs/AUDIT_REPORT.md` |
| 2 | `phase-2-structure` | `app/lib/components` → `src/` with `src/modules/*` domain modules, `src/lib` cross-cutting; `@/*`→`src/*`; webhook/webhooks footgun resolved. `docs/ARCHITECTURE.md`. Pure moves. |
| 4 | `phase-4-hardening` | Fixed H1 (agent-profile role gate) + M1 (stats scoping) + **6 findings from a 23-agent adversarial security re-audit**: HIGH billing payment-integrity (plan now bound to the paid Razorpay order, not client input), SSRF guard on outbound webhooks, open-redirect guards, whatsapp template-status tenant isolation, campaign-edit/export/integrations role gates, timing-safe compares, `x-real-ip` rate-limit keying. **+23 regression tests.** `docs/SECURITY.md`. |
| 3 | `phase-3-purge` | depcheck/ts-prune-verified dead-code removal. `docs/CHANGELOG_CLEANUP.md`. |
| 5 | `phase-5-product` | **The moat.** Google Calendar booking (`src/modules/calendar`, sim\|live driver split); Revenue-Recovery follow-up engine (`src/modules/followup` — T-24h/T-2h reminders, no-show rebook, post-service review, quiet-lead nudge, all consent+template gated); concierge onboarding (`src/modules/concierge`); **AI Front Desk flagship tier** (₹14,999) + MYR + the `checkAiFrontDesk` gate. All demoable in `SEND_MODE=simulation`. |
| 6 | `phase-6-landing` | Landing rebuilt around the AI-employee USP: animated agent conversation, Meta-vs-Nudge comparison, salary calculator, reseller CTA, flagship-first pricing. **Dep-free (no 3D lib), reduced-motion-safe, JS budget respected.** |
| 7 | `phase-7-docs` | `AGENTS.md`/`CLAUDE.md` carry the strategy + 7 invariants + architecture rules; `docs/STRATEGY.md`; README, DEMO_SCRIPT, DEPLOYMENT refreshed; persistent memory of the pivot. |
| 8 | `phase-8-final` | This sweep: full green, static mobile-overflow check, and a **final 13-agent adversarial verification of the new code that surfaced 9 real issues — all fixed**: the HIGH simulation-demo-blocker (the demo org is now seeded onto the flagship + a simulated calendar + Revenue-Recovery pack + demo bookings, so the moat demos keyless), OAuth `state`-nonce CSRF + graceful token-exchange failure, the reminder double-fire / "tomorrow" copy bug (T-24h query now excludes the <2h window), a runtime flagship re-check in `bookAppointment` + the reminder tick, and two landing nits (dead `#photo` anchor, duplicate `id="salary"`). This handover. |

**Final status:** 341 unit tests pass (41 files), `next build` + `eslint` +
`tsc --noEmit` all clean. `npm audit` (prod): 2 moderate (transitive PostCSS via
`next`) — triaged/accepted in `docs/SECURITY.md` (not reachable in our usage).

**7 invariants intact** — each has a direct test: consent (`tests/consent`,
`tests/billing-confirm` for payment integrity), 24h window (`tests/agent`),
STOP (`tests/webhook-verify`), Haiku guard (`tests/model-guard`), tenant
isolation (`tests/org-scope`, `tests/agent-profile-auth`), plan/flagship gate
(`tests/plan-limits`, `tests/followup-pack`), agent loop cap (`tests/agent-loop-cap`).

## 2. Deliberately NOT done (scope boundaries)

- **No Meta Business verification / App Review / real account setup.** That is
  human paperwork — the runbook (`docs/GO_LIVE_WHATSAPP.md`) is made accurate for
  the founder to execute.
- **No 3D dependency** (R3F/Three.js) on the landing — the perf/JS budget and the
  "no unapproved deps" rule won; the immersive feel is CSS/motion. If you later
  want true 3D, it's a scoped add-behind-lazy-load.
- **`googleapis` SDK not added** — the calendar integration uses the Google REST
  API via `fetch` directly (no new dependency). Live OAuth needs a real Google
  Cloud OAuth client; simulation needs nothing.
- **CRM tool tiers, `gtm/`, simulation drivers, docs — all preserved** (never
  deleted, per the invariants).
- **No live browser/mobile QA screenshot pass** in this environment (the browser
  extension wasn't connected). New surfaces were statically verified overflow-safe
  (the one wide element, the comparison table, is wrapped in `overflow-x-auto`);
  a live pass across routes × breakpoints is a recommended pre-launch check — the
  existing automated sweep in `docs/MOBILE_QA.md` can be re-run.

## 3. Known limitations / honest follow-ups

- **Natural-language time parsing** (`src/modules/calendar/when.ts`) covers the
  phrasings customers actually use ("tomorrow 8pm", "Sat 1pm", ISO); anything it
  can't resolve falls back cleanly to a staff hand-off. Timezone handling uses the
  server's local calendar — fine for the demo, worth pinning to the org timezone
  before heavy live use.
- **No-show detection is staff-triggered** — a booking is marked `no_show` by
  staff; the tick then chases the rebook. Automatic no-show inference isn't done
  (it would be presumptuous without an attendance signal).
- **Follow-up recovery attribution** is honest counting (bookings + follow-ups
  sent this month), not inflated "revenue recovered" — by design.
- **Rate limiting is per-instance** (documented in `docs/SECURITY.md`); a shared
  store (Upstash/Redis) is the upgrade path.
- **Legal docs** (`/privacy`, `/terms`) still carry `[Legal Entity Name]` /
  `[registered address]` / `[jurisdiction]` placeholders — see the TODO.

## 4. Founder's ordered TODO

Do these in order. Feature work is NOT the bottleneck — distribution is.

0. **Migrate the new tables:** `npm run db:push` then `npm run db:rls` (adds
   `CalendarAccount`, `FollowUpConfig`, new `BookingRequest` fields — they ship
   with RLS off until `db:rls` runs). Re-run both after any future schema change.
1. **Meta Business account setup** per `docs/GO_LIVE_WHATSAPP.md` — Business
   Manager, WhatsApp product, phone number, tokens, webhook verification. This is
   human paperwork; the runbook is executable as written.
2. **Production deploy** per `docs/DEPLOYMENT.md` — push the env vars (set
   `CRON_SECRET`; optionally `GOOGLE_*` for live calendar OAuth), `db:push`+`db:rls`
   against production, `npx vercel --prod`. Keep `SEND_MODE=simulation` until Meta
   approval, then flip to `live`.
3. **Fill the legal-entity placeholders** in `/privacy` and `/terms`
   (`[Legal Entity Name]`, address, jurisdiction).
4. **Go sell to 10 clinics/salons.** Founder-led, one vertical, the AI Front Desk
   flagship — use `docs/DEMO_SCRIPT.md` (climaxes on the agent booking a real slot
   + follow-ups firing + the salary math). Then open the reseller channel.

## 5. Merging this work

Each phase is its own branch off the previous; `phase-8-final` is the tip with
everything. Merge `phase-8-final` → `main` (or open a PR) once reviewed. The
phase branches give clean, reviewable per-phase diffs if you prefer to land them
incrementally.
