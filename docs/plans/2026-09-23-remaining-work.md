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

1. **TOCTOU race on the rule cap.** `createRuleAction` counts active rules and
   then creates one; two interleaved requests can exceed the cap. This is the
   *same class of bug* as the login-500 fixed today in `resolveOrgContext` —
   check-then-act without a guarded write. Fix by repeating the guard in the
   write's `WHERE`, or a unique/partial index, not by widening a transaction.
2. **The distiller guardrail (`introducesNewSpecifics`) is one-directional.**
   It catches a specific the distillation *invented*, but compares digits only —
   **word-priced and worded facts are invisible to it** ("twenty rupees").
   Invariant-adjacent: a wrong price inside an instruction reaches customers.
3. **Legacy columns still reach the prompt.** `migrateProfileToRules` moves the
   old business-info box into rules and draft facts, but the legacy
   `AgentProfile` columns are still read when building the prompt — so migrated
   orgs can get the same content twice, and stale content after an edit.

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
- **`setup-actions.ts` outlived the page it was named for** (Setup was retired
  when House Rules landed). It now holds the auto-reply switch — rename/move it
  so the filename stops lying. Listed in the House Rules deferred section.

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
