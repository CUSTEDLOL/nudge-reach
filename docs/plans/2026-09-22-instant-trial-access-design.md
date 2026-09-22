# Instant Trial Access Design

**Date:** 2026-09-22
**Status:** Approved
**Builds on:** `docs/plans/2026-09-21-simplified-free-trial-design.md`

## Objective

Remove the email-confirmation and repeat-login interruption between the public
free-trial form and the trial workspace. A prospect should enter their details
and password once, choose **Create my workspace**, and arrive directly in the
Inbox. Email verification remains available and encouraged, but it never gates
the trial or a later password sign-in.

The trial remains a restricted, simulated Nudge workspace. This change does not
open normal product signup, connect WhatsApp, or relax any tenant, consent,
message-window, or trial-usage boundary.

## Approved experience

1. The form keeps name, business name, work email, mobile number, password, and
   contact consent.
2. Submitting it records the acquisition lead exactly as it does today.
3. Nudge provisions the password account for that one valid trial claim.
4. The browser signs in and opens `/dashboard`, the trial Inbox, immediately.
5. A slim reminder in the existing trial status strip says that verifying the
   email protects account recovery. It can be dismissed and includes Resend.
6. A verification email is requested after the dashboard opens. Sending or
   opening it never blocks the trial.
7. Clicking the link proves control of the address, records that proof on the
   acquisition trial, signs the user in, and returns them to `/dashboard`.
8. Unverified users may continue signing in with the password they created.

## Why verification is application-level

Supabase's normal confirm-email setting deliberately returns no session until
the confirmation link is opened. Turning that setting off globally would also
change invited and paid-account behavior and would make Supabase label every
new address as confirmed without proof.

The trial therefore uses the existing server-only service-role provisioning
pattern to create only the claimed trial account with immediate password
access. Supabase's auth-level confirmed flag is treated as an account-activation
mechanism for this path, not as evidence that the person owns the inbox. Nudge
stores the real proof separately in `AcquisitionTrial.emailVerifiedAt`, which is
set only after a valid email OTP or magic-link exchange.

This is intentionally a product distinction:

- **Activated account:** may enter the restricted free trial with its password.
- **Verified email:** the user opened a valid link delivered to that address.

## Account-provisioning flow

The existing `POST /api/trials` intake remains password-free. It validates and
normalizes the lead, applies the public-form rate limit, creates or resumes one
pending `AcquisitionTrial`, returns the one-time claim, and sets the HTTP-only
resume cookie.

A new `POST /api/trials/account` endpoint receives the claim and password. It:

1. Applies a public-form rate limit and validates the bounded payload.
2. Requires the matching HTTP-only resume cookie as a second same-browser gate.
3. Resolves the still-unclaimed, unexpired acquisition trial by the hashed claim
   token; the client does not choose the account email or business data again.
4. Uses the server-only Supabase service-role client to create the password
   account with immediate auth activation and the existing acquisition-claim
   metadata.
5. Never logs, persists, or echoes the plaintext password.
6. Returns a minimal success or conflict response without exposing the claim
   hash, service-role errors, or whether an unrelated email account exists.

The browser then uses normal `signInWithPassword`. A successful session goes to
`/dashboard`; the existing `resolveOrgContext` and atomic
`claimAcquisitionTrial` transaction create the simulated Org, OWNER membership,
trial link, and credit grant from the claim metadata. The claim remains
email-bound, hashed at rest, expiring, and single-use.

If account provisioning succeeded but the browser was interrupted before
sign-in, retrying with the same password attempts the normal sign-in path. The
claim metadata on the account allows the existing org resolver to finish the
workspace claim safely.

## Optional verification flow

`AcquisitionTrial` gains one nullable timestamp: `emailVerifiedAt`.

The UI-safe `TrialWorkspace` projection exposes only a boolean
`emailVerified`. When it is false, a small client component in the trial status
strip:

- requests a Supabase email magic link once after the first dashboard render;
- never delays or redirects the dashboard while sending;
- offers an explicit Resend action with inline success/error feedback; and
- can be dismissed locally without changing server state.

The magic-link template uses the existing server-side `/auth/confirm` endpoint.
After `verifyOtp` or PKCE exchange succeeds, the endpoint uses the authoritative
Supabase user email to set `emailVerifiedAt` on the matching acquisition trial,
then follows the existing safe relative redirect to `/dashboard`. An invalid or
expired link changes no verification state.

The reminder disappears server-side after verification. Verification is not a
role, billing, trial-usage, or tenant-access predicate.

## Existing-account and failure behavior

- A duplicate acquisition email or mobile keeps the current resume-or-sign-in
  behavior.
- If the auth account already exists, the form directs the person to sign in;
  it never resets or replaces that account's password.
- If intake fails, no auth account is created.
- If account provisioning fails, the pending trial remains resumable with its
  HTTP-only secret and the form shows a retryable error.
- If the subsequent browser sign-in fails, the form preserves the intake claim
  and offers retry/sign-in rather than creating another lead.
- If the optional email cannot be sent, the workspace remains usable and the
  reminder offers Resend.
- If verification fails, `/auth/confirm` retains its existing safe failure
  redirect and never marks the trial verified.

## Security boundaries

- Global Supabase confirmation and signup settings remain unchanged.
- Service-role credentials stay in a `server-only` module and never enter the
  browser bundle.
- The account endpoint requires both the high-entropy claim and its matching
  HTTP-only resume cookie, is rate-limited, and derives the email from the
  server-side trial row.
- Passwords are accepted only over HTTPS, bounded by schema validation, passed
  directly into Supabase account creation, and never logged or stored by Nudge.
- Workspace creation continues through the existing one-transaction claim
  function, including token hash, email match, expiry, and `claimedAt: null`.
- Every dashboard query and mutation continues through verified Supabase claims,
  `requireOrgContext`, membership scope, and role/capability gates.
- Optional email verification is informational and recovery-oriented; no code
  may accidentally treat it as authorization.

The accepted tradeoff is that a typo or an address entered by someone who does
not own it can still use the restricted trial with the chosen password. They
cannot receive the verification or recovery email. The trial contains only the
business information they themselves add, has no live WhatsApp connection, and
remains bounded to seven days and 15 replies.

## Interface copy

The first page stays simple. The form helper changes from implying that email
confirmation is required to:

> Your workspace opens immediately. We will also email you an optional link to
> verify the address for account recovery.

The compact dashboard reminder uses plain language:

> Verify your email to protect this workspace.

Actions: **Resend email** and **Dismiss**. There is no modal, forced tour,
countdown, or disabled dashboard control.

## Verification plan

Test-first coverage must prove:

- the intake request still never receives the password;
- account provisioning rejects malformed, expired, mismatched-cookie, used, and
  forged claims before calling the service-role client;
- account provisioning derives the email from the trial row and never returns
  secrets;
- existing auth accounts are never overwritten;
- the browser performs intake, account provisioning, password sign-in, and a
  direct `/dashboard` redirect without showing the old confirmation wall;
- failed account creation or sign-in never redirects into the app;
- the atomic org claim and all closed-signup/tenant tests remain unchanged;
- the trial projection exposes only the verification boolean;
- valid OTP and PKCE confirmation mark the matching trial verified, while
  invalid links do not;
- the reminder is non-blocking, dismissible, and supports resend errors; and
- focused tests, full Vitest, TypeScript, lint, production build, database sync,
  RLS audit, and a deployed production smoke test all pass.
