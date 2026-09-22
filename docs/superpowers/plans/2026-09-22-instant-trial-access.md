# Instant Trial Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a free-trial prospect create a password and enter the trial Inbox immediately, while offering email verification later as a non-blocking account-protection reminder.

**Architecture:** Keep the public lead-intake request password-free, then exchange its one-time claim plus matching HTTP-only resume cookie for one server-provisioned Supabase account. The browser signs in normally and lets the existing atomic claim flow create the isolated simulated workspace. Record actual inbox ownership separately on `AcquisitionTrial.emailVerifiedAt` only after a valid magic-link exchange; verification never participates in authorization.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth, Prisma/Postgres, React, Zod, Vitest, Tailwind CSS

**Spec:** `docs/plans/2026-09-22-instant-trial-access-design.md`

## Global Constraints

- Keep name, business name, work email, mobile number, password, and contact consent on the free-trial form.
- `POST /api/trials` must remain password-free; plaintext passwords may never be logged, persisted, or returned by Nudge.
- Global Supabase confirmation and signup settings remain unchanged.
- A trial account may be provisioned only from an unclaimed, unexpired claim whose raw token matches both the stored hash and the HTTP-only resume cookie.
- The account email comes only from `AcquisitionTrial.emailNormalized`; never trust a second client-supplied email.
- Existing Supabase users are never updated and their passwords are never replaced.
- `claimAcquisitionTrial` remains the only code that creates the Org/membership and consumes the trial claim.
- Successful signup opens `/dashboard`; the old confirmation wall is removed.
- Email verification is optional, dismissible, and informational. It must not gate sign-in, roles, tenant access, credits, messaging, or billing.
- Trial workspaces remain simulated, seven days long, limited to 15 AI replies, and governed by all seven protected invariants in `AGENTS.md`.
- Do not add dependencies or expand normal product signup.

## File Map

- `src/modules/trial/resume-cookie.ts`: safely read the same-browser resume secret from a request.
- `src/modules/trial/account.ts`: validate a trial-account request and provision exactly one Supabase password account.
- `src/app/api/trials/account/route.ts`: rate-limited, public-safe HTTP boundary for account provisioning.
- `src/modules/trial/browser-signup.ts`: browser payload contracts and direct-Inbox orchestration helpers.
- `src/app/free-trial/trial-signup-form.tsx`: submit intake, provision account, sign in, and route without an email-confirmation screen.
- `src/modules/trial/email-verification.ts`: record proof of email ownership for the authenticated trial member.
- `src/app/auth/confirm/route.ts`: mark the trial email verified after successful OTP or PKCE exchange.
- `src/modules/trial/workspace.ts`: expose only the boolean `emailVerified` to trial UI.
- `src/components/features/trial/trial-email-verification.tsx`: non-blocking auto-send, resend, and local dismissal UI.
- `src/components/features/trial/trial-status-strip.tsx`: place the compact verification reminder in the existing strip.
- `src/components/features/app-shell/shell.tsx`: pass the signed-in email into the reminder.
- `prisma/schema.prisma`: add the nullable `AcquisitionTrial.emailVerifiedAt` proof timestamp.
- `scripts/supabase-auth-config.mjs`: configure the magic-link template to return through `/auth/confirm`.

## Review Focus

- A malformed percent-encoded cookie must be treated as absent, never crash either trial endpoint; Task 1 adds this test.
- A valid claim paired with the wrong browser cookie must never construct a service-role client; Task 2 adds this test.
- A network retry after the auth user already exists must allow a normal password sign-in without overwriting credentials or leaking account existence; Tasks 2 and 3 add this test.
- An authenticated user with the same email but no membership in the claimed trial Org must not mark the trial verified; Task 4 adds this test.
- React Strict Mode/remounts must not send repeated automatic verification emails, and mail failure must leave the dashboard usable; Task 5 adds this test.

---

### Task 1: Shared Same-Browser Resume Cookie Boundary

**Files:**
- Create: `src/modules/trial/resume-cookie.ts`
- Modify: `src/app/api/trials/route.ts`
- Modify: `tests/trial-signup.test.ts`

**Interfaces:**
- Consumes: `TRIAL_RESUME_COOKIE` from `@/modules/trial/signup`.
- Produces: `readTrialResumeToken(request: Request): string | undefined` for both trial endpoints.

- [ ] **Step 1: Write the failing cookie-reader tests**

Add assertions to `tests/trial-signup.test.ts` for a matching encoded cookie, a missing cookie, and malformed percent encoding:

```ts
import { readTrialResumeToken } from "@/modules/trial/resume-cookie";

it("reads the resume cookie without throwing on malformed encoding", () => {
  expect(readTrialResumeToken(new Request("https://nudge.test", {
    headers: { cookie: "other=1; nudge_trial_resume=abc%2D123" },
  }))).toBe("abc-123");
  expect(readTrialResumeToken(new Request("https://nudge.test"))).toBeUndefined();
  expect(readTrialResumeToken(new Request("https://nudge.test", {
    headers: { cookie: "nudge_trial_resume=%E0%A4%A" },
  }))).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npm test -- tests/trial-signup.test.ts`

Expected: FAIL because `@/modules/trial/resume-cookie` does not exist.

- [ ] **Step 3: Implement the minimal safe reader and reuse it**

Create the helper with the following behavior:

```ts
import { TRIAL_RESUME_COOKIE } from "./signup";

export function readTrialResumeToken(request: Request): string | undefined {
  const prefix = `${TRIAL_RESUME_COOKIE}=`;
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}
```

Delete the local `resumeTokenFrom` function in `src/app/api/trials/route.ts`, import `readTrialResumeToken`, and pass its result to `createPendingTrial`.

- [ ] **Step 4: Run the focused test and verify the green state**

Run: `npm test -- tests/trial-signup.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the boundary**

```bash
git add src/modules/trial/resume-cookie.ts src/app/api/trials/route.ts tests/trial-signup.test.ts
git commit -m "refactor(trial): share resume cookie boundary"
```

### Task 2: Secure Trial Password Account Provisioning

**Files:**
- Create: `src/modules/trial/account.ts`
- Create: `src/app/api/trials/account/route.ts`
- Create: `tests/trial-account.test.ts`
- Modify: `tests/proxy-session.test.ts`

**Interfaces:**
- Consumes: `hashClaimToken(token: string)`, `readTrialResumeToken(request)`, `createServiceRoleClient()`, `checkRateLimit()`.
- Produces: `trialAccountSchema` and `provisionTrialAccount(raw: unknown, resumeToken: string | undefined, now?: Date): Promise<TrialAccountResult>`.
- `TrialAccountResult` is `{ ok: true } | { ok: false; code: "invalid" | "existing_account" | "unavailable" }` and contains no secrets or identifiers.

- [ ] **Step 1: Write failing domain and route tests**

In `tests/trial-account.test.ts`, mock Prisma, the service-role factory, and rate limiting. Pin all of these cases:

```ts
const valid = {
  trialId: "trial_1",
  claimToken: "c".repeat(43),
  password: "correct horse battery staple",
};

it.each([
  [{ ...valid, trialId: "bad id" }, undefined],
  [{ ...valid, claimToken: "short" }, valid.claimToken],
  [{ ...valid, password: "short" }, valid.claimToken],
  [valid, undefined],
  [valid, "wrong-cookie"],
])("rejects invalid or mismatched claims before privileged auth", async (raw, cookie) => {
  await expect(provisionTrialAccount(raw, cookie)).resolves.toEqual({
    ok: false,
    code: "invalid",
  });
  expect(createServiceRoleClient).not.toHaveBeenCalled();
});
```

Also test expired, already-claimed, and forged hashes; successful lookup; exact `createUser` input; thrown admin failures; existing-user errors; response redaction; malformed JSON; `trial-account:<ip>` rate limiting with `Retry-After`; and explicit public routing for `/api/trials/account`.

The success expectation must be exact:

```ts
expect(createUser).toHaveBeenCalledWith({
  email: "owner@example.com",
  password: valid.password,
  email_confirm: true,
  user_metadata: {
    acquisition_trial_id: valid.trialId,
    acquisition_trial_token: valid.claimToken,
  },
});
```

- [ ] **Step 2: Run focused tests and verify the red state**

Run: `npm test -- tests/trial-account.test.ts tests/proxy-session.test.ts`

Expected: FAIL because the account module and route do not exist.

- [ ] **Step 3: Implement schema and provisioning logic**

Use strict bounded validation:

```ts
export const trialAccountSchema = z.object({
  trialId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  claimToken: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
  password: z.string().min(8).max(128),
}).strict();
```

After parsing, query only an unclaimed and unexpired row with the exact ID and hash. Compare `hashClaimToken(resumeToken)` to the stored hash with `timingSafeEqual` before constructing the service-role client. Derive `email` from the selected `emailNormalized`. Classify Supabase codes `email_exists`, `email_address_exists`, `user_already_exists`, plus an “already registered” message as `existing_account`; return `unavailable` for all other admin errors and throws. Never call an update-password API and never consume the claim.

- [ ] **Step 4: Implement the public-safe HTTP route**

`POST /api/trials/account` must:

```ts
const rate = checkRateLimit(`trial-account:${ip}`, RATE_LIMITS.publicForm);
const result = await provisionTrialAccount(raw, readTrialResumeToken(request));
```

Return only:

- `200 { ok: true }` for success.
- `409 { ok: false, error: "This trial cannot create a new account. Sign in or restart with a different email." }` for invalid or existing-account results.
- `503 { ok: false, error: "Account creation is temporarily unavailable. Please try again." }` for unavailable results.
- `400 { ok: false, error: "Invalid request." }` for malformed JSON.
- `429` plus `Retry-After` for rate limits.

Do not log request bodies, passwords, tokens, emails, Supabase errors, or auth user IDs.

- [ ] **Step 5: Run focused tests and verify the green state**

Run: `npm test -- tests/trial-account.test.ts tests/proxy-session.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit account provisioning**

```bash
git add src/modules/trial/account.ts src/app/api/trials/account/route.ts tests/trial-account.test.ts tests/proxy-session.test.ts
git commit -m "feat(trial): provision instant password accounts"
```

### Task 3: Direct Form-to-Inbox Handoff

**Files:**
- Modify: `src/modules/trial/browser-signup.ts`
- Modify: `src/app/free-trial/trial-signup-form.tsx`
- Modify: `tests/free-trial-page.test.ts`

**Interfaces:**
- Consumes: successful claim from `POST /api/trials`, successful account result from `POST /api/trials/account`, and Supabase `signInWithPassword`.
- Produces: `trialAccountPayload(form, claim)`, `trialPasswordCredentials(form)`, and `trialSignupDestination(hasSession): "/dashboard" | null`.

- [ ] **Step 1: Replace confirmation-flow expectations with direct-login expectations**

Update `tests/free-trial-page.test.ts` to retain the proof that `trialIntakePayload` has no password and add these contracts:

```ts
expect(trialAccountPayload(form, claim)).toEqual({
  trialId: claim.trialId,
  claimToken: claim.claimToken,
  password: form.password,
});
expect(trialPasswordCredentials(form)).toEqual({
  email: form.email,
  password: form.password,
});
expect(trialSignupDestination(true)).toBe("/dashboard");
expect(trialSignupDestination(false)).toBeNull();
```

Add source-contract assertions that the form posts to `/api/trials/account`, calls `signInWithPassword`, no longer calls `signUp`, and contains neither `Check your email` nor `confirmationEmail`.

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npm test -- tests/free-trial-page.test.ts`

Expected: FAIL on the new helper names and old `/agent`/confirmation behavior.

- [ ] **Step 3: Implement the browser contracts**

Replace `trialAuthCredentials` with:

```ts
export function trialAccountPayload(
  form: TrialSignupValues,
  claim: TrialClaimResponse,
) {
  return { trialId: claim.trialId, claimToken: claim.claimToken, password: form.password };
}

export function trialPasswordCredentials(form: TrialSignupValues) {
  return { email: form.email, password: form.password };
}

export function trialSignupDestination(hasSession: boolean) {
  return hasSession ? "/dashboard" as const : null;
}
```

Keep `trialIntakePayload` unchanged and password-free. Set the password field's
`maxLength={128}` so the browser and server enforce the same bound.

- [ ] **Step 4: Implement the form handoff**

After intake succeeds, post `trialAccountPayload(values, claim)` to `/api/trials/account`. On `200`, call `supabase.auth.signInWithPassword(trialPasswordCredentials(values))`. On the account endpoint’s safe `409`, also attempt the same password sign-in so an interrupted successful provisioning can resume; if that sign-in fails, show the existing sign-in link without replacing credentials. For any other account failure, preserve `pendingClaim`, show its safe response message, and do not call Supabase sign-in.

Require both `!error` and `data.session` before routing. Before redirecting,
require the authenticated user's `user_metadata.acquisition_trial_id` and
`acquisition_trial_token` to equal the pending claim. This lets an interrupted
provisioning retry resume while preventing an unrelated pre-existing account
from being sent into a trial it cannot claim. On success clear the pending
claim and password, push `/dashboard`, and refresh. Delete `confirmationEmail`
state and the confirmation-wall render branch. Replace the footer copy with:

> Your workspace opens immediately. We will also email you an optional link to verify the address for account recovery.

- [ ] **Step 5: Run the focused signup tests**

Run: `npm test -- tests/free-trial-page.test.ts tests/trial-signup.test.ts tests/trial-claim.test.ts tests/signup-closed.test.ts`

Expected: PASS, including existing tenant-claim protections.

- [ ] **Step 6: Commit the direct handoff**

```bash
git add src/modules/trial/browser-signup.ts src/app/free-trial/trial-signup-form.tsx tests/free-trial-page.test.ts
git commit -m "feat(trial): open the Inbox after signup"
```

### Task 4: Persist Genuine Email Proof After Confirmation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/trial/email-verification.ts`
- Modify: `src/app/auth/confirm/route.ts`
- Modify: `src/modules/trial/workspace.ts`
- Create: `tests/trial-email-verification.test.ts`
- Create: `tests/auth-confirm.test.ts`
- Modify: `tests/trial-workspace.test.ts`
- Modify: `tests/trial-inbox-page.test.tsx`
- Modify: `tests/trial-training.test.tsx`
- Modify: `tests/trial-tour.test.ts`
- Modify: `tests/trial-shell.test.tsx`

**Interfaces:**
- Consumes: authoritative `{ id, email }` returned by successful Supabase `verifyOtp` or `exchangeCodeForSession`.
- Produces: `markAcquisitionTrialEmailVerified({ userId, email, now? }): Promise<boolean>` and `TrialWorkspace.emailVerified: boolean`.

- [ ] **Step 1: Write failing verification-domain tests**

In `tests/trial-email-verification.test.ts`, prove that the update requires all three ownership signals: normalized email, a claimed/org-linked trial, and a membership in that Org for the authenticated Supabase user ID.

```ts
expect(updateMany).toHaveBeenCalledWith({
  where: {
    emailNormalized: "owner@example.com",
    emailVerifiedAt: null,
    claimedAt: { not: null },
    orgId: { not: null },
    org: { memberships: { some: { userId: "user_1" } } },
  },
  data: { emailVerifiedAt: now },
});
```

Test missing/blank email, non-membership (`count: 0`), idempotence, and database failure propagation to the route boundary.

- [ ] **Step 2: Write failing auth-confirm route tests**

In `tests/auth-confirm.test.ts`, mock the Supabase server client and marker. Cover:

- valid `token_hash` + `type=magiclink` marks with returned `data.user.id/email` and redirects to a safe `next`;
- valid PKCE `code` does the same;
- invalid/expired OTP, missing returned user/email, and failed PKCE never mark;
- marker failure does not invalidate a successful auth exchange or open an unsafe redirect;
- attacker-controlled `next=https://evil.test` still resolves through `safeRelativePath`.

- [ ] **Step 3: Run verification tests and verify the red state**

Run: `npm test -- tests/trial-email-verification.test.ts tests/auth-confirm.test.ts tests/trial-workspace.test.ts`

Expected: FAIL because the timestamp, marker, and projection do not exist.

- [ ] **Step 4: Add the schema field and generate Prisma types**

Add immediately after `claimedAt`:

```prisma
emailVerifiedAt       DateTime?
```

Run: `npx prisma generate`

Expected: Prisma Client generation succeeds without changing database data.

- [ ] **Step 5: Implement the ownership-bound marker**

Create a server-only module that normalizes the email, rejects empty input, runs the exact `updateMany` above, and returns `updated.count === 1`. It must never select or return the trial row.

- [ ] **Step 6: Mark only after a successful auth exchange**

In both branches of `/auth/confirm`, keep the existing OTP/PKCE calls and safe-relative redirect. Read `data.user`; after a successful exchange with `user.id` and `user.email`, call the marker. Catch marker errors so an already-valid auth session can still reach the safe destination; do not mark on auth errors or absent authoritative user data.

- [ ] **Step 7: Add the UI-safe boolean projection**

Select `emailVerifiedAt`, add `emailVerified: boolean` to `TrialWorkspace`, and return `Boolean(trial.emailVerifiedAt)`. Add `emailVerified: false` to every typed test fixture and the full-object expectation; test `true` when a timestamp exists. Do not expose the timestamp or trial email.

- [ ] **Step 8: Run focused tests and verify the green state**

Run: `npm test -- tests/trial-email-verification.test.ts tests/auth-confirm.test.ts tests/trial-workspace.test.ts tests/trial-inbox-page.test.tsx tests/trial-training.test.tsx tests/trial-tour.test.ts tests/trial-shell.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit email-proof persistence**

```bash
git add prisma/schema.prisma src/modules/trial/email-verification.ts src/app/auth/confirm/route.ts src/modules/trial/workspace.ts tests/trial-email-verification.test.ts tests/auth-confirm.test.ts tests/trial-workspace.test.ts tests/trial-inbox-page.test.tsx tests/trial-training.test.tsx tests/trial-tour.test.ts tests/trial-shell.test.tsx
git commit -m "feat(trial): record optional email verification"
```

### Task 5: Non-Blocking Verification Reminder and Mail Template

**Files:**
- Create: `src/components/features/trial/trial-email-verification.tsx`
- Modify: `src/components/features/trial/trial-status-strip.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`
- Modify: `scripts/supabase-auth-config.mjs`
- Create: `tests/trial-verification-reminder.test.tsx`
- Modify: `tests/trial-shell.test.tsx`

**Interfaces:**
- Consumes: `trial.id`, `trial.emailVerified`, authenticated `user.email`, and `createClient().auth.signInWithOtp`.
- Produces: `TrialEmailVerification({ trialId, email })`, rendered only for an unverified active trial.

- [ ] **Step 1: Write failing pure-state and rendered-contract tests**

Export small pure helpers so behavior is deterministic without a browser renderer:

```ts
expect(trialVerificationStorageKeys("trial_1")).toEqual({
  sent: "nudge:trial:trial_1:verification-sent",
  dismissed: "nudge:trial:trial_1:verification-dismissed",
});
expect(trialVerificationRedirect("https://nudge.test")).toBe(
  "https://nudge.test/auth/confirm?next=/dashboard",
);
```

Assert the rendered strip includes “Verify your email to protect this workspace.”, “Resend email”, and “Dismiss” only when `emailVerified` is false. Source-contract assertions must prove `shouldCreateUser: false`, a per-mount `useRef` guard, per-trial localStorage keys, inline success/error state, and no navigation or disabled dashboard control.

- [ ] **Step 2: Run focused tests and verify the red state**

Run: `npm test -- tests/trial-verification-reminder.test.tsx tests/trial-shell.test.tsx`

Expected: FAIL because the reminder does not exist.

- [ ] **Step 3: Implement the client reminder**

Build a compact client component with:

```ts
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: trialVerificationRedirect(window.location.origin),
  },
});
```

On mount, return immediately if dismissed, already sent, or the `useRef` guard is set. Otherwise set the guard, request the email, and store the sent key only on success. “Resend email” always retries and reports “Verification email sent.” or a short inline error. “Dismiss” stores only the per-trial dismissal key and hides the reminder locally. Mail failure must never throw past the component or block children.

- [ ] **Step 4: Wire the reminder into the existing strip**

Add `email: string` to `TrialStatusStrip` props and pass `user.email` from `AppShell`. Render `TrialEmailVerification` beneath the status copy when `!trial.emailVerified`; keep the trial usage and conversion controls unchanged.

- [ ] **Step 5: Configure the cross-device magic-link template**

Add this key to `AUTH_CONFIG` in `scripts/supabase-auth-config.mjs`:

```js
mailer_templates_magic_link_content: `<h2>Verify your Nudge email</h2>
<p>Use this link to verify the email for your trial workspace:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard">Verify email</a></p>`,
```

Do not change `mailer_autoconfirm`, normal confirmation, recovery, or invitation settings.

- [ ] **Step 6: Run focused tests and verify the green state**

Run: `npm test -- tests/trial-verification-reminder.test.tsx tests/trial-shell.test.tsx tests/trial-tour.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the optional reminder**

```bash
git add src/components/features/trial/trial-email-verification.tsx src/components/features/trial/trial-status-strip.tsx src/components/features/app-shell/shell.tsx scripts/supabase-auth-config.mjs tests/trial-verification-reminder.test.tsx tests/trial-shell.test.tsx tests/trial-tour.test.ts
git commit -m "feat(trial): offer optional email verification"
```

### Task 6: Full Verification, Release Notes, Integration, and Production Smoke

**Files:**
- Modify: `PROGRESS.md`
- Verify: all changed files from Tasks 1–5

**Interfaces:**
- Consumes: the complete direct-access and optional-verification flow.
- Produces: a green, reviewed, documented, database-synced production release.

- [ ] **Step 1: Run all local quality gates**

Run each command separately:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all commands exit `0`. Record exact test totals and pre-existing non-fatal warnings.

- [ ] **Step 2: Perform security and regression searches**

Run:

```bash
rg -n "signUp\(|Check your email|next=/agent|mailer_autoconfirm" src/app/free-trial src/modules/trial scripts/supabase-auth-config.mjs
rg -n "password|claimToken|claimTokenHash" src/app/api/trials src/modules/trial/account.ts
git diff --check e174e00...HEAD
git status --short
```

Expected: no old confirmation signup path; no password logging/persistence; no changed global autoconfirm; clean whitespace; only intended files changed.

- [ ] **Step 3: Update progress with exact behavior and evidence**

Add a dated entry to `PROGRESS.md` stating that password signup now opens the trial Inbox directly, verification is optional and tracked separately, global auth confirmation is unchanged, the account endpoint requires the claim plus matching HTTP-only cookie, and listing the exact test/type/lint/build results.

- [ ] **Step 4: Request independent whole-branch review**

Have a fresh reviewer inspect `e174e00...HEAD` for account-enumeration leaks, service-role exposure, claim replay, tenant isolation, unsafe redirects, non-idempotent verification, and divergence from the approved design. Fix every confirmed issue test-first, rerun the focused tests, and commit the fix separately.

- [ ] **Step 5: Commit release documentation**

```bash
git add PROGRESS.md
git commit -m "docs(trial): record instant access release"
```

- [ ] **Step 6: Integrate the latest main and re-run gates**

Fetch and merge the latest `main` into the feature branch without discarding unrelated work. Resolve only feature-owned conflicts, then rerun:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all commands exit `0` on the exact integration commit.

- [ ] **Step 7: Apply additive production configuration**

With the production environment loaded, run:

```bash
npm run db:push
npm run db:rls
node scripts/supabase-auth-config.mjs
```

Expected: the nullable column is applied without data loss, the RLS audit passes, and only the configured email templates/site URLs are updated. If `SUPABASE_ACCESS_TOKEN` is absent, stop before claiming the verification-email feature is live and report that explicit release blocker.

- [ ] **Step 8: Merge, push, and smoke-test production**

Merge the reviewed feature branch into `main`, push `main`, wait for the Vercel deployment, and verify:

- `/free-trial` renders the password form and immediate-access copy;
- a new unique test lead reaches `/dashboard` without a confirmation wall;
- the trial shell contains only Inbox and Train AI navigation;
- the optional verification reminder is visible but does not block Inbox use;
- the admin lead view retains the submitted mobile number;
- no secrets appear in network responses or deployment logs.

Use a disposable address and do not connect live WhatsApp. Record the deployment URL and smoke result in the handoff.
