# Adaptive Dashboard UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the authenticated app shell, owner dashboard, and first-run setup with the approved adaptive operations workspace.

**Architecture:** Keep routes thin and move deterministic navigation, workspace-profile, and attention-ranking logic into pure modules. Server pages retain org-scoped data access and pass serializable view models to focused client components only where interaction is required. Store shared onboarding answers in namespaced `Org.settings.workspaceProfile` data and personal display preferences in `Membership.uiPreferences`; neither can affect authorization or messaging behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma/Postgres, Vitest, Motion, Lucide React.

---

### Task 1: Define the grouped navigation contract

**Files:**

- Create: `tests/app-shell-nav.test.ts`
- Modify: `src/components/features/app-shell/nav.ts`

**Step 1: Write the failing tests**

Cover these behaviors:

```ts
it("puts the owner destinations in the approved stable group order", () => {
  expect(navGroupsForRole("OWNER").map((group) => [
    group.label,
    group.items.map((item) => item.label),
  ])).toEqual([
    ["Workspace", ["Today", "Inbox", "Leads"]],
    ["Automation", ["AI Front Desk", "Follow-ups", "Campaigns"]],
    ["Insights", ["Analytics"]],
    ["Manage", ["Integrations", "Settings"]],
  ]);
});

it.each([
  ["/inbox/thread-1", "inbox"],
  ["/templates", "campaigns"],
  ["/automations", "followups"],
  ["/integrations", "integrations"],
  ["/settings/voice", "settings"],
])("maps %s to the correct active item", (pathname, key) => {
  expect(activeNavKey(pathname)).toBe(key);
});
```

Also assert that the agent set excludes admin-only destinations and that mobile
core navigation is exactly Today, Inbox, Front Desk, Leads, More.

**Step 2: Run the tests and verify RED**

Run: `npm test -- tests/app-shell-nav.test.ts`

Expected: FAIL because grouped navigation helpers do not exist.

**Step 3: Implement the minimal navigation model**

Define `NavItem`, `NavGroup`, `NAV_GROUPS`, `navGroupsForRole`,
`mobileCoreItemsForRole`, `activeNavKey`, and `isNavItemActive`. Each item owns
its active route prefixes so deep routes do not depend on ad-hoc component code.

Use the approved labels and these route aliases:

- Campaigns also matches `/templates`.
- Settings matches all `/settings/*` routes.
- Follow-ups, Integrations, and Analytics match their top-level routes.

**Step 4: Run the focused and role tests**

Run: `npm test -- tests/app-shell-nav.test.ts tests/roles.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app-shell-nav.test.ts src/components/features/app-shell/nav.ts
git commit -m "feat: define adaptive app navigation"
```

### Task 2: Build the responsive app shell

**Files:**

- Create: `src/components/features/app-shell/brand-mark.tsx`
- Create: `src/components/features/app-shell/command-menu.tsx`
- Modify: `src/components/features/app-shell/sidebar.tsx`
- Modify: `src/components/features/app-shell/topbar.tsx`
- Modify: `src/components/features/app-shell/bottom-nav.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add a source-level shell contract test**

Extend `tests/app-shell-nav.test.ts` with pure assertions for the command list
and thread-route behavior. Keep rendering details for browser verification; do
not add a second component test stack solely for this change.

**Step 2: Run the test and verify RED**

Run: `npm test -- tests/app-shell-nav.test.ts`

Expected: FAIL on the missing command model/mobile contract.

**Step 3: Implement the desktop shell**

- Extract the reusable Nudge mark.
- Render a 232px light sidebar with grouped 44px rows.
- Add the active marker and separate text/icon cues.
- Show workspace name and test/live status at the top.
- Put Help, Customize workspace, account, and sign-out at the bottom.
- Support a 72px collapsed state with labelled tooltips.
- Pass organization name and member preferences from the server layout.

**Step 4: Implement the honest command menu**

Create a Cmd/Ctrl+K overlay with focus trapping, Escape close, and focus
restoration. Filter static destinations and actions locally. When the query does
not match a command, offer `Search leads for “…”` linking to `/contacts?q=...`;
do not describe it as universal record search.

**Step 5: Implement mobile navigation**

Render Today, Inbox, Front Desk, Leads, and More. More is a grouped full-width
sheet with a visible close button, 44px targets, safe-area padding, and the
existing inbox-thread exception.

**Step 6: Add shell accessibility and overflow foundations**

- Add a skip link targeting `#main-content`.
- Give the main region `tabIndex={-1}` and a stable id.
- Add global `prefers-reduced-motion` handling for app animations.
- Change the desktop content offset to the new sidebar width.
- Ensure `min-w-0` and `overflow-x-clip` prevent viewport overflow.

**Step 7: Run tests, lint the touched files, and commit**

Run: `npm test -- tests/app-shell-nav.test.ts tests/roles.test.ts`

Run: `npx eslint src/components/features/app-shell src/app/\(app\)/layout.tsx`

Expected: PASS with no warnings.

```bash
git add src/components/features/app-shell src/app/\(app\)/layout.tsx src/app/globals.css tests/app-shell-nav.test.ts
git commit -m "feat: redesign the responsive app shell"
```

### Task 3: Simplify settings navigation

**Files:**

- Create: `src/app/(app)/settings/settings-items.ts`
- Create: `tests/settings-nav.test.ts`
- Modify: `src/app/(app)/settings/settings-nav.tsx`
- Modify: `src/app/(app)/settings/layout.tsx`

**Step 1: Write the failing settings taxonomy test**

Assert that Follow-ups and Integrations are absent and that the remaining links
are grouped as:

- Workspace: General, Team, Concierge
- Channels & AI: WhatsApp, Voice, Agent actions, AI model, Website widget
- Account: Notifications, Billing, Data, Audit log

**Step 2: Run the test and verify RED**

Run: `npm test -- tests/settings-nav.test.ts`

Expected: FAIL because the current list is flat and duplicates top-level routes.

**Step 3: Implement grouped desktop and mobile settings navigation**

Use group labels on desktop. On mobile, render a labelled native select that
navigates to the selected settings route, eliminating the current 14-chip
horizontal strip.

**Step 4: Verify and commit**

Run: `npm test -- tests/settings-nav.test.ts tests/app-shell-nav.test.ts`

Expected: PASS.

```bash
git add src/app/\(app\)/settings tests/settings-nav.test.ts
git commit -m "feat: clarify settings navigation"
```

### Task 4: Add deterministic workspace profiles

**Files:**

- Create: `src/modules/dashboard/workspace-profile.ts`
- Create: `tests/workspace-profile.test.ts`
- Modify: `prisma/schema.prisma`

**Step 1: Write the failing profile tests**

Cover:

- allowed values for role, primary outcome, customer journey, team shape,
  connected systems, and guidance level;
- invalid/legacy JSON falling back safely;
- skip producing owner/operator defaults;
- deterministic answers producing ordered attention priorities and suggested
  shortcuts;
- merging `workspaceProfile` without removing `avgOrderValueInr` or other org
  settings.

The desired public API is:

```ts
parseWorkspaceProfile(settings: unknown): WorkspaceProfile
deriveWorkspaceDefaults(profile: WorkspaceProfile): WorkspaceDefaults
mergeWorkspaceProfile(settings: unknown, patch: WorkspaceProfilePatch): object
parseUiPreferences(value: unknown): UiPreferences
```

**Step 2: Run the test and verify RED**

Run: `npm test -- tests/workspace-profile.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Implement the pure model**

Use literal unions and explicit allowlists rather than runtime AI. Keep defaults
owner/operator, bookings, guided, and non-destructive. No profile field may map
to permission or messaging state.

**Step 4: Add membership preference storage**

Add:

```prisma
uiPreferences Json @default("{}")
```

to `Membership`, then run `npx prisma generate`. Do not alter any consent,
messaging, or role field.

**Step 5: Verify and commit**

Run: `npm test -- tests/workspace-profile.test.ts tests/org-scope.test.ts tests/roles.test.ts`

Expected: PASS.

```bash
git add prisma/schema.prisma src/modules/dashboard/workspace-profile.ts tests/workspace-profile.test.ts
git commit -m "feat: add deterministic workspace profiles"
```

### Task 5: Persist resumable onboarding safely

**Files:**

- Create: `tests/onboarding-actions.test.ts`
- Modify: `src/app/(app)/onboarding/actions.ts`
- Modify: `src/app/(app)/onboarding/page.tsx`
- Modify: `src/modules/dashboard/queries.ts`

**Step 1: Write failing action tests**

Mock `requireOrgContext` and Prisma following
`tests/agent-profile-auth.test.ts`. Verify:

- AGENT cannot change organization-wide onboarding answers;
- ADMIN/OWNER writes are scoped to `ctx.org.id` and `ctx.membership.id`;
- each partial save merges existing settings;
- invalid values do not write;
- completion records `onboardedAt` but does not activate an automation,
  integration, campaign, or send path.

**Step 2: Run the tests and verify RED**

Run: `npm test -- tests/onboarding-actions.test.ts`

Expected: FAIL because the partial-save action is missing.

**Step 3: Implement minimal server actions**

Add `saveWorkspaceProfileStepAction` and update completion. Validate all input
through the pure profile module, merge JSON, revalidate onboarding/dashboard,
and return a field-specific recovery message. Preserve `saveBusinessProfileAction`
for the business-details step.

**Step 4: Load resumable state**

Extend the onboarding snapshot with the parsed profile, UI preferences, and
last completed step. The query remains org-scoped; membership preferences come
from the authenticated membership, not a client-supplied identifier.

**Step 5: Verify and commit**

Run: `npm test -- tests/onboarding-actions.test.ts tests/workspace-profile.test.ts tests/dashboard.test.ts`

Expected: PASS.

```bash
git add src/app/\(app\)/onboarding src/modules/dashboard/queries.ts tests/onboarding-actions.test.ts
git commit -m "feat: persist personalized onboarding"
```

### Task 6: Build the animated questionnaire

**Files:**

- Modify: `src/app/(app)/onboarding/wizard.tsx`
- Modify: `src/app/(app)/onboarding/loading.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`

**Step 1: Define the UI from the tested profile schema**

Use the exported option arrays so labels and allowed values cannot drift from
server validation. The focused flow is:

1. role;
2. primary outcome;
3. customer journey;
4. team shape;
5. systems (multi-select);
6. guidance;
7. business details;
8. recommendation summary.

**Step 2: Implement progressive interaction**

- One question per view with large semantic buttons/cards.
- Back, Skip, and progress are always visible.
- Save before advancing and keep the choice locally on failure.
- Use Motion `AnimatePresence` with 180–240ms opacity/x transitions.
- Use `useReducedMotion` to replace directional movement with an immediate or
  short crossfade.
- Keep every control keyboard operable and at least 44px.

**Step 3: Implement the recommendation summary**

Render the deterministic priorities, shortcuts, and setup order. The primary
button confirms presentation defaults and enters Today. WhatsApp connection,
Teach your Front Desk, calendar connection, and opted-in contact import are
links/tasks, never auto-enabled operations.

**Step 4: Give onboarding a focused shell state**

On `/onboarding`, suppress the full desktop/mobile navigation while retaining
the Nudge mark, account access, skip link, and simulation status. This prevents
new users from landing in an uncurated cockpit before the summary.

**Step 5: Verify and commit**

Run: `npm test -- tests/onboarding-actions.test.ts tests/workspace-profile.test.ts`

Run: `npx eslint 'src/app/(app)/onboarding' src/components/features/app-shell/shell.tsx`

Expected: PASS with no warnings.

```bash
git add src/app/\(app\)/onboarding src/components/features/app-shell/shell.tsx
git commit -m "feat: add adaptive onboarding questionnaire"
```

### Task 7: Build the action-first dashboard view model

**Files:**

- Modify: `src/modules/dashboard/stats.ts`
- Modify: `src/modules/dashboard/queries.ts`
- Modify: `tests/dashboard.test.ts`

**Step 1: Write failing attention-ranking tests**

Test `buildAttentionQueue` with handoffs, owner questions, unread threads,
pending bookings, pending payments, incomplete setup, role, and workspace
priorities. Assert:

- urgent customer blockers rank first;
- chosen outcome breaks ties but never pushes an urgent handoff down;
- owner/admin-only destinations do not appear for AGENT;
- output is capped to four visible rows and exposes the total count;
- an empty input returns a stable positive state.

**Step 2: Run the test and verify RED**

Run: `npm test -- tests/dashboard.test.ts`

Expected: FAIL because attention queue helpers do not exist.

**Step 3: Implement pure view-model functions**

Add typed attention items and operational summary construction. Keep ranking
deterministic and clamp negative counts. Reuse existing formatting functions.

**Step 4: Extend org-scoped dashboard queries**

Fetch in the existing `Promise.all`:

- handoff and pending owner-question counts;
- today's scheduled bookings in the org timezone;
- pending booking count;
- created payment-request count and amount;
- existing recovery metrics or the underlying follow-up counts.

Never query without `orgId`. Treat missing/unavailable date data honestly.

**Step 5: Verify and commit**

Run: `npm test -- tests/dashboard.test.ts tests/org-scope.test.ts tests/analytics.test.ts`

Expected: PASS.

```bash
git add src/modules/dashboard tests/dashboard.test.ts
git commit -m "feat: rank dashboard attention and operations"
```

### Task 8: Redesign the Today page

**Files:**

- Create: `src/components/features/dashboard/attention-queue.tsx`
- Create: `src/components/features/dashboard/operations-summary.tsx`
- Create: `src/components/features/dashboard/front-desk-summary.tsx`
- Create: `src/components/features/dashboard/business-pulse.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/loading.tsx`

**Step 1: Wire the thin server page to the tested view model**

Keep all Prisma access in dashboard/follow-up query modules. The route only
loads context/data, computes display values, and composes feature components.

**Step 2: Build the vertical Today hierarchy**

Render in this order:

1. compact greeting/status and one primary action;
2. full-width Needs your attention queue;
3. Today's operations row;
4. plain-language AI Front Desk activity summary;
5. four-metric Business pulse;
6. setup progress only when incomplete;
7. recent conversations and campaigns as secondary lists.

Avoid masonry/bento layout. At 375px, all sections become one column and every
row wraps without viewport overflow.

**Step 3: Update loading and empty states**

Match the final section heights closely enough to avoid layout jumps. Always
render the attention section, using the positive state when empty.

**Step 4: Verify and commit**

Run: `npm test -- tests/dashboard.test.ts tests/app-shell-nav.test.ts`

Run: `npx eslint 'src/app/(app)/dashboard' src/components/features/dashboard src/modules/dashboard`

Expected: PASS with no warnings.

```bash
git add src/app/\(app\)/dashboard src/components/features/dashboard src/modules/dashboard tests/dashboard.test.ts
git commit -m "feat: make Today action first"
```

### Task 9: Document, verify, and integrate

**Files:**

- Modify: `PROGRESS.md`
- Modify: `docs/TESTING_ENTERPRISE.md`

**Step 1: Document the delivered workflow**

Add a dated progress entry and manual checks for owner onboarding, agent role,
desktop collapse, command menu, mobile More sheet, and Today attention actions.

**Step 2: Run complete automated verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run lint`

Expected: exit 0 with no errors.

Run: `npm run build`

Expected: production build completes.

**Step 3: Run browser verification**

Verify owner and agent sessions at 375, 768, 1024, and 1440px. Check:

- no viewport horizontal overflow;
- every deep route has an active parent;
- Cmd/Ctrl+K, Escape, focus trap, and focus restoration;
- onboarding resume and autosave failure recovery;
- reduced-motion behavior;
- Today hierarchy and action destinations;
- simulation status and no live operational activation.

**Step 4: Commit documentation**

```bash
git add PROGRESS.md docs/TESTING_ENTERPRISE.md
git commit -m "docs: record adaptive dashboard verification"
```

**Step 5: Review and integrate**

Review the branch diff for scope, rerun `git status --short`, and merge only
after the user's main worktree is confirmed clean. Do not overwrite unrelated
changes that appeared while implementation was in progress.
