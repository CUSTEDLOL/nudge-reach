# Comparison Story Bento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dense landing-page comparison table with a responsive story bento that makes Nudge's done-for-you operating model understandable in about five seconds.

**Architecture:** Keep the existing `MetaVsNudge` server component and `#compare` anchor, but replace the table data model with one featured Nudge journey and three alternative operating-model cards. Render all meaning in static semantic HTML so the section works without JavaScript, reflows vertically on mobile, and does not depend on horizontal scrolling or interaction.

**Tech Stack:** Next.js App Router, React server components, TypeScript, Tailwind CSS, Lucide React, Vitest, React DOM server rendering.

---

### Task 1: Define the story-bento render contract

**Files:**
- Modify: `tests/landing-comparison.test.ts`

**Step 1: Replace the table assertions with a failing story-bento contract**

Assert that the rendered section includes:

```ts
expect(text).toContain("THE DIFFERENCE ISN'T MORE FEATURES.");
expect(text).toContain("It's who does the work.");
expect(text).toContain("Hi, is Saturday available?");
expect(text).toContain("Booked. Deposit collected. Follow-up handled.");

for (const step of [
  "Replied",
  "Calendar checked",
  "Deposit received",
  "Follow-up ready",
]) {
  expect(text).toContain(step);
}
```

Assert the three alternatives and their ownership labels, verify four semantic `<article>` elements, retain `id="compare"`, and reject `<table>`, `scope="col"`, `Swipe to compare`, `overflow-x-auto`, and React state.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: FAIL because the old comparison-table copy and markup are still rendered.

**Step 3: Commit the failing contract**

```bash
git add tests/landing-comparison.test.ts
git commit -m "test: define comparison story bento contract"
```

### Task 2: Build the visual story bento

**Files:**
- Modify: `src/components/marketing/meta-vs-nudge.tsx`
- Test: `tests/landing-comparison.test.ts`

**Step 1: Replace the comparison matrix types and data**

Define a four-step Nudge journey and three alternatives:

```ts
const JOURNEY_STEPS = [
  { label: "Replied", icon: MessageCircle },
  { label: "Calendar checked", icon: CalendarCheck2 },
  { label: "Deposit received", icon: BadgeIndianRupee },
  { label: "Follow-up ready", icon: BellRing },
] as const;

const ALTERNATIVES = [
  {
    id: "meta-option",
    title: "Meta's AI",
    description: "A capable agent for incoming conversations.",
    ownership: "You connect + oversee",
    backdropWord: "ASSISTS",
    background: "linear-gradient(145deg, #3299ff 0%, #51c9f3 50%, #63e3dc 100%)",
  },
  // CRM tools and human receptionist use the approved copy and gradients.
] as const;
```

Keep all capability claims framed around configuration and ownership, not blanket feature denials.

**Step 2: Implement the section header and enquiry sticker**

Render the approved two-line headline, then a small late-night message sticker with `11:47 PM`. Match the landing page with uppercase display type, thick ink borders, rounded sticker corners, and a hard offset shadow.

**Step 3: Implement the featured Nudge card**

Use a large lime-gradient `<article>` with:

```tsx
<h3 id="nudge-option">Nudge AI Front Desk</h3>
<p>Booked. Deposit collected. Follow-up handled.</p>
```

Render the four journey steps as a responsive two-by-two or four-column visual route, with decorative arrows hidden using `aria-hidden`. Include the closing line `We build it around your business and run the shift.` and a decorative `RUNS` ghost word.

**Step 4: Implement the alternative card stack**

Render three concise `<article aria-labelledby>` cards using the approved blue, purple, and orange gradients. Each card gets one icon, heading, description, ownership sticker, and decorative ghost word. Mention `WATI · AiSensy · Interakt` only in the CRM card.

**Step 5: Add the closing statement and responsive layout**

Use a single-column source order and `lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]` at desktop. Add `With Nudge, the front desk is the product.` below the bento. Avoid fixed minimum widths and overflow containers.

**Step 6: Run focused verification**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript diagnostics.

Run: `npm run lint`

Expected: PASS with no ESLint warnings or errors.

**Step 7: Commit the component**

```bash
git add src/components/marketing/meta-vs-nudge.tsx
git commit -m "feat: replace comparison table with story bento"
```

### Task 3: Inspect and refine the rendered section

**Files:**
- Modify if needed: `src/components/marketing/meta-vs-nudge.tsx`

**Step 1: Capture desktop and mobile screenshots**

With the existing preview at `http://localhost:3001`, capture `#compare` at 1440px and 390px widths.

Expected: the full section fits without horizontal overflow; Nudge is visually dominant; the message, four steps, three alternatives, and closing line are legible at a glance.

**Step 2: Inspect visual consistency**

Compare against the adjacent feature cards for border weight, corner radius, shadow, type hierarchy, spacing, gradients, ghost words, and hover motion. Check that card decoration does not obscure copy and that essential text maintains strong contrast.

**Step 3: Make only evidence-driven visual adjustments**

Adjust spacing, type scale, route geometry, or decorative opacity only where screenshots reveal a concrete problem. Do not add interaction, extra explanatory prose, or a table-like grid.

**Step 4: Rerun the focused test and static checks**

Run: `npm test -- tests/landing-comparison.test.ts && npx tsc --noEmit && npm run lint`

Expected: all commands PASS.

**Step 5: Commit any refinement**

```bash
git add src/components/marketing/meta-vs-nudge.tsx
git commit -m "fix: refine comparison bento presentation"
```

### Task 4: Record and verify the completed redesign

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Replace the superseded comparison-table log entry**

Describe the story-led bento, the one-enquiry journey, the ownership-based competitor framing, the responsive vertical mobile stack, and the focused render-contract test.

**Step 2: Run the complete quality gate**

Run: `npm test`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: production build completes successfully.

**Step 3: Request an independent code review**

Ask a reviewer to inspect only the branch diff for requirement fidelity, credible positioning, accessibility, responsive behavior, and visual-language consistency. Resolve all Critical or Important findings and rerun affected checks.

**Step 4: Commit the build-log update**

```bash
git add PROGRESS.md
git commit -m "docs: record comparison story redesign"
```

