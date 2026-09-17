# Founder Sign-in Password Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an accessible show/hide password control to the founder sign-in form.

**Architecture:** Keep the change inside the existing client-side `AdminLogin` component. A local boolean state controls the password input type and the eye button's icon and accessible label; authentication, cookies, and server actions remain unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Lucide React, Vitest

---

### Task 1: Add the password visibility control

**Files:**
- Modify: `tests/admin-login-ui.test.ts`
- Modify: `src/components/features/admin-shell/admin-login.tsx`

**Step 1: Write the failing test**

Extend the founder-login form test with source-level assertions matching the existing test style:

```ts
expect(loginSource).toContain("useState(false)");
expect(loginSource).toContain('type={passwordVisible ? "text" : "password"}');
expect(loginSource).toContain('type="button"');
expect(loginSource).toContain('aria-label={passwordVisible ? "Hide password" : "Show password"}');
expect(loginSource).toContain("setPasswordVisible((visible) => !visible)");
expect(loginSource).toContain("EyeOff");
expect(loginSource).toContain("Eye");
```

**Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run tests/admin-login-ui.test.ts
```

Expected: FAIL because the login component has no password visibility state or control.

**Step 3: Implement the minimal control**

In `admin-login.tsx`:

- import `useState` from React;
- import `Eye` and `EyeOff` from Lucide;
- create `const [passwordVisible, setPasswordVisible] = useState(false);`;
- wrap the password input in a positioned container;
- set its type to `passwordVisible ? "text" : "password"` and add right padding;
- add a non-submitting eye button that toggles the state, changes its accessible label, reflects the pressed state, and is disabled while sign-in is pending.

The button shape is:

```tsx
<button
  type="button"
  onClick={() => setPasswordVisible((visible) => !visible)}
  disabled={pending}
  aria-label={passwordVisible ? "Hide password" : "Show password"}
  aria-pressed={passwordVisible}
>
  {passwordVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
</button>
```

**Step 4: Run the focused tests**

Run:

```bash
npm test -- --run tests/admin-login-ui.test.ts tests/admin-login-actions.test.ts
```

Expected: 2 test files pass; the server-side founder login behavior remains unchanged.

**Step 5: Run repository verification**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit successfully. Existing dependency audit warnings are not part of this UI-only change.

**Step 6: Commit the implementation**

```bash
git add tests/admin-login-ui.test.ts src/components/features/admin-shell/admin-login.tsx
git commit -m "feat(admin): add password visibility toggle"
```
