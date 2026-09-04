# Competitor Decision Ledger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the rejected comparison bento with a concise, responsive decision ledger that compares capabilities, buyer responsibility and best fit across four options.

**Architecture:** Keep `MetaVsNudge` as a static server component and drive both responsive representations from one typed `OPTIONS` array. The desktop representation is a semantic four-column table; the mobile/tablet representation is one continuous ledger of labelled definition lists. Both live inside a single framed board and share exact copy, while responsive display classes ensure only one representation is exposed at a time.

**Tech Stack:** Next.js App Router, React server components, TypeScript, Tailwind CSS, Vitest, React DOM server rendering.

---

### Task 1: Define the decision-ledger render contract

**Files:**
- Modify: `tests/landing-comparison.test.ts`

**Step 1: Replace the bento assertions with the approved ledger contract**

Assert the new hierarchy and shared questions:

```ts
expect(text).toContain("COMPETITOR ANALYSIS");
expect(text).toContain("FOUR WAYS TO RUN WHATSAPP.");

for (const heading of [
  "Option",
  "What it handles",
  "What you still own",
  "Best for",
]) {
  expect(text).toContain(heading);
}
```

Assert all four competitors, their category labels, approved capability copy,
buyer-responsibility copy, best-fit copy and the credibility note.

Assert desktop semantics:

```ts
expect(html).toContain("<table");
expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(4);
expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(4);
```

Assert mobile semantics include four `<dl>` elements and the repeated labels
`Handles`, `You still own`, and `Best for`.

Reject the discarded visual model:

```ts
expect(source).not.toContain("JOURNEY_STEPS");
expect(source).not.toContain("linear-gradient");
expect(source).not.toContain("Hi, is Saturday available?");
expect(source).not.toContain("backdropWord");
expect(source).not.toContain("overflow-x-auto");
expect(source).not.toContain("useState");
```

**Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: FAIL because the current component still renders the story bento and
does not contain ledger headings or table/definition-list semantics.

**Step 3: Commit the failing contract**

```bash
git add tests/landing-comparison.test.ts
git commit -m "test: define competitor decision ledger contract"
```

### Task 2: Implement the responsive decision ledger

**Files:**
- Modify: `src/components/marketing/meta-vs-nudge.tsx`
- Test: `tests/landing-comparison.test.ts`

**Step 1: Replace the bento data with one shared option model**

Define this shape and exact content:

```ts
type ComparisonOption = {
  id: string;
  name: string;
  category: string;
  handles: string;
  ownership: string;
  bestFor: string;
  featured?: boolean;
};

const OPTIONS: ComparisonOption[] = [
  {
    id: "nudge-option",
    name: "Nudge AI Front Desk",
    category: "Managed service",
    handles: "Replies, bookings, deposits and quiet-lead recovery.",
    ownership: "Set the rules. Nudge configures and runs it.",
    bestFor: "Owners who want the outcome managed.",
    featured: true,
  },
  {
    id: "meta-option",
    name: "Meta Business Agent",
    category: "Native WhatsApp AI",
    handles: "Questions, recommendations, qualification and appointments.",
    ownership: "Setup, connected workflows and ongoing oversight.",
    bestFor: "Simple AI inside WhatsApp.",
  },
  {
    id: "crm-option",
    name: "WhatsApp CRM tools",
    category: "WATI · AiSensy · Interakt",
    handles: "Inbox, campaigns, AI agents and automations.",
    ownership: "Workflow design, integrations and daily operation.",
    bestFor: "Teams that want platform control.",
  },
  {
    id: "human-option",
    name: "Human receptionist",
    category: "Traditional hire",
    handles: "Conversations, exceptions and manual follow-up.",
    ownership: "Hiring, training, scheduling and cover.",
    bestFor: "Businesses needing human judgment.",
  },
];
```

Do not add scores, status icons, feature-denial copy or vendor-specific claims
beyond this approved wording.

**Step 2: Build the section heading**

Render the eyebrow, uppercase headline and supporting sentence using the same
display/serif hierarchy as adjacent landing sections. Keep the headline to one
idea and align the introduction with the board.

**Step 3: Build the desktop semantic table**

Inside a single `max-w-6xl` framed board, render a `hidden ... lg:table` with:

- an `sr-only` caption;
- a dark ink header strip;
- four scoped column headers;
- four scoped row headers;
- a fixed `24% / 29% / 28% / 19%` colgroup;
- 15–16px cell text and generous padding;
- horizontal rules between rows;
- only the Nudge row tinted pale green with a visible left accent.

Every option receives equal row height and the same information structure.

**Step 4: Build the mobile/tablet ledger from the same data**

Render a `lg:hidden` ledger inside the same board. Each option is one full-width
section separated by a two-pixel rule. Render the option name and category once,
then a three-item `<dl>` using `Handles`, `You still own`, and `Best for` labels.
Use a single column below 640px and three columns at `sm` and above. Use at least
16px body text on phones and no minimum widths or overflow containers.

**Step 5: Add the credibility note**

Below the board, render:

```text
Capabilities, services and pricing vary by provider, plan and market.
```

Use readable 13–14px ink text. Do not hide it in low-contrast decoration.

**Step 6: Run focused checks**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm run lint`

Expected: PASS with no warnings or errors.

**Step 7: Commit the implementation**

```bash
git add src/components/marketing/meta-vs-nudge.tsx
git commit -m "feat: replace comparison bento with decision ledger"
```

### Task 3: Verify readability and responsive behavior

**Files:**
- Modify if evidence requires it: `src/components/marketing/meta-vs-nudge.tsx`

**Step 1: Capture the rendered section at five widths**

Capture `#compare` at 1440px, 1024px, 768px, 390px and 320px.

Expected:

- 1440px and 1024px show the full table without horizontal scrolling.
- 768px shows one continuous ledger with three definition columns per option.
- 390px and 320px show stacked definitions with at least 16px body text.
- Nudge is highlighted but every competitor remains equally readable.

**Step 2: Measure overflow**

At every width, assert `document.documentElement.scrollWidth ===
window.innerWidth` and the section's `scrollWidth === clientWidth`.

**Step 3: Inspect against the rejected designs**

Verify that the section has one outer border and shadow, no individual card
silhouettes, no gradients, ghost words, stickers, message bubble, hover lift,
tiny pills, status icons or sideways-scroll instruction.

**Step 4: Make only screenshot-driven refinements**

Adjust typography, padding, column percentages or rule strength only when a
captured width shows a concrete readability problem. Keep the approved copy and
four-question structure unchanged.

**Step 5: Rerun focused checks and commit any refinement**

Run: `npm test -- tests/landing-comparison.test.ts`

Run: `npx tsc --noEmit`

Run: `npm run lint`

Expected: all commands PASS.

```bash
git add src/components/marketing/meta-vs-nudge.tsx
git commit -m "fix: refine competitor ledger readability"
```

### Task 4: Remove abandoned design artifacts and finish verification

**Files:**
- Delete: `docs/plans/2026-09-05-comparison-story-bento-design.md`
- Delete: `docs/plans/2026-09-05-comparison-story-bento.md`
- Modify: `PROGRESS.md`

**Step 1: Remove the two superseded bento documents**

Delete only the unshipped story-bento design and implementation plan. Preserve
the approved decision-ledger design and plan.

**Step 2: Replace the bento build-log entry**

Record the single-board decision ledger, shared capability/ownership/best-fit
questions, credible competitor framing, responsive desktop/mobile semantics and
focused regression test.

**Step 3: Run the complete quality gate**

Run: `npm test`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: the production build completes successfully.

Run: `git diff --check 99d4622..HEAD`

Expected: no output and exit code 0.

**Step 4: Request independent review**

Review the final range from the last accepted comparison-table commit to HEAD
for requirement fidelity, credible competitor language, table/list semantics,
mobile readability, responsive duplication drift and visual consistency.
Resolve all Critical or Important findings and rerun affected checks.

**Step 5: Commit the documentation cleanup**

```bash
git add PROGRESS.md docs/plans
git commit -m "docs: record competitor decision ledger"
```
