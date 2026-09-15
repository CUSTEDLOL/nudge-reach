# Isolated Founder Admin Login — Design

**Date:** 2026-09-15
**Status:** Approved
**Audience:** Nudge founders only

## Purpose

Make `/admin` a reliable, founder-only entry point with its own email/password
login. Signing into or out of the founder portal must not change the user's
normal Nudge dashboard session.

Today `/admin` reuses the normal application session. A signed-in customer who
is not in `FOUNDER_EMAILS` reaches the founder gate and receives a 404, while a
signed-out visitor is redirected to the normal `/login` page. That behavior is
confusing and prevents a founder from keeping the customer-facing application
open while separately authenticating to the control room.

## Product boundaries

This change provides a separate authentication session, not a second identity
system. Both the normal application and founder portal continue to use the same
Supabase Auth project and user credentials.

The founder portal remains fail-closed through the server-side
`FOUNDER_EMAILS` allowlist. A valid Supabase user is necessary but not
sufficient for admin access.

This iteration does not add:

- admin registration or password reset;
- a database-backed admin role or staff RBAC;
- founder impersonation;
- service-role authentication;
- MFA or passkeys;
- a separate admin domain.

## Chosen approach

Use a second Supabase SSR session with a distinct cookie name scoped to
`/admin`.

This is preferred over a custom password/session implementation because it
keeps password validation, session rotation, expiry, and revocation in Supabase.
It is preferred over an admin subdomain because it avoids new DNS, deployment,
and cross-subdomain cookie configuration while preserving session isolation.

## User experience

### Signed out of the founder portal

Visiting `/admin` shows a branded Nudge Founder Portal login panel with email
and password fields. It does not redirect to `/login`, show a 404, or display
the admin sidebar before authorization succeeds.

Invalid credentials and valid non-founder accounts receive one generic inline
error. The response does not disclose whether the email exists or whether it is
on the founder allowlist.

### Signed into the founder portal

After successful email/password authentication and allowlist verification, the
user returns to `/admin` and sees the existing founder control room. Direct
visits to protected `/admin/*` pages work with the admin session.

### Signing out

The founder portal's sign-out control clears only the admin session and returns
to `/admin`. The normal dashboard remains signed in. Likewise, normal
application sign-out does not deliberately clear the admin session.

## Architecture

### Admin Supabase client

A dedicated server-only factory creates the admin Supabase client. It uses the
existing publishable URL and key with a unique storage key and these cookie
properties:

- `Path=/admin`;
- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` in production.

The default application client remains unchanged. Admin authentication never
uses the default application cookie.

### Request middleware

Requests under `/admin` refresh only the admin Supabase session and are allowed
to reach the route. Other requests retain the existing normal-session behavior.
The proxy is a session-refresh layer, not the authorization boundary.

### Authorization

The admin auth module reads claims only from the dedicated admin client and
validates the normalized email against `FOUNDER_EMAILS`.

It exposes:

- an optional founder lookup for the `/admin` entry page and layout; and
- a required founder guard for every protected admin page, route, and action.

An absent or unauthorized admin session on a protected child route redirects to
`/admin`. It no longer returns `notFound()`.

### Root layout and page

The `/admin` layout checks the optional founder context before running any
cross-organization query. Without a founder it renders the login page without
the admin shell. With a founder it renders the existing admin shell and badge
counts.

The `/admin` page follows the same boundary: login first when unauthenticated,
overview queries only after founder authorization.

### Login and logout

The login server action validates bounded email/password inputs and calls
`signInWithPassword` on the admin client. It then checks the returned user's
email against `FOUNDER_EMAILS`. A non-founder session is immediately signed out
and receives the generic error.

The admin logout route calls `signOut` on the admin client and redirects to
`/admin`. The existing `/auth/signout` behavior remains unchanged for the normal
application.

## Security properties

- Passwords are submitted to a server action and are not stored by Nudge.
- Admin cookies are inaccessible to browser JavaScript and unavailable outside
  `/admin`.
- The normal and founder sessions have different storage keys.
- `FOUNDER_EMAILS` is checked server-side on login and every protected access.
- Admin actions retain their existing `requireFounder` checks.
- No cross-organization query runs before founder authorization.
- Login errors avoid account and allowlist enumeration.
- Tenant isolation, consent, simulation, runtime-model, and messaging-window
  invariants are unchanged.

## Error behavior

Configuration errors remain server errors and are not converted into an
authentication failure. Expected credential and authorization failures stay on
the login panel with a safe inline message. Protected deep links redirect to
the stable `/admin` login entry point.

## Verification

Automated coverage will prove:

1. the admin client uses a distinct, `/admin`-scoped cookie configuration;
2. admin requests do not read or refresh the normal application session;
3. non-admin requests retain current authentication behavior;
4. allowed founder credentials establish the admin session;
5. invalid and non-founder credentials fail safely;
6. admin sign-out targets only the admin session;
7. the signed-out `/admin` page renders the login without shell data queries;
8. protected admin routes still enforce the founder allowlist.

The final pass includes targeted tests, the full test suite, lint, production
build, and a browser check of both session-isolation directions.
