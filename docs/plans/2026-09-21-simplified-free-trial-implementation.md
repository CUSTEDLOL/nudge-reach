# Simplified Free Trial Implementation Plan

> **For Codex:** execute this plan with test-driven development and the
> subagent-driven-development workflow. Keep each commit green and do not alter
> the paid workspace navigation or dashboard.

**Goal:** Replace the decorative free-trial funnel and four-page mini-dashboard
with a quiet, high-converting landing page and a bounded two-page trial: Inbox
and Train AI.

**Architecture:** Keep acquisition-trial behavior in `src/modules/trial`, reuse
the existing knowledge ingestion and private test conversation, and expose the
trial through purpose-built feature compositions. Add two atomic import counters
to `AcquisitionTrial`; enforce the 50 active-plus-draft fact limit through one
org-locked storage doorway. `/dashboard` is the canonical trial Inbox while the
paid `/dashboard` remains unchanged.

**Tech stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma +
Postgres, Vitest, Supabase Auth, `unpdf` for bounded keyless PDF text extraction.

**Approved design:**
`docs/plans/2026-09-21-simplified-free-trial-design.md`

---

## Task 1: Lock and build the quiet-split landing page

**Files:**

- Modify: `tests/free-trial-page.test.ts`
- Modify: `tests/marketing-analytics.test.ts`
- Modify: `src/app/free-trial/page.tsx`
- Modify: `src/app/free-trial/trial-signup-form.tsx`
- Modify: `src/components/marketing/free-trial-sections.tsx`
- Modify: `src/components/marketing/book-demo.tsx`

### Step 1: Write the failing semantic contract

In `tests/free-trial-page.test.ts`, assert:

- one `<h1>`, one signup `<form>`, and one submit button;
- the approved headline, the 7-day/15-reply/no-card boundary, no live WhatsApp
  connection, the paid AI Front Desk outcome, Sign in, Privacy, Terms, and one
  demo action;
- absence of the old labels and mockup copy: `A safe, guided trial`,
  `START FREE`, `Aster Clinic AI`, `Inside your trial`, `TRAIN AI`, and
  `Explore`;
- the signup field names, consent, honeypot, live region, metadata, payload,
  and secure Supabase handoff remain intact.

In `tests/marketing-analytics.test.ts`, add `free-trial` to the known demo CTA
surface cases.

Run:

```bash
npx vitest run tests/free-trial-page.test.ts tests/marketing-analytics.test.ts
```

Expected: FAIL on the new hierarchy/removal/surface assertions.

### Step 2: Replace the route chrome

In `src/app/free-trial/page.tsx`:

- remove `Navbar`, `Footer`, and all decorative Lucide imports;
- render a small white header with `Logo`, `Container`, and a `/login` link;
- render a responsive split hero: copy on the left and the form on the right,
  separated by whitespace/a fine rule, never a floating card;
- use the approved headline: `A front desk that answers before the lead goes
  cold.`;
- state the trial boundary in plain text, not pills;
- render a minimal legal footer with Privacy, Terms, and contact links.

Keep the existing metadata contract unless a test demonstrates a factual copy
mismatch.

### Step 3: Simplify the form skin only

In `trial-signup-form.tsx`:

- keep `update`, `fail`, `submit`, attribution, retry, validation, Supabase
  signup, and confirmation behavior unchanged;
- remove `ArrowRight`, `Check`, and `LockKeyhole`;
- keep only the functional loading spinner;
- use a flat green button with no hard shadow or translation;
- change the CTA text to `Create my workspace`;
- use restrained input radii and a plain email-confirmation state.

### Step 4: Collapse the supporting sections

In `free-trial-sections.tsx`, keep the component boundary but replace the fake
dashboard, icon cards, dark grid, accordion, and repeated CTA band with:

1. three plain text steps: Train, Test, Go live;
2. three text rows describing the paid outcome: real actions, compliant
   follow-up, done-for-you setup;
3. three always-visible FAQ entries using `<dl>`;
4. one understated `BookDemoButton` using `surface="free-trial"`.

Add `free-trial` to `SAFE_SURFACES` in `book-demo.tsx`.

### Step 5: Verify and commit

```bash
npx vitest run tests/free-trial-page.test.ts tests/trial-signup.test.ts tests/marketing-analytics.test.ts tests/proxy-session.test.ts tests/seo-registry.test.ts
git add tests/free-trial-page.test.ts tests/marketing-analytics.test.ts src/app/free-trial/page.tsx src/app/free-trial/trial-signup-form.tsx src/components/marketing/free-trial-sections.tsx src/components/marketing/book-demo.tsx
git commit -m "feat(trial): simplify free trial landing"
```

---

## Task 2: Reduce the authenticated trial to two destinations

**Files:**

- Modify: `tests/app-shell-nav.test.ts`
- Modify: `tests/trial-routes.test.ts`
- Modify: `tests/trial-shell.test.ts`
- Modify: `src/components/features/app-shell/nav.ts`
- Modify: `src/components/features/app-shell/bottom-nav.tsx`
- Modify: `src/components/features/app-shell/topbar.tsx`
- Modify: `src/modules/trial/routes.ts`
- Modify: `src/app/(app)/layout.tsx`

### Step 1: Write the failing navigation and route tests

Require exactly these trial navigation items and commands, in order:

```ts
[
  ["Inbox", "/dashboard"],
  ["Train AI", "/agent"],
]
```

Also require:

- exactly two mobile destinations and a two-column mobile grid;
- no Home, Test Inbox duplicate, Explore, paid nav, or trial command search;
- allowed trial routes are `/dashboard`, `/agent`, `/inbox/try`,
  `/trial/setup`, and `/settings/billing`; trial thread routes and `/explore`
  are no longer allowed;
- `trialWorkspaceRedirect("/explore")` and paid-only paths return a sanitized
  `/dashboard?upgrade=<segment>` destination, never `/explore`.

Run the three focused test files and confirm failure.

### Step 2: Implement the two-item shell

- Replace `TRIAL_NAV_ITEMS` with Inbox (`/dashboard`) and Train AI (`/agent`).
- Use `Inbox` and `BookOpen` icons; do not use a robot icon for the trial rail.
- Make the mobile grid column count match the number of primary items.
- Do not render `CommandMenu` from `Topbar` in trial mode.
- Keep standard/paid navigation byte-for-byte behaviorally unchanged.

### Step 3: Replace the Explore fallback

Rename `trialExploreRedirect` to `trialWorkspaceRedirect` and return:

```ts
`/dashboard?upgrade=${encodeURIComponent(segment)}`
```

Update the authenticated layout to use the new helper. Keep billing available
as a conversion utility.

### Step 4: Verify and commit

```bash
npx vitest run tests/app-shell-nav.test.ts tests/trial-routes.test.ts tests/trial-shell.test.ts
git add tests/app-shell-nav.test.ts tests/trial-routes.test.ts tests/trial-shell.test.ts src/components/features/app-shell/nav.ts src/components/features/app-shell/bottom-nav.tsx src/components/features/app-shell/topbar.tsx src/modules/trial/routes.ts 'src/app/(app)/layout.tsx'
git commit -m "feat(trial): reduce workspace navigation to two pages"
```

---

## Task 3: Make `/dashboard` the canonical private Inbox

**Files:**

- Modify: `tests/dashboard-page-contract.test.ts`
- Modify: `tests/trial-test-inbox.test.ts`
- Modify: `tests/trial-read-only-thread.test.ts`
- Add: `tests/trial-inbox-page.test.tsx`
- Add: `src/components/features/trial/trial-inbox.tsx`
- Move: `src/app/(app)/inbox/try/try-your-ai.tsx` →
  `src/components/features/trial/try-your-ai.tsx`
- Modify: `src/components/features/trial/test-conversation.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/inbox/try/page.tsx`
- Modify: `src/app/(app)/inbox/actions.ts`
- Modify: `src/modules/trial/workspace.ts`

### Step 1: Write the failing Inbox routing contract

Tests must prove:

- an active trial never calls/render paid analytics from `/dashboard`;
- active trials may reach `/dashboard` before knowledge is ready;
- `/inbox/try` redirects active trials to `/dashboard` but remains the paid
  `Try your AI` page for normal workspaces;
- the trial Inbox shows a Train AI empty state when there are no approved
  facts;
- the shared-inbox-preview link is absent, so the trial stays within two
  pages;
- `simulateInboundAction` revalidates `/dashboard` as well as the shared inbox.

### Step 2: Extract the reusable trial chat client

Move `TryYourAi` into `src/components/features/trial/try-your-ai.tsx` without
changing the reducer, optimistic state, reply-meter reconciliation, keyboard
handling, or error recovery. Update imports and source-contract tests.

### Step 3: Compose the canonical trial Inbox

Create `TrialInbox` as an async server feature composition. It receives the org
and `TrialWorkspace`, loads only the trial conversation/profile data, and
renders:

- an `Inbox` heading;
- a knowledge-empty state linking to `/agent`, or the existing private test
  conversation and composer;
- one restrained conversion line: `Connect your real WhatsApp — Book a free
  demo · View plans`;
- an optional upgrade notice when `searchParams.upgrade` is present.

In `dashboard/page.tsx`, branch to `TrialInbox` before any paid dashboard query.
Keep the paid hierarchy and all paid imports/behavior unchanged.

### Step 4: Make aliases safe

- Make the active-trial branch of `/inbox/try` redirect to `/dashboard`.
- Remove `Open in shared inbox` from `TestConversation`.
- Remove trial thread paths from the allowlist so legacy trial thread URLs
  redirect to `/dashboard`.
- Change `dashboardRedirectFor()` so an active trial returns `null`; preserve
  normal `/onboarding` behavior.

### Step 5: Verify and commit

```bash
npx vitest run tests/dashboard-page-contract.test.ts tests/trial-test-inbox.test.ts tests/trial-read-only-thread.test.ts tests/trial-inbox-page.test.tsx tests/inbox.test.ts
git add tests/dashboard-page-contract.test.ts tests/trial-test-inbox.test.ts tests/trial-read-only-thread.test.ts tests/trial-inbox-page.test.tsx src/components/features/trial/trial-inbox.tsx src/components/features/trial/try-your-ai.tsx src/components/features/trial/test-conversation.tsx 'src/app/(app)/dashboard/page.tsx' 'src/app/(app)/inbox/try/page.tsx' 'src/app/(app)/inbox/actions.ts' src/modules/trial/workspace.ts
git commit -m "feat(trial): make inbox the default workspace"
```

---

## Task 4: Replace the blocking tour with quiet inline guidance

**Files:**

- Modify: `tests/trial-shell.test.ts`
- Replace: `tests/trial-tour.test.ts`
- Modify: `src/components/features/trial/trial-status-strip.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`

### Step 1: Write the failing guide test

Assert that the compact status area:

- shows the authoritative reply/time allowance;
- has a native, closed-by-default `How to use this trial` disclosure;
- contains only three steps: add information, ask a customer question, review
  the reply;
- can be closed and reopened without a modal, overlay, forced route change, or
  focus trap;
- contains no automatic `TrialTour` mount.

### Step 2: Implement the inline guide

Remove `TrialTour` and `shouldShowTrialTour` from `AppShell`. In
`TrialStatusStrip`, remove the decorative flask medallion and add a native
`<details>` guide beside/below the plain usage text. Keep the exhausted/expired
demo and pricing actions.

Leave persisted legacy tour fields in the database for compatibility; do not
perform a destructive migration in this change.

### Step 3: Verify and commit

```bash
npx vitest run tests/trial-shell.test.ts tests/trial-tour.test.ts
git add tests/trial-shell.test.ts tests/trial-tour.test.ts src/components/features/trial/trial-status-strip.tsx src/components/features/app-shell/shell.tsx
git commit -m "feat(trial): replace overlay tour with inline guide"
```

---

## Task 5: Add bounded import counters and workspace projections

**Files:**

- Modify: `prisma/schema.prisma`
- Add: `scripts/backfill-trial-knowledge-limits.ts`
- Modify: `package.json`
- Modify: `tests/trial-workspace.test.ts`
- Modify: `src/modules/trial/workspace.ts`

### Step 1: Write the failing workspace projection tests

Add expectations for:

```ts
{
  approvedFactCount: 12,
  draftFactCount: 5,
  factCount: 17,
  factLimit: 50,
  webImportsUsed: 1,
  webImportLimit: 1,
  fileImportsUsed: 2,
  fileImportLimit: 3,
}
```

Archived entries must not count.

### Step 2: Add additive schema fields

Add to `AcquisitionTrial`:

```prisma
knowledgeWebImportsUsed  Int @default(0)
knowledgeFileImportsUsed Int @default(0)
```

Keep `knowledgeSource` and `knowledgeSourceUsedAt` as first-success attribution.
Run `npx prisma generate`.

### Step 3: Add an idempotent backfill

Create `scripts/backfill-trial-knowledge-limits.ts` to set the appropriate
counter to at least one for successful legacy website/GBP/file trials. Add a
bounded npm script using the repo's existing esbuild + Prisma pattern. Do not
touch rows without a successful legacy source.

### Step 4: Extend the server-safe workspace projection

Count active and draft facts separately and expose the limits above. Clamp
visible remaining values at zero. Preserve `knowledgeCount` temporarily as an
alias of `approvedFactCount` to avoid unrelated churn.

### Step 5: Verify and commit

```bash
npx prisma generate
npx vitest run tests/trial-workspace.test.ts
git add prisma/schema.prisma scripts/backfill-trial-knowledge-limits.ts package.json package-lock.json tests/trial-workspace.test.ts src/modules/trial/workspace.ts
git commit -m "feat(trial): add bounded knowledge allowances"
```

---

## Task 6: Enforce the 50-fact boundary through one storage doorway

**Files:**

- Add: `tests/knowledge-store.test.ts`
- Add: `src/modules/knowledge/store.ts`
- Modify: `tests/knowledge-ingest.test.ts`
- Modify: `src/modules/knowledge/ingest.ts`
- Modify: `src/app/(app)/agent/training-actions.ts`

### Step 1: Write failing store tests

Cover:

- active + draft facts count toward 50;
- archived facts do not count;
- only the remaining slots are inserted;
- duplicate normalized facts are skipped;
- imported and manual writes share the same cap;
- the org id scopes the count, dedupe, advisory lock, and inserts;
- paid calls without `activeDraftCap` keep their existing capacity.

### Step 2: Implement `storeKnowledgeFacts`

Create a single helper with this shape:

```ts
storeKnowledgeFacts(orgId, facts, {
  source,
  status,
  activeDraftCap,
}) => { created, capacityReached }
```

When a cap is present, use a short Prisma transaction and a Postgres
transaction-level advisory lock derived from the parameterized org id before
counting, deduping, and inserting. Never interpolate raw org ids into SQL.

### Step 3: Route all relevant writes through it

- Replace the private `storeDraftFacts` loop in `knowledge/ingest.ts`.
- Add `activeDraftCap?: number` to `IngestBudget`.
- For restricted acquisition trials, call `addFactAction` through the same
  helper with cap 50; return a clear limit message when nothing can be added.
- Keep paid/manual update/archive behavior unchanged.

### Step 4: Verify and commit

```bash
npx vitest run tests/knowledge-store.test.ts tests/knowledge-ingest.test.ts tests/trial-training-actions.test.ts
git add tests/knowledge-store.test.ts tests/knowledge-ingest.test.ts src/modules/knowledge/store.ts src/modules/knowledge/ingest.ts 'src/app/(app)/agent/training-actions.ts'
git commit -m "feat(trial): enforce shared fact limit"
```

---

## Task 7: Replace the one-source lock with atomic 1+3 import quotas

**Files:**

- Modify: `tests/trial-knowledge.test.ts`
- Modify: `tests/trial-training-actions.test.ts`
- Modify: `src/modules/trial/knowledge.ts`
- Modify: `src/app/(app)/agent/training-actions.ts`

### Step 1: Write failing quota tests

Test:

- one website or GBP success consumes the shared web allowance;
- a second web/GBP import is rejected;
- three file successes are allowed and a fourth is rejected;
- thrown and zero-draft imports refund their reserved counter;
- two concurrent final-slot reservations cannot both win;
- the first successful source sets legacy attribution once;
- paid, converted, and non-trial work bypass these quotas.

### Step 2: Implement `withTrialKnowledgeImport`

Replace `withTrialKnowledgeSource` with an atomic conditional increment on the
appropriate counter. On errors or unsuccessful results, decrement exactly the
reserved counter. On first success only, stamp `knowledgeSource` and
`knowledgeSourceUsedAt` without overwriting earlier attribution.

Export:

```ts
export const TRIAL_KNOWLEDGE_LIMITS = {
  webImports: 1,
  fileImports: 3,
  facts: 50,
} as const;
```

### Step 3: Wire actions to the new boundary

- Website and GBP use the shared `web` slot.
- Files use the `file` slot.
- Pass the trial crawl/draft/fact caps into ingestion.
- Revalidate `/agent` and `/dashboard` after every successful knowledge
  mutation.

### Step 4: Verify and commit

```bash
npx vitest run tests/trial-knowledge.test.ts tests/trial-training-actions.test.ts
git add tests/trial-knowledge.test.ts tests/trial-training-actions.test.ts src/modules/trial/knowledge.ts 'src/app/(app)/agent/training-actions.ts'
git commit -m "feat(trial): allow bounded multi-source training"
```

---

## Task 8: Make text PDFs work without an AI key

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Add: `tests/fixtures/clinic-rate-card.pdf.base64`
- Add: `tests/knowledge-pdf.test.ts`
- Modify: `tests/knowledge-ingest-file.test.ts`
- Add: `src/modules/knowledge/pdf.ts`
- Modify: `src/modules/knowledge/ingest.ts`

### Step 1: Install the bounded parser

```bash
npm install unpdf
```

Use the package's bundled serverless PDF.js build. The official project
documents Node and serverless support plus `getDocumentProxy`/`extractText`:
<https://github.com/unjs/unpdf>.

### Step 2: Write failing deterministic PDF tests

Use a small local base64 fixture. Test:

- text extraction is capped by page and character limits;
- literal service/price/hour lines become draft facts without invention;
- a scanned/no-text document returns an honest error;
- keyless PDF ingestion never calls the model router;
- keyless image ingestion returns an honest unsupported/OCR message;
- keyed PDF and image calls retain their existing document/vision shapes.

### Step 3: Implement the keyless path

Create `extractPdfText` and `deterministicDocumentFacts`. Cap processing (for
example 20 pages and 30,000 characters), preserve literal lines, dedupe, and
never synthesize business claims.

In `ingestFile`:

- if a key exists, retain the guarded model-router path;
- without a key, parse text PDFs locally and store bounded drafts;
- without a key, reject images with an honest message.

The free-trial UI will advertise/accept text PDFs only. Paid keyed image
ingestion remains unchanged.

### Step 4: Verify and commit

```bash
npx vitest run tests/knowledge-pdf.test.ts tests/knowledge-ingest-file.test.ts tests/knowledge-ingest.test.ts
npm run build
git add package.json package-lock.json tests/fixtures/clinic-rate-card.pdf.base64 tests/knowledge-pdf.test.ts tests/knowledge-ingest-file.test.ts src/modules/knowledge/pdf.ts src/modules/knowledge/ingest.ts
git commit -m "feat(knowledge): support keyless PDF training"
```

---

## Task 9: Build the continuous Train AI page

**Files:**

- Add: `tests/trial-training.test.tsx`
- Modify: `tests/trial-setup.test.ts`
- Modify: `src/app/(app)/agent/page.tsx`
- Modify: `src/app/(app)/agent/library.tsx`
- Modify: `src/components/features/trial/trial-training.tsx`
- Add: `src/components/features/trial/trial-knowledge-sources.tsx`
- Add: `src/components/features/trial/trial-draft-review.tsx`
- Modify: `src/app/(app)/trial/setup/page.tsx`
- Modify: `src/app/(app)/trial/setup/actions.ts`
- Modify: `src/modules/trial/browser-signup.ts`

### Step 1: Write the failing page contract

Render one trial page containing all of these simultaneously:

- website/Google source with `0/1` or `1/1`;
- multi-select text-PDF upload with `0/3` through `3/3`;
- manual fact form;
- draft review;
- approved fact library;
- plain `Facts n/50` text;
- `Test in Inbox` only after at least one approved fact.

Assert that imports do not replace the source controls or advance to another
route. Assert there are no source-selection cards or three-stage progress
indicator.

### Step 2: Load both fact states

In the trial branch of `agent/page.tsx`, query active and draft entries and pass
them with the full `TrialWorkspace` projection to `TrialTraining`.

### Step 3: Build restrained source and review controls

- `TrialKnowledgeSources`: simple stacked website input, optional Google
  listing disclosure, and `multiple` PDF input. Upload selected PDFs
  sequentially, stopping when the visible remaining file allowance is used.
- `TrialDraftReview`: individual approve/discard plus bulk actions, with inline
  feedback.
- Extend `Library` with optional `factCount`/`factLimit` props so its manual
  form disables honestly at the boundary; paid callers omit these props.
- `TrialTraining`: compose sources, drafts, approved facts, counters, and the
  Inbox action with borders/spacing rather than a grid of cards.

### Step 4: Simplify signup/setup aliases

- Send immediate and confirmed trial signup to `/agent`.
- Make `/trial/setup` a server redirect to `/agent`.
- Keep `completeTrialSetupAction` as a recovery/activation boundary, but route
  successful completion to `/dashboard`.
- Continue allowing imports after setup completion.

### Step 5: Verify and commit

```bash
npx vitest run tests/trial-training.test.tsx tests/trial-setup.test.ts tests/free-trial-page.test.ts tests/trial-training-actions.test.ts
git add tests/trial-training.test.tsx tests/trial-setup.test.ts 'src/app/(app)/agent/page.tsx' 'src/app/(app)/agent/library.tsx' src/components/features/trial/trial-training.tsx src/components/features/trial/trial-knowledge-sources.tsx src/components/features/trial/trial-draft-review.tsx 'src/app/(app)/trial/setup/page.tsx' 'src/app/(app)/trial/setup/actions.ts' src/modules/trial/browser-signup.ts
git commit -m "feat(trial): unify multi-source training"
```

---

## Task 10: Ground and activate the Inbox safely

**Files:**

- Modify: `tests/inbox.test.ts`
- Add: `tests/trial-activation.test.ts`
- Add: `src/modules/trial/activation.ts`
- Modify: `src/app/(app)/agent/training-actions.ts`
- Modify: `src/app/(app)/trial/setup/actions.ts`
- Modify: `src/app/(app)/inbox/actions.ts`

### Step 1: Write the failing safety tests

Require:

- zero approved facts blocks a restricted-trial send before reply reservation
  and before `handleInboundMessage`;
- the response uses `skipped: "no_knowledge"` and links users back to Train AI
  in the interface;
- the first manual fact, approved draft, or bulk approval enables/upserts the
  trial agent and marks the org onboarded;
- tenant and ADMIN checks remain server-side;
- paid knowledge actions are unchanged.

### Step 2: Implement idempotent activation

Create `activateTrialAgentIfGrounded(ctx)` as an idempotent transaction:

1. verify the org still owns an unconverted acquisition trial;
2. count at least one active org-scoped fact;
3. upsert the enabled `AgentProfile`;
4. set `Org.onboardedAt` only when needed.

Call it after successful manual creation, individual approval, bulk approval,
and from `completeTrialSetupAction` for recovery.

### Step 3: Enforce the no-knowledge server boundary

Before `withTrialReplyReservation`, count active facts for a restricted trial.
If zero, return the explicit `no_knowledge` result. Add `/dashboard`
revalidation after successful trial messages.

### Step 4: Verify and commit

```bash
npx vitest run tests/inbox.test.ts tests/trial-activation.test.ts tests/trial-setup.test.ts tests/trial-agent-boundary.test.ts
git add tests/inbox.test.ts tests/trial-activation.test.ts src/modules/trial/activation.ts 'src/app/(app)/agent/training-actions.ts' 'src/app/(app)/trial/setup/actions.ts' 'src/app/(app)/inbox/actions.ts'
git commit -m "fix(trial): require grounded knowledge before replies"
```

---

## Task 11: Retire Explore safely and update conversion redirects

**Files:**

- Modify: `tests/trial-explore.test.ts`
- Modify: `tests/crm-oauth-routes.test.ts`
- Modify: `src/app/(app)/explore/page.tsx`
- Modify: `src/app/api/integrations/crm/[provider]/callback/route.ts`

### Step 1: Write the failing redirect regression

Assert the Explore server route contains only a safe redirect and never imports
or calls exports from `locked-feature-card.tsx`. Assert the restricted CRM
callback no longer points to `/explore`.

### Step 2: Implement compatibility redirects

- Replace Explore rendering with `redirect("/dashboard")`.
- Change the restricted CRM callback fallback to
  `/dashboard?upgrade=crm` for authenticated trial traffic (or `/pricing` when
  there is no app session, preserving the callback's existing auth decision).
- Leave `exploreViewedAt` in the schema; no destructive cleanup is needed.

### Step 3: Verify and commit

```bash
npx vitest run tests/trial-explore.test.ts tests/crm-oauth-routes.test.ts tests/trial-routes.test.ts
git add tests/trial-explore.test.ts tests/crm-oauth-routes.test.ts 'src/app/(app)/explore/page.tsx' 'src/app/api/integrations/crm/[provider]/callback/route.ts'
git commit -m "fix(trial): retire broken explore route"
```

---

## Task 12: Documentation, full verification, schema release, and push

**Files:**

- Modify: `PROGRESS.md`
- Modify only if contradicted:
  `docs/plans/2026-09-20-free-trial-funnel-design.md`

### Step 1: Run focused trial coverage

```bash
npx vitest run tests/free-trial-page.test.ts tests/trial-signup.test.ts tests/marketing-analytics.test.ts tests/app-shell-nav.test.ts tests/trial-routes.test.ts tests/trial-shell.test.ts tests/dashboard-page-contract.test.ts tests/trial-inbox-page.test.tsx tests/trial-workspace.test.ts tests/trial-knowledge.test.ts tests/knowledge-store.test.ts tests/knowledge-pdf.test.ts tests/knowledge-ingest-file.test.ts tests/trial-training-actions.test.ts tests/trial-training.test.tsx tests/trial-setup.test.ts tests/trial-activation.test.ts tests/trial-explore.test.ts tests/inbox.test.ts
```

### Step 2: Run repository gates

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

All commands must finish green with fresh output before completion is claimed.

### Step 3: Visual and interaction verification

Run the app and inspect `/free-trial` at approximately 390, 768, and 1440 px:

- one clear headline and form above the fold;
- no pills, AI decoration, chat mockup, card wall, overflow, or duplicate CTA;
- visible keyboard focus and legible error/busy/email-confirmation states.

In an authenticated acquisition trial, verify:

- only Inbox and Train AI appear on desktop and mobile;
- website then multiple PDFs can be added without leaving Train AI;
- counters and the 50-fact boundary are honest;
- a draft can be approved and immediately used in Inbox;
- no-knowledge, exhausted, and expired states are honest;
- old `/trial/setup`, `/inbox/try`, `/explore`, and trial thread links redirect
  without a generic error;
- the inline guide opens/closes without blocking the page.

### Step 4: Update progress and commit verification record

Add the shipped behavior, exact test count, schema release order, and any
browser limitation to `PROGRESS.md`.

```bash
git add PROGRESS.md docs/plans/2026-09-20-free-trial-funnel-design.md
git commit -m "docs(trial): record simplified trial release"
```

Do not add the user's unrelated `output/docx/` or enterprise proposal PDF.

### Step 5: Apply the additive production schema before app deployment

The repository has no checked-in Prisma migrations and uses `db:push` for
additive releases. Release in this order:

```bash
npm run db:push
npm run backfill:trial-knowledge
npm run db:rls
```

Then push the green commits so the Vercel deployment cannot start against a
schema missing the counters:

```bash
git push origin main
```

Finally verify the deployed `/free-trial` and an authenticated trial smoke path.

