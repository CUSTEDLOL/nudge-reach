# WWW Domain Redirect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permanently redirect every `www.nudgeagent.app` request to the same path on `https://nudgeagent.app` so Google receives one unambiguous canonical hostname.

**Architecture:** Add one host-scoped rule to the existing Next.js `redirects()` configuration. Cover the configuration contract with a focused Vitest test, retain the existing `/waitlist` redirect, then verify both the production build and live HTTP behavior after deployment.

**Tech Stack:** Next.js 16 redirect configuration, TypeScript, Vitest, Vercel

---

### Task 1: Lock the redirect behavior with a failing test

**Files:**
- Create: `tests/domain-redirect.test.ts`
- Read: `next.config.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("canonical hostname redirects", () => {
  it("permanently redirects every www path to the apex hostname", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({
      source: "/:path*",
      has: [{ type: "host", value: "www.nudgeagent.app" }],
      destination: "https://nudgeagent.app/:path*",
      permanent: true,
    });
  });

  it("retains the retired waitlist redirect", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({
      source: "/waitlist",
      destination: "/",
      permanent: true,
    });
  });
});
```

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/domain-redirect.test.ts`

Expected: one failure because the host-scoped redirect does not exist; the `/waitlist` assertion passes.

**Step 3: Commit the red test**

```bash
git add tests/domain-redirect.test.ts
git commit -m "test(seo): define canonical hostname redirect"
```

### Task 2: Add the minimal hostname redirect

**Files:**
- Modify: `next.config.ts:32-39`
- Test: `tests/domain-redirect.test.ts`

**Step 1: Add the redirect before the existing path redirect**

```ts
async redirects() {
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.nudgeagent.app" }],
      destination: "https://nudgeagent.app/:path*",
      permanent: true,
    },
    { source: "/waitlist", destination: "/", permanent: true },
  ];
},
```

**Step 2: Run the focused test**

Run: `npm test -- tests/domain-redirect.test.ts`

Expected: 2 tests pass.

**Step 3: Run type checking**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

**Step 4: Commit the implementation**

```bash
git add next.config.ts
git commit -m "fix(seo): redirect www traffic to canonical domain"
```

### Task 3: Record and verify the release

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Add a concise progress entry**

Record the canonical hostname decision, test coverage, and the fact that Google Search Console may retain the old URLs until it recrawls them.

**Step 2: Run the complete verification suite**

Run: `npm test`

Expected: all tests pass.

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

Run: `npm run build`

Expected: production build completes successfully.

**Step 3: Commit the progress entry**

```bash
git add PROGRESS.md
git commit -m "docs(seo): record canonical domain consolidation"
```

### Task 4: Publish and verify production

**Files:**
- No source files changed

**Step 1: Confirm the branch and intended commits**

Run: `git status --short && git log -5 --oneline`

Expected: only the user's pre-existing untracked proposal artifacts remain; the SEO design, plan, test, configuration, and progress commits are visible on `main`.

**Step 2: Push `main`**

Run: `git push origin main`

Expected: `origin/main` advances to the verified SEO commit.

**Step 3: Deploy the verified commit to production**

Run: `npx vercel --prod --yes`

Expected: Vercel reports a Ready production deployment and aliases `nudgeagent.app`.

**Step 4: Verify live redirect behavior**

Run: `curl -I -sS https://www.nudgeagent.app/`

Expected: permanent redirect status with `location: https://nudgeagent.app/`.

Run: `curl -I -sS https://www.nudgeagent.app/privacy`

Expected: permanent redirect status with `location: https://nudgeagent.app/privacy`.

Run: `curl -I -sS https://nudgeagent.app/privacy`

Expected: HTTP 200.

**Step 5: Confirm branch synchronization**

Run: `git rev-list --left-right --count origin/main...main`

Expected: `0 0`.
