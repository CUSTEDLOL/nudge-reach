# Isolated Founder Admin Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/admin` show its own founder-only email/password login while keeping the normal Nudge application session signed in and untouched.

**Architecture:** Use a second Supabase SSR client with a distinct cookie name scoped to `/admin`. The proxy refreshes that cookie for admin requests without consulting the normal application cookie, while every protected page/action continues to enforce `FOUNDER_EMAILS` server-side. The `/admin` root is the only signed-out entry screen; protected child routes redirect there.

**Tech Stack:** Next.js 16 App Router, React 19 server actions, TypeScript, `@supabase/ssr`, Tailwind CSS, Vitest

---

Use @superpowers:test-driven-development for every behavior change, @frontend-design for the login surface, @vercel:nextjs for App Router boundaries, and @superpowers:verification-before-completion before claiming completion.

The approved design is in `docs/plans/2026-09-15-isolated-founder-admin-login-design.md`.

### Task 1: Create the isolated admin Supabase session

**Files:**
- Create: `src/lib/supabase/admin-cookie.ts`
- Create: `src/lib/supabase/admin-server.ts`
- Create: `tests/admin-session.test.ts`

**Step 1: Write the failing client-configuration test**

Mock `next/headers` and `@supabase/ssr`, call `createAdminClient()`, and assert that the SSR client receives a non-default cookie name with:

```ts
expect(options.cookieOptions).toEqual({
  name: "nudge-founder-auth",
  path: "/admin",
  httpOnly: true,
  sameSite: "lax",
  secure: false,
});
```

Also exercise `cookies.getAll` and `cookies.setAll` through the captured adapter and prove all writes retain the configured cookie options supplied by Supabase.

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/admin-session.test.ts`

Expected: FAIL because `@/lib/supabase/admin-server` does not exist.

**Step 3: Add the shared cookie configuration**

Create `src/lib/supabase/admin-cookie.ts` with one exported function so production security is evaluated at runtime:

```ts
export const ADMIN_AUTH_COOKIE_NAME = "nudge-founder-auth";

export function adminCookieOptions() {
  return {
    name: ADMIN_AUTH_COOKIE_NAME,
    path: "/admin",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
```

**Step 4: Add the server-only admin client**

Create `src/lib/supabase/admin-server.ts` following the existing `server.ts` cookie adapter, but pass `cookieOptions: adminCookieOptions()` to `createServerClient`. Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; do not import the service role key.

**Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/admin-session.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/supabase/admin-cookie.ts src/lib/supabase/admin-server.ts tests/admin-session.test.ts
git commit -m "feat(admin): add isolated Supabase session"
```

### Task 2: Route admin requests through only the admin session

**Files:**
- Modify: `src/lib/supabase/proxy-session.ts`
- Create: `tests/proxy-session.test.ts`

**Step 1: Write failing proxy tests**

Mock `createServerClient` and use `NextRequest` for these cases:

1. `/admin` creates exactly one Supabase client with the admin cookie options, calls `getClaims()` to refresh it, and returns without redirecting when signed out.
2. `/admin/orgs` behaves the same; authorization is deferred to the page guard.
3. `/dashboard` creates the default client and redirects a signed-out request to `/login`.
4. `/dashboard` remains available when default claims exist.

Assert from the client-call options that an admin request never constructs the default application client.

**Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/proxy-session.test.ts`

Expected: FAIL because `/admin` still uses and depends on the default session.

**Step 3: Implement the admin branch**

In `updateSession`, inspect `request.nextUrl.pathname` before creating a client. For `/admin` and `/admin/*`, create the SSR client with `adminCookieOptions()`, immediately call `getClaims()` for refresh, and return the response regardless of claims. Keep the existing default-session redirect logic byte-for-byte equivalent for non-admin paths.

Ensure the cookie adapter copies refreshed values to both the mutable request and returned response, as the current implementation does.

**Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/proxy-session.test.ts tests/admin-session.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/supabase/proxy-session.ts tests/proxy-session.test.ts
git commit -m "fix(admin): isolate admin proxy session"
```

### Task 3: Make founder authorization use the admin session

**Files:**
- Modify: `src/modules/admin/auth.ts`
- Modify: `tests/admin-gate.test.ts`

**Step 1: Add failing authorization tests**

Mock `createAdminClient` and `next/navigation`. Cover:

- `getFounderContext()` returns a normalized context for allowlisted admin claims;
- it returns `null` for missing claims and valid non-founder users;
- `requireFounder()` returns the founder context when allowed;
- `requireFounder()` redirects unauthorized users to `/admin`;
- no default `createClient` import is used.

Keep the existing pure `isFounderEmail` coverage.

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/admin-gate.test.ts`

Expected: FAIL because the optional context does not exist and the required gate still calls `notFound()` on the default session.

**Step 3: Implement the two-level gate**

Replace the default Supabase client and `notFound` imports with `createAdminClient` and `redirect`. Implement:

```ts
export async function getFounderContext(): Promise<FounderContext | null> {
  const supabase = await createAdminClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!isFounderEmail(email, env.FOUNDER_EMAILS)) return null;
  return { email: email!.trim().toLowerCase() };
}

export async function requireFounder(): Promise<FounderContext> {
  const founder = await getFounderContext();
  if (!founder) redirect("/admin");
  return founder;
}
```

Update comments to describe the isolated session and stable login redirect.

**Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/admin-gate.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/admin/auth.ts tests/admin-gate.test.ts
git commit -m "fix(admin): authorize the isolated founder session"
```

### Task 4: Add safe founder email/password actions

**Files:**
- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/signout/route.ts`
- Create: `tests/admin-login-actions.test.ts`

**Step 1: Write failing action tests**

Mock `createAdminClient`, `env`, and `next/navigation`. Test that:

- blank or oversized input returns a validation error without contacting Supabase;
- invalid credentials return the same generic message as a non-founder account;
- an authenticated non-founder is immediately signed out from the admin client;
- an allowed founder redirects to `/admin` without signing out;
- an unexpected Supabase failure returns a safe error without leaking the thrown message;
- `POST /admin/signout` calls only the admin client's `signOut()` and redirects to `/admin`.

The generic authentication message must not reveal whether the account or allowlist entry exists.

**Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/admin-login-actions.test.ts`

Expected: FAIL because the action and route do not exist.

**Step 3: Implement the login action**

Create a server action with this public state shape:

```ts
export interface FounderLoginState {
  ok: false;
  message: string;
}
```

Read and trim `email`, accept a bounded non-empty `password`, and call
`signInWithPassword` on `createAdminClient()`. On an auth error or non-founder,
return `"Email or password is incorrect, or this account is not authorized."`.
If Supabase returned a user for a non-founder, call admin `signOut()` first.
On success call `redirect("/admin")`. Never catch the redirect exception.

**Step 4: Implement isolated sign-out**

Create `POST` in `src/app/admin/signout/route.ts`. Call the admin client's
`signOut()` and return a 302 redirect to `/admin`. Do not import the default
application client.

**Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/admin-login-actions.test.ts tests/admin-gate.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/signout/route.ts tests/admin-login-actions.test.ts
git commit -m "feat(admin): add founder email password login"
```

### Task 5: Render the founder login at `/admin`

**Files:**
- Create: `src/components/features/admin-shell/admin-login.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/features/admin-shell/admin-shell.tsx`
- Create: `tests/admin-login-ui.test.ts`

**Step 1: Write failing UI-boundary tests**

Use source-contract assertions, consistent with the existing Node-only UI
tests, to prove:

- the login form posts through `useActionState(loginFounderAction, ...)`;
- the form contains required email and password controls, autocomplete hints,
  pending state, an `aria-live` error region, and the real `/logo-mark.png`;
- the admin shell signs out through `/admin/signout`, not `/auth/signout`;
- the layout calls `getFounderContext` and does not call `newLeadsCount()` on
  its signed-out branch;
- the root page renders `AdminLogin` before overview queries when no founder is
  present.

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/admin-login-ui.test.ts`

Expected: FAIL because the admin login component and optional branches do not exist.

**Step 3: Build the login panel**

Use @frontend-design to create a restrained founder-operations entry screen:

- neutral/black primary controls with a small Nudge-green status accent;
- the real horizontal Nudge logo asset;
- one focused card, no marketing carousel and no customer-dashboard sidebar;
- explicit "Founder portal" label, email/password fields, and one sign-in CTA;
- visible keyboard focus, disabled/pending button, and non-color-only errors;
- responsive layout from 320 px upward and reduced-motion-safe transitions.

The client component should use:

```ts
const [state, formAction, pending] = useActionState(
  loginFounderAction,
  INITIAL_FOUNDER_LOGIN_STATE
);
```

Do not prefill credentials and do not offer signup.

**Step 4: Split signed-out and signed-in rendering safely**

In `src/app/admin/layout.tsx`, call `getFounderContext()` first. If it returns
`null`, render `children` inside `ToastProvider` without calling
`newLeadsCount()` or mounting `AdminShell`. Otherwise query the lead badge and
render the existing shell.

In `src/app/admin/page.tsx`, call `getFounderContext()` before parsing overview
inputs or starting data queries. Return `<AdminLogin />` for `null`; retain the
current overview for a founder.

Change the shell footer form action to `/admin/signout` and label it "Sign out
of founder portal".

**Step 5: Run the UI and related admin tests**

Run: `npx vitest run tests/admin-login-ui.test.ts tests/admin-gate.test.ts tests/admin-login-actions.test.ts tests/admin-actions.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/components/features/admin-shell/admin-login.tsx src/components/features/admin-shell/admin-shell.tsx src/app/admin/layout.tsx src/app/admin/page.tsx tests/admin-login-ui.test.ts
git commit -m "feat(admin): show isolated founder login at admin"
```

### Task 6: Verify the complete session-isolation story

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Run focused tests**

Run: `npx vitest run tests/admin-session.test.ts tests/proxy-session.test.ts tests/admin-gate.test.ts tests/admin-login-actions.test.ts tests/admin-login-ui.test.ts`

Expected: PASS.

**Step 2: Run repository verification**

Run: `npm test`

Expected: all test files pass.

Run: `npm run lint`

Expected: exit 0 with no errors.

Run: `npm run build`

Expected: successful production build with `/admin` and `/admin/signout` routes.

**Step 3: Browser-test both sessions**

Start the dev server and use @browser:control-in-app-browser to verify:

1. with the normal app signed in, `/admin` still shows the founder login;
2. invalid founder credentials show the safe inline error;
3. founder credentials open the control room;
4. opening `/dashboard` preserves the normal app identity;
5. founder sign-out returns to `/admin` and `/dashboard` remains signed in;
6. a signed-out direct visit to `/admin/orgs` returns to `/admin`;
7. responsive login layout works at mobile and desktop widths.

If valid founder credentials are unavailable in the local environment, verify
the signed-out and invalid-login flows in-browser and report the authenticated
flow as the one explicit manual check remaining.

**Step 4: Update progress**

Add a concise dated entry to `PROGRESS.md` describing the isolated admin cookie,
founder login page, allowlist gate, admin-only sign-out, and exact verification
results.

**Step 5: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: record isolated founder login"
```

**Step 6: Review and integrate**

Use @superpowers:requesting-code-review, address findings, rerun the affected
verification, then use @superpowers:finishing-a-development-branch to present
the safe merge/push options without touching unrelated main-worktree changes.
