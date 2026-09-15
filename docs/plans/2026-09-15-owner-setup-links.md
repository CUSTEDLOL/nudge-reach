# Seven-day owner setup links implementation plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give founders a secure, single-use setup link that lets a new workspace owner choose a password and enter onboarding without depending on email delivery.

**Architecture:** Store only a SHA-256 hash and seven-day expiry on the existing pending `Invite`. Founder-only services issue or rotate the raw bearer token. A public token page uses a server-only Supabase Admin client to create a confirmed auth user, atomically consume the owner invite and claim the workspace, then uses the normal SSR client to establish the browser session.

**Tech Stack:** Next.js 16 App Router/server actions, React 19, TypeScript, Prisma/Postgres, Supabase Auth, Tailwind CSS, Vitest.

---

## Task 1: Token model and pure security rules

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/orgs/owner-setup.ts`
- Create: `tests/owner-setup.test.ts`

1. Write failing tests for a 32-byte base64url token, deterministic SHA-256
   hashing, seven-day expiry, password validation, and safe public invite lookup.
2. Run `npx vitest run tests/owner-setup.test.ts` and confirm the tests fail for
   missing behavior.
3. Add nullable unique `setupTokenHash` and nullable `setupTokenExpiresAt` to
   `Invite`; implement the minimal pure helpers and lookup query.
4. Run `npx prisma format`, `npx prisma validate`, `npx prisma generate`, and the
   focused test until green.
5. Commit: `feat(auth): add secure owner setup tokens`

## Task 2: Privileged acceptance and session handoff

**Files:**
- Create: `src/lib/supabase/service-role.ts`
- Modify: `src/lib/env-schema.ts`
- Modify: `.env.example`
- Modify: `src/modules/orgs/owner-setup.ts`
- Create: `src/app/invite/[token]/actions.ts`
- Modify: `tests/owner-setup.test.ts`
- Modify: `tests/env.test.ts`

1. Add failing tests for missing service-role configuration, confirmed user
   creation, duplicate-account refusal without password replacement, atomic
   invite consumption, membership creation, pending-owner claim, and race loss.
2. Run the focused tests and confirm failure.
3. Add an optional, server-only `SUPABASE_SERVICE_ROLE_KEY`, a non-persistent
   Supabase Admin client, and the acceptance transaction.
4. Add the thin setup server action: validate both password fields, complete the
   invite, sign in through the existing SSR client, and redirect to onboarding.
5. Run focused tests and `npx tsc --noEmit`; commit:
   `feat(auth): accept owner setup links safely`.

## Task 3: Owner setup page

**Files:**
- Create: `src/app/invite/[token]/page.tsx`
- Create: `src/components/features/owner-setup-form.tsx`
- Create: `tests/owner-setup-ui.test.ts`

1. Add failing UI contract tests for the real Nudge logo, workspace context,
   read-only invited email, blank password/confirmation fields, invalid-link
   state, and sign-in recovery link.
2. Run the focused UI test and confirm failure.
3. Build the branded, responsive page and progressive server-action form with
   accessible error/success handling. Do not preselect or prefill credentials.
4. Run focused tests and commit: `feat(auth): add owner password setup page`.

## Task 4: Generate the first link with a workspace

**Files:**
- Modify: `src/modules/admin/create-workspace.ts`
- Modify: `src/app/admin/orgs/actions.ts`
- Modify: `src/modules/admin/actions.ts`
- Modify: `tests/admin-create-workspace.test.ts`
- Modify: `tests/admin-actions.test.ts`

1. Change tests first to require the token hash/expiry on the created owner
   invite, the raw seven-day URL in the action result, and the same URL in email.
2. Run both focused tests and confirm failure.
3. Issue the token before the transaction, persist only its hash/expiry, return
   the raw URL once, and pass it into the email template.
4. Extend the founder action result with optional structured setup-link data
   without changing other action callers.
5. Run focused tests and commit: `feat(admin): return workspace owner setup link`.

## Task 5: Show copy/open controls after creation

**Files:**
- Modify: `src/components/features/admin-shell/action-form.tsx`
- Modify: `src/components/features/admin-shell/new-workspace.tsx`
- Create: `src/components/features/admin-shell/setup-link-panel.tsx`
- Create: `tests/admin-owner-setup-ui.test.ts`

1. Add failing UI contract tests for a durable post-create success panel, owner
   email/expiry context, **Copy setup link**, and safe **Open link** behavior.
2. Run the test and confirm failure.
3. Let `ActionForm` deliver its structured result to an optional success
   callback and render the setup-link panel in `NewWorkspace`.
4. Keep the form state and link visible until the founder explicitly closes or
   creates another workspace; do not put the bearer URL in toast text.
5. Run focused tests and commit: `feat(admin): show owner setup link controls`.

## Task 6: Rotate links from the Team page

**Files:**
- Modify: `src/modules/admin/team.ts`
- Modify: `src/app/admin/orgs/[id]/actions.ts`
- Modify: `src/app/admin/orgs/[id]/team/page.tsx`
- Create: `src/components/features/admin-shell/owner-setup-link-action.tsx`
- Modify: `tests/admin-team.test.ts`
- Modify: `tests/admin-actions.test.ts`
- Modify: `tests/admin-owner-setup-ui.test.ts`

1. Add failing tests that rotation is founder-only, org-scoped, pending-owner
   only, changes hash/expiry, invalidates the old link, audits without recording
   the token, and optionally emails the new link.
2. Run focused tests and confirm failure.
3. Implement the founder service/action and show **Generate new setup link** only
   on pending owner invites. Render returned copy/open controls inline.
4. Update Team explanatory copy so manual sharing is the primary no-email path;
   leave admin/agent invite behavior unchanged.
5. Run focused tests and commit: `feat(admin): rotate pending owner setup links`.

## Task 7: Full verification and production rollout

**Files:**
- Modify: `PROGRESS.md`

1. Run `npx prisma validate`, `npx prisma generate`, focused security/auth/admin
   tests, `npm test`, `npm run lint`, and `npm run build`.
2. Review the final diff for raw-token logging, service-key client exposure,
   unscoped Prisma queries, password handling, and changes outside this feature.
3. Update `PROGRESS.md` with the shipped behavior and exact verification.
4. Apply the schema to production with `npx prisma db push` before deploying the
   code, and add the Supabase service-role credential to Vercel as a sensitive
   server-only value without printing it.
5. Rebase/merge the latest `origin/main`, rerun the full verification if the
   base changed, push the verified commit to `main`, and wait for production.
6. Verify `/admin`, workspace creation, copy/open, setup-page rendering, password
   completion, onboarding redirect, second-use rejection, and link rotation with
   a disposable account. Confirm normal client and founder sessions stay separate.
7. Commit documentation if needed: `docs: record owner setup link rollout`.

