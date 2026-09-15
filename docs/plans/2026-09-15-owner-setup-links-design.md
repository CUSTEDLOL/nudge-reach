# Seven-day owner setup links — design

**Date:** 2026-09-15  
**Status:** Approved

## Context

Founder-created workspaces currently save a pending owner invite and optionally
send a generic `/login?invited=1` email. Production email is not configured, and
the generic link asks the owner to sign up through Supabase's mail-confirmation
flow. This makes first-client onboarding depend on email delivery and gives the
founder no usable handoff link.

The required outcome is a link the founder can copy from `/admin`, send through
any channel, and trust for seven days. The owner must choose their own password,
become the workspace owner, sign in, and enter the existing onboarding wizard.

Supabase's hosted email action links cannot meet the seven-day requirement (their
configured lifetime is capped at 24 hours), so Nudge will own this invitation
token while Supabase remains the authentication system.

## Goals

- Generate a secure owner setup link when a founder creates a workspace.
- Keep the link valid for seven days, single-use, and invalid after regeneration.
- Let the invited owner set their password without requiring an email provider.
- Create a confirmed Supabase user, attach it to only the invited workspace as
  `OWNER`, sign it in, and continue to `/onboarding`.
- Show copy/open controls immediately after workspace creation and beside a
  pending owner invite in the workspace Team page.
- Send the same link automatically when Resend is configured; otherwise make
  manual sharing a complete supported path.

## Non-goals

- Changing admin/agent teammate invitation behavior.
- Allowing founders to set, see, or reset an owner's password.
- Supporting one email as the owner of multiple newly created workspaces.
- Replacing Supabase Auth or the existing organization-resolution rules.

## User flow

1. A founder creates a paid workspace in `/admin/orgs`.
2. The success state shows the owner email, expiry, **Copy setup link**, and
   **Open link**. If email is configured, Nudge also sends this exact link.
3. The owner opens `/invite/{token}`. The page shows the Nudge brand, workspace
   name, and a locked email field.
4. The owner enters and confirms a password. No option is preselected or hidden
   behind the general signup page.
5. Nudge creates a confirmed Supabase Auth user, atomically consumes the invite,
   creates an `OWNER` membership, and claims the pending workspace owner.
6. The app signs the owner in and redirects to `/onboarding`.
7. Invalid, expired, accepted, or superseded links show one neutral failure
   state with a sign-in option and instructions to ask Nudge for a new link.

If the email already has a Supabase account, Nudge never changes its password.
The page directs the person to sign in; the existing pending-invite resolver
continues to attach a matching authenticated account.

## Data model

Add two nullable fields to `Invite`:

```prisma
setupTokenHash      String?   @unique
setupTokenExpiresAt DateTime?
```

Only owner invites use these fields. The browser receives the raw token once;
the database stores only its SHA-256 hash. Existing `status` remains the source
of truth for `pending` versus `accepted`.

The raw token is 32 cryptographically random bytes encoded as base64url. Its
expiry is exactly seven days from issuance. Generating a new token overwrites
the hash and expiry on the same pending invite, invalidating the old URL.

## Components and responsibilities

- `src/modules/orgs/owner-setup.ts`: token generation/hashing, safe invite
  lookup, password validation, privileged account creation, and atomic invite
  acceptance. This is organization/auth business logic, not route logic.
- `src/lib/supabase/service-role.ts`: server-only Supabase client created with
  `SUPABASE_SERVICE_ROLE_KEY`; no session persistence or refresh.
- `src/modules/admin/create-workspace.ts`: issue the initial token inside the
  existing workspace transaction and return the raw setup URL once.
- `src/modules/admin/team.ts`: regenerate a setup link only for a pending
  `OWNER` invite scoped to the selected organization, then audit it.
- `src/app/invite/[token]/*`: thin public page and server action.
- Admin client components: preserve a returned setup URL in local state and
  expose explicit copy/open controls instead of burying it in a toast.

## Acceptance and consistency

The public action re-hashes the URL token and re-reads a pending, unexpired
owner invite. It then calls Supabase Admin `createUser` with
`email_confirm: true`. After that succeeds, one Prisma transaction:

1. conditionally consumes the still-pending invite matching the same hash and
   unexpired timestamp;
2. upserts the `OWNER` membership for that organization and auth user;
3. claims `Org.ownerUserId` only when it still contains a pending-owner sentinel;
4. clears the token fields and marks the invite accepted.

The conditional consume prevents two requests from accepting one link. If the
database step fails after Auth user creation, the user can still sign in with
the password they just chose; the existing email-matched invite resolver can
finish the join. Nudge never deletes or overwrites an existing Auth account.

After acceptance, the ordinary cookie-writing Supabase server client signs in
with the submitted credentials. A sign-in failure does not undo the account;
the response directs the owner to the standard login page.

## Security

- The raw setup token is never stored, audited, or logged.
- Passwords are never stored, returned, audited, or logged by Nudge.
- The service-role key is server-only, optional at boot, and required at the
  moment an owner submits the setup form. It is never exposed to client code.
- Token lookup requires `role=OWNER`, `status=pending`, and a future expiry.
- Regeneration and workspace creation remain behind `requireFounder()` and all
  organization mutations stay organization-scoped.
- Error copy does not reveal whether an arbitrary token or email exists.
- Password confirmation and a minimum of eight characters are enforced on the
  server as well as in the form.

## Email behavior

The owner email template receives the generated `/invite/{token}` URL. With
Resend configured, creation or regeneration emails it. Without Resend, the
invite remains fully usable through the founder's copy/open controls; the UI
states that the link must be shared manually.

## Verification and release

- Unit tests cover token entropy/format, deterministic hashing, exact expiry,
  owner-only lookup, expired/reused/superseded rejection, password validation,
  duplicate-account handling, atomic acceptance, tenant scoping, and returned
  admin action data.
- UI contract tests cover the locked email, password fields, copy/open controls,
  and owner-only Team action.
- Run Prisma validation/generation, focused tests, full tests, lint, and build.
- Apply `prisma db push` to production before deploying code that reads the new
  columns.
- Add `SUPABASE_SERVICE_ROLE_KEY` as a sensitive production environment value,
  deploy, then verify the complete setup flow with a disposable owner address.

