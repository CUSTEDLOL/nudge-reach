# Remaining work — handoff, 2026-09-23

Everything below is live on `main` and deployed unless stated. Baseline commit:
`5153f06`. Full gate at handoff: **2,199 tests passing**, `tsc --noEmit`, ESLint
and `next build` all exit 0.

Read `AGENTS.md` first — the 7 protected invariants and the "minimum viable
change / surgical edits" discipline apply to every task here.

---

## Ground rules for whoever picks this up

1. **Verify before you claim.** Several bugs in this area shipped *because a
   mocked unit test passed*. Two concrete examples, both fixed today:
   - `pg_advisory_xact_lock()` returns `void`; `$queryRaw` cannot deserialize it.
     Every test mocked Prisma and returned `[{ locked: null }]`, so the suite was
     green while **every trial website import was broken in production**.
   - `provisionTrialAccount` stamped a row via `prisma.acquisitionTrial.updateMany`,
     but the test mock only defined `findFirst`. The call threw, its own
     `try/catch` swallowed it, and the tests passed while the stamp never ran.

   When a change touches raw SQL, a Prisma client shape, or a concurrency path,
   **run it against the real database** (`npx tsx --env-file=.env.local <script>`;
   `.env.local` points at the production Supabase project — read freely, write
   only deliberately and clean up after yourself).

   **You cannot see a signed-in page.** The test account in
   `scripts/fetch-as-user.js` (`visheshjain1705+nudgetest@gmail.com`) does not
   exist on that Supabase project — it fails `Invalid login credentials` — and
   there is no service-role key in `.env.local` to mint a session with. The only
   rows in `auth.users` are real people's, which are not yours to sign in as.
   Playwright 1.63 and Chromium are installed and working, so the tooling is
   fine; only the login is missing. Practical consequences: `curl` on an app
   route gives you 307 (the redirect), which proves the route *compiles* and
   nothing more — it is **not** evidence the page renders. Don't claim a UI
   works because you got a 307. Either ask the founder to re-create the test
   user, or say plainly that the page is founder-verified only.

2. **This repo is shared with other Claude sessions and many git worktrees**
   (`git worktree list`). Before committing: `git fetch origin` and check
   `git rev-list --left-right --count origin/main...HEAD`. Before building
   something that "looks missing", check whether another branch already has it —
   that mistake cost a whole cycle today.

3. **Deploys are `git push origin main`** → Vercel auto-deploys production.
   A build takes ~2–3 minutes. "Pushed" is not "live": confirm with
   `npx vercel ls --prod` until the newest row reads `Ready`, then check
   `npx vercel inspect https://nudgeagent.app` points at it.

4. **Schema changes use `npm run db:push`** (there is no migrations directory).
   Always preview first:
   `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`.
   Push the schema **before** deploying code that reads it. Confirm the diff is
   additive; this project has no migration rollback.

---

## 1. Trial users cannot pay without booking a call — HIGHEST VALUE

**The problem.** `/settings/billing` is an allowed trial route
(`src/modules/trial/routes.ts` → `TRIAL_WORKSPACE_PATHS`), but **Settings is
rendered as locked in the trial sidebar**, so there is no link to it. The only
conversion paths in the trial are "Book a demo" and `/pricing`. A trial user who
has decided to buy has no self-serve way to do it.

**Where.** `src/components/features/app-shell/nav.ts` —
`TRIAL_OPEN_KEYS = ["today", "inbox", "front-desk"]` decides what is Open;
everything else in the standard rail is locked by `lockedNavGroupsForMode`.

**What to do.** Give the trial a real route to billing. Options, in preference
order:
- A dedicated "Upgrade" / "Billing" entry in the **Open** group pointing at
  `/settings/billing`. Cleanest — it is already an allowed path.
- Or make the locked **Settings** row's upgrade dialog link to
  `/settings/billing` rather than only offering the demo.

**Constraints.** `tests/app-shell-nav.test.ts` asserts the trial exposes exactly
two navigating destinations (`/dashboard`, `/agent`) and that no locked item's
href passes `isTrialWorkspacePath`. If you add a third Open destination, update
those assertions **deliberately** and keep the rule that locked rows never
navigate.

**Done when.** A trial user can reach billing from the sidebar, `/settings/billing`
renders for a trial org, and the locked shelf still never offers a route the
guard would bounce.

---

## 2. Three demo-CTA placements, already scoped and declined once

The founder asked for demo CTAs "in a lot more places"; only the persistent
trial-header CTA was built (`src/components/features/trial/trial-status-strip.tsx`
— secondary while the trial is active, primary once exhausted/expired). The
other three were scoped and left:

- **After each successful AI reply in the test inbox.** The highest-intent
  moment in the whole trial: they just watched it work. See
  `src/components/features/trial/test-conversation.tsx` / `try-your-ai.tsx`.
- **On every locked/paid feature card** — direct "Book a demo" + "See plans"
  instead of only a lock. See `src/components/features/trial/locked-feature-card.tsx`
  (already renders `UpgradeDialog`; this is about surfacing the actions inline).
- **Marketing pages** — sticky mobile CTA bar on `/free-trial` and `/pricing`,
  mid-page CTAs on long pages.

Reuse `BookDemoButton` (`src/components/marketing/book-demo.tsx`). Note
`tests/free-trial-page.test.ts` asserts exactly **one** `data-cal-link` inside
`<main>` on `/free-trial` — adding a sticky bar there means updating that
assertion on purpose, not by accident.

---

## 3. Locked sidebar shelf is desktop-only

`lockedNavGroupsForMode` is consumed only by `sidebar.tsx`. The mobile bottom
nav (`bottom-nav.tsx`) still shows the two Open tabs and no lock list. Decide
whether mobile should show the locked shelf too — ad traffic is mostly mobile,
so the "here is everything you'd unlock" argument is arguably *more* important
there.

**Critical constraint.** The locked shelf is deliberately **not** part of
`navGroupsForMode`, because that feeds the command menu (⌘K) and the mobile
"More" sheet — surfaces that must only ever offer routes that actually open.
`tests/app-shell-nav.test.ts` asserts locked items never leak into
`navItemsForMode`, `commandsForMode` or `mobilePrimaryItemsForMode`. Keep that
property; render the shelf separately, as the sidebar does.

---

## 4. Eleven deferred items inside House Rules

House Rules shipped today (merged from `feat/house-rules`, commit `504459a`).
That session documented what it knowingly left undone in
**`docs/plans/2026-09-22-house-rules.md` → "Deferred — knowingly left undone"**.
Read it in full. The three worth doing first:

1. **Legacy columns still reach the prompt — do this one first.**
   `migrateProfileToRules` copies the old Setup boxes into rules and draft
   facts but deliberately does **not** clear `AgentProfile.businessInfo` or
   `.doNots`, and `prompt.ts` still renders both (`ADDITIONAL BUSINESS
   INFORMATION:` at line ~205, `- Also avoid: …` at ~241). So every migrated
   org sends that content **twice**, and an edit to the rule leaves the stale
   original in place underneath it. Setup is retired, so there is no longer any
   UI to view or clear those columns.

   It was left deliberately for one release, as a net: an org whose migration
   failed (an un-pushed `AgentRule` table, say) would still have its business
   information in the prompt. That net has served its purpose — the table is
   live in production with RLS on, and `migrateProfileOnce` runs on every
   `/agent` load. **The follow-up is to stop reading both columns, confirm
   against real orgs that nothing was lost, and only then drop them.** Do not
   drop and stop-reading in one change; there is no migration rollback.
2. **TOCTOU race on the rule cap.** `createRuleAction` counts active rules and
   then creates one; two interleaved requests can exceed the cap. This is the
   *same class of bug* as the login-500 fixed today in `resolveOrgContext` —
   check-then-act without a guarded write. Fix by repeating the guard in the
   write's `WHERE`, or a unique/partial index, not by widening a transaction.
   Contained meanwhile: every read path takes `limit`, so the prompt still
   carries at most 20 and the extra row is invisible to the AI.
3. **The distiller guardrail (`introducesNewSpecifics`) is one-directional.**
   It catches a specific the distillation *invented*, but compares digits only —
   **word-priced and worded facts are invisible to it** ("twenty rupees").
   Invariant-adjacent: a wrong price inside an instruction reaches customers.
   It also never catches a constraint the distillation *dropped*: "consults are
   ₹500 before 6pm" → "tell them consults are ₹500" passes clean.

---

## 4a. The Training page redesign (same session, after the merge)

`/agent` was rebuilt twice on the founder's direct feedback — first for
hierarchy, then for density. Shipped and live. What a later session should know:

- **Layout.** Two columns from `lg` (`grid-cols-[minmax(0,1fr)_340px]`). The
  rail is **first in the DOM** and `lg:order-last`, so on a phone the import box
  sits above the facts instead of below all 92 of them. Left column: House rules,
  then What it knows. Rail: Your business, then the import panel.
- **Section headers sit outside their boxes** (`section-header.tsx`,
  `text-base`) — the only place that size appears, and the whole hierarchy fix.
  Sub-headings inside boxes stay `text-sm font-semibold`. Don't add a third size.
- **One tinted element on the page**, the "N questions are waiting for you"
  band, and only when non-empty. Keep it that way; it is what draws the eye.
- **Forms collapse behind a button** (rules and facts both), open by default
  only when the list is empty. Mirrors `AddRuleForm`; copy that shape.
- **The trial and paid pages are the same page.** `trial-training.tsx` is the
  body only — `/agent/page.tsx` owns the header slot, the grid and the rail.
  `TrialTrainingHeader` is a separate export for exactly that reason; folding it
  back into the body breaks the page's import. That collision already happened
  once (`cf35a6e`).
- **`data-tour="training-source"` must appear exactly once** — the tour looks it
  up with a single-element query. It lives on the trial's library block, and
  `tests/trial-training.test.tsx` counts it (1 there, 0 in `page.tsx`).

**Still open here:**

- **The trial's rail is nearly empty.** It gets Your business, but its own
  sources (`TrialKnowledgeSources` + `TrialDraftReview`) stay in the left column,
  where the paid page puts the import panel in the rail. Moving
  `TrialKnowledgeSources` into the rail would finish the symmetry the founder
  asked for; `TrialDraftReview` probably wants the width and should stay left.
  Not done because it restructures a component another session had just shipped.
- **The library's "Add fact" form is shared with the trial**, which is why only
  its open/closed state was touched and not its contents.

---

## 4b. Fixed here, so nobody re-derives it

**The collapsed sidebar hid Voice and Actions entirely.** Three things lined up:
the rail renders its second level only when expanded (`sidebar.tsx`,
`!collapsed && item.children`), the Front Desk tab strip is `lg:hidden` (added
when the redesign found it duplicating the rail on desktop), and `commandsForRole`
mapped only top-level nav items — so ⌘K never offered the children either. With
the sidebar collapsed on a desktop, Voice and Actions were reachable by typed URL
alone, and the collapse is **persisted server-side** (`saveSidebarCollapsedAction`),
so it stayed broken across sessions.

Fixed by flattening nav children into `commandsForRole`, deduped against the
parent's href (Training *is* `/agent`). **Deliberately not applied to
`commandsForMode`'s trial branch** — Front Desk is open in the trial but Voice
and Actions are not trial paths, so flattening there would offer a route the
server guard bounces. Both properties are now asserted in
`tests/app-shell-nav.test.ts`.

---

## 5. Tidy-up

- **Untracked build artifacts** in the working tree: `output/docx/` and
  `output/pdf/Nudge_Enterprise_AI_Front_Desk_Proposal.pdf`. These are generated;
  add a `.gitignore` entry rather than committing them.
- **Stale remote branches**, both superseded and ~3 weeks old:
  `origin/landing-comparison-redesign` (+19, last commit 2026-09-05) and
  `origin/ws3-vertical-packs` (+2, 2026-09-04). Confirm with the founder, then
  delete.
- **`docs/internal-pricing-economics`** is +5 unmerged, docs-only. Merge or drop.
- ~~**`setup-actions.ts` outlived the page it was named for**~~ — **DONE**
  (`11bf7d0`): it is `src/app/(app)/agent/profile-actions.ts` now, holding the
  Training page's profile writer and the auto-reply switch.

---

## 6. Known-good context you should not re-derive

- **The trial's guided tour is gated on `setupComplete`**
  (`org.onboardedAt != null`). A brand-new trial sees no overlay until it
  finishes `/trial/setup`. That is deliberate — the tour's spotlights target
  knowledge UI that does not exist before setup. `tests/trial-tour.test.ts`
  asserts every tour step's `data-tour` target exists in the markup and every
  step's route has a page, because a target was silently lost in a nav refactor
  and the step degraded to a permanent "This area is still loading".
- **Trial route enforcement is server-side** in `src/app/(app)/layout.tsx` via
  `isTrialWorkspacePath` / `trialWorkspaceRedirect` → `/dashboard?upgrade=<key>`.
  The locked sidebar is presentation only; the guard is the real boundary.
- **An unfinished trial intake can be taken over** by a later signup when it has
  no workspace, no claim and no `accountProvisionedAt`
  (`src/modules/trial/signup.ts`). Claimed or account-bound rows are never
  replaced — that would strand the Supabase user carrying the trial id/token in
  its auth metadata.
- **`/dashboard?upgrade=` renders a plain notice with no CTA**
  (`trial-inbox.tsx`). That is a conversion gap worth a look while doing task 2.
