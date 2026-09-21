# Free Trial Guided Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the focused `/free-trial` acquisition page and a simple four-destination trial workspace with short knowledge setup, an inline test inbox, locked feature previews, a persistent checklist, and a real route-aware product tour.

**Architecture:** The public page creates the pending claim from Plan 1, then sends the password directly to Supabase Auth with the claim in user metadata. Authenticated acquisition trials use the existing app and agent path, but the shared shell switches to a trial navigation model. Server-derived trial state drives setup, checklist, locks, and the tour; client state is presentation-only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Auth, Prisma, Lucide, Vitest (Node environment)

**Spec:** `docs/plans/2026-09-20-free-trial-funnel-design.md`

## Global Constraints

- Complete the foundation plan first; do not duplicate its trial state, claim, knowledge, capability, or reply-limit rules.
- Keep the experience visually simple: one primary action per screen, short copy, no autoplay video, carousel, or animated marketing spectacle.
- The trial has exactly four top-level destinations: Home, Train AI, Test Inbox, and Explore.
- All visible reply counts and expiry states come from the server; local counters are never authoritative.
- The walkthrough is a true coach-mark tour anchored to real controls and is paired with a persistent checklist.
- Locked previews never imply that real WhatsApp, campaigns, follow-ups, calendar actions, payments, CRM writes, or voice work in the trial.
- Locked preview CTAs lead to “Book a free demo” first and “See paid plans” second.
- Do not add a second fake dashboard, fake AI engine, or duplicate inbox model.
- Maintain keyboard access, focus visibility, reduced-motion behavior, and mobile bottom-sheet presentation.
- Do not edit or stage unrelated worktree changes.

## Review Focus

- The password must never be included in `POST /api/trials`, analytics, logs, attribution, or Prisma data; Task 1 pins the request shape.
- An acquisition-trial account must land at `/trial/setup`, while paid/invited users keep the existing `/onboarding` behavior; Task 2 covers both paths.
- Direct navigation to a locked page must resolve to `/explore` and all paid mutations remain server-blocked by the foundation; Task 4 covers route presentation.
- The tour must resume from its server-stored step after refresh and route changes; Task 6 tests that persistence and missing-target fallback.
- Sending a test message must keep the user on the test screen, show both messages, and display the server-returned allowance; Task 5 covers the inline flow.

---

### Task 1: Focused clinic landing page and secure signup handoff

**Files:**
- Create: `src/app/free-trial/page.tsx`
- Create: `src/app/free-trial/trial-signup-form.tsx`
- Create: `src/components/marketing/free-trial-sections.tsx`
- Create: `src/modules/trial/browser-signup.ts`
- Modify: `src/modules/marketing/analytics.ts`
- Modify: `src/modules/marketing/seo-pages.ts`
- Create: `tests/free-trial-page.test.ts`
- Modify: `tests/marketing-analytics.test.ts`

**Interfaces:**
- Consumes: `POST /api/trials`, `captureAttribution`, browser Supabase client.
- Produces: public `/free-trial`, `trial_signup_started`, `trial_signup_completed`, and `trial_signup_failed` browser events.

- [ ] **Step 1: Write failing page and request-boundary tests**

Create `tests/free-trial-page.test.ts` with source-contract assertions for:

```ts
expect(rendered).toContain("Try Nudge on your clinic's real questions");
expect(rendered).toContain("7 days or 15 AI replies");
expect(rendered).toContain("No card required");
expect(rendered).toContain("Official WhatsApp API");
expect(rendered).toContain("Book a free demo");
expect(rendered).not.toContain("blast");
```

Export `trialIntakePayload` and `trialAuthCredentials` from
`browser-signup.ts` and unit-test the split request objects:

```ts
const intake = trialIntakePayload(form, attribution);
expect(JSON.stringify(intake)).not.toContain("secret-password");
expect(trialAuthCredentials(form, "https://nudge.test", claim)).toEqual({
  email: "owner@aster.in",
  password: "secret-password",
  options: {
    emailRedirectTo: "https://nudge.test/auth/confirm?next=/trial/setup",
    data: {
      acquisition_trial_id: "trial_1",
      acquisition_trial_token: "opaque-claim-token",
    },
  },
});
```

Use `readFileSync` assertions for consent being unchecked by default,
short-password validation, the hidden honeypot, the `aria-live` region, and the
branch that navigates a returned session directly to `/trial/setup`. Vitest is
Node-only in this repository; do not add jsdom or another test runner.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run tests/free-trial-page.test.ts tests/marketing-analytics.test.ts`

Expected: FAIL because the page, form, and trial event variants do not exist.

- [ ] **Step 3: Extend the bounded marketing event union**

Add these variants to `MarketingEvent` without including email, phone, business name, claim token, or free text:

```ts
type TrialSurface = "free_trial" | "trial_setup" | "trial_workspace";

| { event: "trial_signup_started"; surface: TrialSurface }
| { event: "trial_signup_completed"; surface: TrialSurface }
| { event: "trial_signup_failed"; surface: TrialSurface; reason: "validation" | "intake" | "auth" }
| { event: "trial_demo_click"; surface: TrialSurface }
| { event: "trial_checkout_click"; surface: TrialSurface; plan_id: "entry" | "starter" | "growth" | "pro" }
```

Add analytics tests proving the event object is copied to `dataLayer` and contains no contact fields.

- [ ] **Step 4: Build the signup handoff**

The client submission order is exact:

```ts
const attribution = captureAttribution(
  new URL(window.location.href),
  document.referrer,
  window.localStorage,
  document.cookie
);
pushMarketingEvent({ event: "trial_signup_started", surface: "free_trial" });
const intake = trialIntakePayload(formState, attribution);
const response = await fetch("/api/trials", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(intake),
});
const result: TrialIntakeResponse = await response.json();
if (!response.ok || !result.ok) throw new IntakeError(result.error);

const supabase = createClient();
const credentials = trialAuthCredentials(
  formState,
  window.location.origin,
  result.claim
);
const { data, error } = await supabase.auth.signUp(credentials);
if (error) throw new AuthError(error.message);
pushMarketingEvent({ event: "trial_signup_completed", surface: "free_trial" });
if (data.session) {
  router.push("/trial/setup");
  router.refresh();
} else {
  setConfirmationEmail(email);
}
```

Keep the password only in component state and the Supabase call. Clear it after success. Map 409 intake errors to “A trial already exists—sign in to continue” with a `/login` link. Use an `aria-live="polite"` status region for errors and the confirmation message.

- [ ] **Step 5: Build the landing page composition**

Use the existing marketing header/footer/button primitives. Render, in order:

1. Clinic-specific hero: “Try Nudge on your clinic’s real questions.”
2. Compact offer row: “7 days or 15 AI replies · No card required · Safe test workspace.”
3. The signup form above the fold on desktop and immediately below the hero on mobile.
4. Three-step explanation: teach it, test it, see what the full Front Desk does.
5. A simple product-frame preview showing Train AI, Test Inbox, and locked actions.
6. “What the full AI Front Desk runs” using the three moats: real actions, lead chasing, done-for-you setup.
7. FAQ covering limits, data retention, no real WhatsApp connection, official Meta API, and what happens after expiry.
8. Final signup CTA and secondary `BookDemoButton`.

Do not use unverified savings or conversion claims. Set metadata:

```ts
export const metadata: Metadata = {
  title: "Free AI Front Desk Trial for Clinics | Nudge",
  description: "Teach Nudge about your clinic and test up to 15 grounded AI replies in a safe workspace. No card required.",
  alternates: { canonical: "/free-trial" },
  openGraph: { url: "/free-trial", type: "website" },
};
```

- [ ] **Step 6: Add the canonical page to the sitemap and run tests**

Add `/free-trial` as an indexable marketing page in `seo-pages.ts` and assert it once in the existing SEO test.

Run: `npx vitest run tests/free-trial-page.test.ts tests/marketing-analytics.test.ts tests/seo-content-calendar.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the acquisition page**

```bash
git add src/app/free-trial src/components/marketing/free-trial-sections.tsx src/modules/trial/browser-signup.ts src/modules/marketing/analytics.ts src/modules/marketing/seo-pages.ts tests/free-trial-page.test.ts tests/marketing-analytics.test.ts tests/seo-content-calendar.test.ts
git commit -m "feat(trial): add focused clinic trial landing"
```

### Task 2: Short trial setup and paid-onboarding separation

**Files:**
- Create: `src/modules/trial/workspace.ts`
- Create: `src/app/(app)/trial/setup/page.tsx`
- Create: `src/app/(app)/trial/setup/actions.ts`
- Create: `src/app/(app)/trial/setup/trial-setup.tsx`
- Create: `src/components/features/trial/trial-training.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/onboarding/page.tsx`
- Modify: `src/app/(app)/agent/page.tsx`
- Create: `tests/trial-workspace.test.ts`
- Create: `tests/trial-setup.test.ts`
- Modify: `tests/dashboard-page-contract.test.ts`

**Interfaces:**
- Produces: `getTrialWorkspace(orgId, now?)`, `requireAcquisitionTrial(orgId)`, `completeTrialSetupAction()`, and `/trial/setup`.
- Consumes: foundation trial status/reply summary, existing import/approve actions, questionnaire script, `Org.onboardedAt`.

- [ ] **Step 1: Write failing workspace and routing tests**

Test the server projection, not raw Prisma rows:

```ts
expect(await getTrialWorkspace("org_1", now)).toEqual(expect.objectContaining({
  id: "trial_1",
  status: "active",
  repliesUsed: 0,
  replyLimit: 15,
  repliesRemaining: 15,
  setupComplete: false,
  knowledgeSource: null,
  tourStep: "welcome",
}));
```

Add page tests proving an unconverted acquisition trial at `/dashboard` redirects to `/trial/setup` until `Org.onboardedAt` is set, then renders the trial dashboard; a normal empty org still redirects to `/onboarding`; and `/onboarding` redirects acquisition trials to `/trial/setup`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-workspace.test.ts tests/trial-setup.test.ts tests/dashboard-page-contract.test.ts`

Expected: FAIL because the trial projection and setup route do not exist.

- [ ] **Step 3: Implement the single server projection**

Return only UI-safe fields:

```ts
export interface TrialWorkspace {
  id: string;
  status: TrialStatus;
  expiresAt: string | null;
  repliesUsed: number;
  replyLimit: number;
  repliesRemaining: number;
  setupComplete: boolean;
  knowledgeSource: string | null;
  knowledgeReady: boolean;
  firstReplyAt: string | null;
  exploreViewed: boolean;
  tourStep: TrialTourStep;
  tourCompleted: boolean;
  tourDismissed: boolean;
  demoBooked: boolean;
  converted: boolean;
}
```

`getTrialWorkspace` queries by unique `orgId`, selects the org subscription,
`onboardedAt`, and `exploreViewedAt`, counts active knowledge entries, derives
status through `deriveTrialStatus`, and computes `Math.max(0, replyLimit -
repliesUsed)`. `requireAcquisitionTrial` throws `notFound()` when the relation
is absent or converted.

- [ ] **Step 4: Add a dedicated three-step setup**

The setup UI has exactly these screens:

1. “Teach Nudge about your clinic” with four mutually exclusive source cards: Website, Google Business Profile, File, or Answer 5 questions.
2. For imports, show existing draft facts with approve/discard and one “Approve all and continue” action. For the interview, render the five `TRIAL_INTERVIEW_IDS` prompts in one compact form and submit once through `submitQuestionnaireAction`.
3. “Ready to test” showing the learned-fact count and a single “Open my trial” button.

`completeTrialSetupAction` must admin-gate, verify the org has an unconverted acquisition trial and at least one active knowledge entry, enable/upsert the existing agent profile, set `Org.onboardedAt`, revalidate `/dashboard`, and redirect there. It must not connect WhatsApp, create contacts, seed fake business facts, or mark unanswered profile questions complete.

When an acquisition trial later opens `/agent`, render `TrialTraining` instead
of the standard import/questionnaire composition. It shows the approved fact
library, manual add/edit controls, the source already used, and “Test your AI.”
It does not offer a second import or the 20-question questionnaire. Paid users
keep the current Agent page unchanged.

- [ ] **Step 5: Keep shell and onboarding behavior separate**

Add a minimal header-only shell branch for `pathname === "/trial/setup"`, matching the existing `/onboarding` treatment. In `dashboard/page.tsx`, perform the trial projection before the generic onboarding decision:

```ts
const trial = await getTrialWorkspace(org.id, now);
if (trial && !trial.setupComplete && !trial.converted) redirect("/trial/setup");
```

In `/onboarding`, redirect an unconverted acquisition trial to `/trial/setup`; do not change paid/invited org behavior.

- [ ] **Step 6: Run setup and existing onboarding tests**

Run: `npx vitest run tests/trial-workspace.test.ts tests/trial-setup.test.ts tests/dashboard-page-contract.test.ts tests/onboarding-actions.test.ts tests/onboarding-ui-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the short setup**

```bash
git add src/modules/trial/workspace.ts src/app/'(app)'/trial/setup src/components/features/trial/trial-training.tsx src/components/features/app-shell/shell.tsx src/app/'(app)'/dashboard/page.tsx src/app/'(app)'/onboarding/page.tsx src/app/'(app)'/agent/page.tsx tests/trial-workspace.test.ts tests/trial-setup.test.ts tests/dashboard-page-contract.test.ts
git commit -m "feat(trial): add short knowledge setup"
```

### Task 3: Trial navigation and persistent status strip

**Files:**
- Modify: `src/components/features/app-shell/nav.ts`
- Modify: `src/components/features/app-shell/shell.tsx`
- Modify: `src/components/features/app-shell/sidebar.tsx`
- Modify: `src/components/features/app-shell/topbar.tsx`
- Modify: `src/components/features/app-shell/bottom-nav.tsx`
- Modify: `src/components/features/app-shell/command-menu.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/components/features/trial/trial-status-strip.tsx`
- Modify: `tests/app-shell-nav.test.ts`
- Create: `tests/trial-shell.test.ts`

**Interfaces:**
- Produces: `AppShellMode = "standard" | "trial"`, `TRIAL_NAV_ITEMS`, and `TrialStatusStrip`.
- Consumes: `getTrialWorkspace` in the authenticated layout.

- [ ] **Step 1: Write failing navigation tests**

```ts
expect(navItemsForMode("trial").map(item => [item.label, item.href])).toEqual([
  ["Home", "/dashboard"],
  ["Train AI", "/agent"],
  ["Test Inbox", "/inbox/try"],
  ["Explore", "/explore"],
]);
expect(navItemsForMode("trial").some(item => item.href === "/campaigns")).toBe(false);
```

Use the pure navigation functions plus `readFileSync` contract assertions to
cover all four destinations, `data-tour` targets, “Safe test workspace,” reply
remainder, and days/time remaining. Assert `navGroupsForRole` remains unchanged
for `mode="standard"`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/app-shell-nav.test.ts tests/trial-shell.test.ts`

Expected: FAIL because shell mode does not exist.

- [ ] **Step 3: Define one navigation source for all shell surfaces**

Add:

```ts
export type AppShellMode = "standard" | "trial";

export const TRIAL_NAV_ITEMS = [
  { key: "today", label: "Home", mobileLabel: "Home", href: "/dashboard", icon: House, activePrefixes: ["/dashboard"] },
  { key: "front-desk", label: "Train AI", mobileLabel: "Train", href: "/agent", icon: Bot, activePrefixes: ["/agent", "/knowledge"] },
  { key: "inbox", label: "Test Inbox", mobileLabel: "Test", href: "/inbox/try", icon: Inbox, activePrefixes: ["/inbox/try"] },
  { key: "integrations", label: "Explore", mobileLabel: "Explore", href: "/explore", icon: Blocks, activePrefixes: ["/explore"] },
] satisfies readonly NavItem[];
```

Make sidebar, bottom navigation, command menu, and topbar receive the mode and derive from `navItemsForMode(mode, role)`. Do not fork their markup into trial-only copies. Put `data-tour="nav-home"`, `nav-train`, `nav-test`, and `nav-explore` on the real links.

- [ ] **Step 4: Add the authoritative status strip**

`TrialStatusStrip` receives the serializable `TrialWorkspace` and renders:

```txt
Free trial · 12 of 15 replies left · Ends 27 Sep
```

For exhausted/expired states, replace the text with a short stop reason and show `BookDemoButton` as the primary action plus `/pricing` as the secondary link. For active state, do not add an upgrade button to every screen. Include `aria-live="polite"` on the usage text.

- [ ] **Step 5: Wire mode once in the authenticated layout**

Fetch `getTrialWorkspace(org.id)` alongside current shell data. Pass `mode="trial"` and `trial={trial}` only for an unconverted acquisition trial. Standard users receive no extra shell queries beyond the indexed unique lookup and retain the existing navigation.

- [ ] **Step 6: Run navigation tests**

Run: `npx vitest run tests/app-shell-nav.test.ts tests/trial-shell.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit trial shell mode**

```bash
git add src/components/features/app-shell src/components/features/trial/trial-status-strip.tsx src/app/'(app)'/layout.tsx tests/app-shell-nav.test.ts tests/trial-shell.test.ts
git commit -m "feat(trial): simplify trial workspace navigation"
```

### Task 4: Trial home, checklist, Explore previews, and direct-route handling

**Files:**
- Create: `src/modules/trial/checklist.ts`
- Create: `src/modules/trial/routes.ts`
- Create: `src/components/features/trial/trial-home.tsx`
- Create: `src/components/features/trial/trial-checklist.tsx`
- Create: `src/components/features/trial/locked-feature-card.tsx`
- Create: `src/components/features/trial/upgrade-dialog.tsx`
- Create: `src/app/(app)/explore/page.tsx`
- Create: `src/app/(app)/explore/mark-viewed.tsx`
- Create: `src/app/(app)/trial/actions.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/lib/supabase/proxy-session.ts`
- Modify: `src/app/(app)/layout.tsx`
- Create: `tests/trial-checklist.test.ts`
- Create: `tests/trial-routes.test.ts`
- Create: `tests/trial-explore.test.ts`

**Interfaces:**
- Produces: `buildTrialChecklist(workspace)`, `isTrialWorkspacePath(pathname)`, `markTrialExploreViewedAction()`, trial Home, and `/explore`.
- Consumes: server `TrialWorkspace`, proxy-injected trusted request pathname, `BookDemoButton`, paid pricing link.

- [ ] **Step 1: Write failing checklist and route tests**

```ts
expect(buildTrialChecklist(workspace).map(item => [item.key, item.done])).toEqual([
  ["teach", true],
  ["test", false],
  ["explore", false],
  ["demo", false],
]);

expect(isTrialWorkspacePath("/dashboard")).toBe(true);
expect(isTrialWorkspacePath("/trial/setup")).toBe(true);
expect(isTrialWorkspacePath("/agent")).toBe(true);
expect(isTrialWorkspacePath("/inbox/try")).toBe(true);
expect(isTrialWorkspacePath("/explore")).toBe(true);
expect(isTrialWorkspacePath("/campaigns")).toBe(false);
expect(isTrialWorkspacePath("/settings/billing")).toBe(true);
```

Billing remains reachable as the paid-plan destination; every other standard workspace page is previewed through Explore.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-checklist.test.ts tests/trial-routes.test.ts tests/trial-explore.test.ts`

Expected: FAIL because the trial dashboard and Explore route are missing.

- [ ] **Step 3: Build the concise trial Home**

Branch in `dashboard/page.tsx` immediately after setup routing. `TrialHome` contains only:

- Welcome sentence using business name.
- Progress card with trial expiry and replies remaining.
- Persistent four-item checklist with links to real destinations; Explore is
  done only after `exploreViewedAt` has been stamped.
- One primary “Test your AI” action.
- Two compact proof cards: learned fact count and completed test conversations.
- A bottom conversion panel with “Book a free demo” primary and “See paid plans” secondary.

Do not render the standard attention queue, revenue widgets, campaign activity, or operational zero states for acquisition trials.

- [ ] **Step 4: Build locked previews in Explore**

Render a responsive grid in this order:

1. Connect your WhatsApp number.
2. Calendar booking.
3. Follow up with quiet leads.
4. Payment links.
5. Campaigns to opted-in customers.
6. CRM sync.
7. Voice Front Desk.

Every card uses a real product description, a centered lock badge, `aria-describedby` explaining why it is locked, and one “Unlock this” button. The button opens `UpgradeDialog` with that feature name, `BookDemoButton` primary, `/pricing` secondary, and a close button. It must not navigate to or invoke the locked mutation.

Mount `MarkExploreViewed` on the page. Its one effect calls
`markTrialExploreViewedAction`, which uses org-scoped `updateMany` with
`exploreViewedAt: null`, then revalidates `/dashboard`. Repeated visits are a
no-op; the client sends no trial id.

- [ ] **Step 5: Add trusted-path handling for direct URLs**

In the Supabase proxy, overwrite a request header rather than trusting an incoming value:

```ts
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-nudge-pathname", request.nextUrl.pathname);
// pass requestHeaders through NextResponse.next({ request: { headers: requestHeaders } })
```

In the authenticated app layout, read `x-nudge-pathname` through `headers()`. If the workspace is an unconverted acquisition trial and `isTrialWorkspacePath(pathname)` is false, redirect to `/explore?feature=<encoded-first-segment>`. This is a presentation boundary; the foundation’s mutation gates remain the security boundary.

- [ ] **Step 6: Run route, UI, and proxy regression tests**

Run: `npx vitest run tests/trial-checklist.test.ts tests/trial-routes.test.ts tests/trial-explore.test.ts tests/proxy-session.test.ts tests/dashboard-page-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the trial Home and previews**

```bash
git add src/modules/trial/checklist.ts src/modules/trial/routes.ts src/components/features/trial src/app/'(app)'/trial/actions.ts src/app/'(app)'/explore src/app/'(app)'/dashboard/page.tsx src/lib/supabase/proxy-session.ts src/app/'(app)'/layout.tsx tests/trial-checklist.test.ts tests/trial-routes.test.ts tests/trial-explore.test.ts tests/proxy-session.test.ts
git commit -m "feat(trial): add guided home and locked previews"
```

### Task 5: Inline test inbox using the real simulated agent path

**Files:**
- Modify: `src/app/(app)/inbox/try/page.tsx`
- Modify: `src/app/(app)/inbox/try/try-your-ai.tsx`
- Create: `src/components/features/trial/test-conversation.tsx`
- Create: `src/modules/trial/test-inbox.ts`
- Modify: `src/app/(app)/inbox/actions.ts`
- Create: `tests/trial-test-inbox.test.ts`
- Modify: `tests/inbox.test.ts`

**Interfaces:**
- Consumes: `simulateInboundAction`, `/api/inbox/[id]/messages`, foundation reply summary.
- Produces: inline conversation state for acquisition trials; standard workspaces keep the current redirect-to-thread behavior.

- [ ] **Step 1: Write failing inline-flow tests**

Test the pure `reduceTrialTestInbox` state transition used by the component:

```ts
const sent = reduceTrialTestInbox(initial, {
  type: "sent",
  body: "Are you open Sunday?",
});
const replied = reduceTrialTestInbox(sent, {
  type: "snapshot",
  messages: [customerMessage, aiMessage],
  trial: { status: "active", repliesRemaining: 14 },
});
expect(replied.messages.map(message => message.body)).toEqual([
  "Are you open Sunday?",
  "We are closed on Sunday.",
]);
expect(replied.repliesRemaining).toBe(14);
```

Add pure exhausted and expired cases where `composerEnabled` is false. Use
`readFileSync` assertions for “Your private test inbox,” the `aria-live`
region, demo/plans actions, and the standard-workspace branch that redirects
to `/inbox/:id`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-test-inbox.test.ts tests/inbox.test.ts`

Expected: FAIL because the tester always redirects.

- [ ] **Step 3: Return enough authoritative action data**

Extend the foundation action result with no raw model metadata:

```ts
export interface ActionResult {
  ok: boolean;
  message: string;
  conversationId?: string;
  skipped?: "no_profile" | "disabled" | "trial_limit";
  trial?: TrialReplySummary;
}
```

After a successful simulated reply, set `firstReplyAt` with `updateMany({ where: { id, firstReplyAt: null } })` and return the fresh summary. Do not return the assistant reply from the action; the client reads the org-scoped thread snapshot endpoint so the tester and real inbox share one source.

- [ ] **Step 4: Render a fixed mock identity and inline thread**

For acquisition trials, hide the editable phone input and use the deterministic per-org sandbox identity returned by the server, displayed as “Test customer · private simulation.” After the action returns `conversationId`, fetch `/api/inbox/${conversationId}/messages`, map inbound messages to customer bubbles and outbound messages to Nudge bubbles, and keep the composer on the page.

Use `aria-live="polite"` for the new assistant reply and move focus only when the user explicitly uses keyboard submit. Disable starter chips and the composer while sending or once status is expired/exhausted.

- [ ] **Step 5: Keep paid behavior unchanged**

Pass `trial={trial ?? null}` from the page. If null, retain the current editable test number and `router.push('/inbox/' + conversationId)` behavior. Do not apply the 15-reply UI to legacy billing trials; only acquisition trials receive it.

- [ ] **Step 6: Run inbox and agent-path tests**

Run: `npx vitest run tests/trial-test-inbox.test.ts tests/inbox.test.ts tests/agent.test.ts tests/model-guard.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the inline trial inbox**

```bash
git add src/app/'(app)'/inbox/try src/app/'(app)'/inbox/actions.ts src/components/features/trial/test-conversation.tsx src/modules/trial/test-inbox.ts tests/trial-test-inbox.test.ts tests/inbox.test.ts
git commit -m "feat(trial): keep test replies in guided inbox"
```

### Task 6: Route-aware coach-mark tour with server persistence

**Files:**
- Create: `src/modules/trial/tour.ts`
- Modify: `src/app/(app)/trial/actions.ts`
- Create: `src/components/features/trial/trial-tour.tsx`
- Modify: `src/components/features/app-shell/shell.tsx`
- Modify: `src/components/features/trial/trial-home.tsx`
- Modify: `src/app/(app)/agent/page.tsx`
- Modify: `src/app/(app)/inbox/try/try-your-ai.tsx`
- Modify: `src/app/(app)/explore/page.tsx`
- Create: `tests/trial-tour.test.ts`
- Create: `tests/trial-tour-actions.test.ts`

**Interfaces:**
- Produces: `TRIAL_TOUR_STEPS`, `saveTrialTourStepAction(step)`, `dismissTrialTourAction()`, `completeTrialTourAction()`, and `TrialTour`.
- Consumes: stable `data-tour` markers on real UI elements and server `TrialWorkspace` state.

- [ ] **Step 1: Write failing tour-state and presentation tests**

Pin the ordered route-aware definition:

```ts
expect(TRIAL_TOUR_STEPS).toEqual([
  expect.objectContaining({ id: "welcome", route: "/dashboard", target: "trial-home" }),
  expect.objectContaining({ id: "train", route: "/agent", target: "training-source" }),
  expect.objectContaining({ id: "test", route: "/inbox/try", target: "test-composer" }),
  expect.objectContaining({ id: "inbox", route: "/inbox/try", target: "test-thread" }),
  expect.objectContaining({ id: "locked", route: "/explore", target: "locked-whatsapp" }),
  expect.objectContaining({ id: "finish", route: "/dashboard", target: "trial-conversion" }),
]);
```

Action tests must assert org-scoped `updateMany`, reject an unknown step, and
never update a converted/non-trial row. Pure helpers test Next/Back/Finish
ordering, route changes, target selectors, and desktop/mobile presentation.
Use `readFileSync` contract assertions for automatic first-visit opening,
`role="dialog"`, labelled title, Escape dismissal, focus restoration, and the
mobile bottom-sheet class.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-tour.test.ts tests/trial-tour-actions.test.ts`

Expected: FAIL because the tour engine does not exist.

- [ ] **Step 3: Define bounded steps and server actions**

Each step contains only `id`, `route`, `target`, `title`, and `body`; no JSX or executable callback is stored in the module. Validate action input against the step-id union and update by both trial id and current org id:

```ts
await prisma.acquisitionTrial.updateMany({
  where: { id: trial.id, orgId: ctx.org.id, convertedAt: null },
  data: { tourStep: step },
});
```

Dismiss sets `tourDismissedAt` without marking completion. Finish sets `tourStep: "finish"` and `tourCompletedAt`. Add “Restart guided tour” to Trial Home, which clears dismissed/completed timestamps and resets the step to `welcome`.

- [ ] **Step 4: Implement the real coach mark**

`TrialTour` receives initial server state. On mount and pathname changes it:

1. Opens automatically only when not completed/dismissed.
2. Navigates to the step route when needed.
3. Finds `[data-tour="${target}"]` after navigation.
4. Calls `scrollIntoView({ block: "center", behavior })`, using `"auto"` when `prefers-reduced-motion` matches.
5. Positions a desktop popover and spotlight from `getBoundingClientRect`; recomputes on resize/scroll with `requestAnimationFrame`.
6. Uses a fixed bottom sheet below `md`, leaving the target unobscured where possible.
7. Falls back to a centered dialog if the target is still absent after two animation frames; Next remains usable.

Keep focus inside the coach mark while open, restore the prior focus on close, give the overlay `aria-hidden`, and never make a transparent overlay the only dismissal control.

- [ ] **Step 5: Mark real controls and mount once**

Add these exact stable markers:

- Trial Home heading: `data-tour="trial-home"`.
- Trial setup/source panel on Train AI: `data-tour="training-source"`.
- Test composer: `data-tour="test-composer"`.
- Test thread: `data-tour="test-thread"`.
- WhatsApp preview card: `data-tour="locked-whatsapp"`.
- Home conversion panel: `data-tour="trial-conversion"`.

Mount one `TrialTour` in `AppShell` only when `mode === "trial"`. Do not mount a separate instance per page.

- [ ] **Step 6: Run tour and shell tests**

Run: `npx vitest run tests/trial-tour.test.ts tests/trial-tour-actions.test.ts tests/trial-shell.test.ts tests/trial-explore.test.ts tests/trial-test-inbox.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the guided tour**

```bash
git add src/modules/trial/tour.ts src/app/'(app)'/trial/actions.ts src/components/features/trial/trial-tour.tsx src/components/features/trial/trial-home.tsx src/components/features/app-shell/shell.tsx src/app/'(app)'/agent/page.tsx src/app/'(app)'/inbox/try/try-your-ai.tsx src/app/'(app)'/explore/page.tsx tests/trial-tour.test.ts tests/trial-tour-actions.test.ts
git commit -m "feat(trial): add persistent product walkthrough"
```

### Task 7: Guided-experience verification and progress record

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: Tasks 1–6 and the completed foundation.
- Produces: a green, documented trial experience ready for conversion instrumentation.

- [ ] **Step 1: Run the complete focused experience suite**

Run: `npx vitest run tests/free-trial-page.test.ts tests/trial-workspace.test.ts tests/trial-setup.test.ts tests/trial-shell.test.ts tests/trial-checklist.test.ts tests/trial-routes.test.ts tests/trial-explore.test.ts tests/trial-test-inbox.test.ts tests/trial-tour.test.ts tests/trial-tour-actions.test.ts`

Expected: PASS.

- [ ] **Step 2: Verify protected behavior and production compilation**

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 3: Manually verify responsive flow in simulation mode**

Run: `npm run dev`

Verify at 390 px and 1440 px:

1. `/free-trial` form validation and email-confirmation message.
2. `/trial/setup` one-source flow and fact approval.
3. Automatic tour from Home through Train AI, Test Inbox, Explore, and back.
4. Fifteenth reply succeeds; sixteenth is blocked without a model call.
5. Locked WhatsApp card opens the demo/plans dialog.
6. Keyboard-only Next/Back/Skip and Escape; visible focus; reduced motion.

- [ ] **Step 4: Record the completed guided experience**

Append to `PROGRESS.md`:

```md
## 2026-09-20 — Guided free-trial experience

- Added the clinic-focused `/free-trial` acquisition page and Supabase claim handoff.
- Added a short one-source setup, four-destination trial workspace, inline simulated test inbox, persistent checklist, and route-aware coach-mark tour.
- Paid capabilities remain locked behind server gates and are previewed through demo-first cards in Explore.
```

- [ ] **Step 5: Commit the verified experience record**

```bash
git add PROGRESS.md
git commit -m "docs(trial): record guided trial experience"
```
