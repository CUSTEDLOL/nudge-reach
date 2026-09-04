# Landing Comparison Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the confusing interactive competitor scorecard with a plain-language, responsive comparison table that immediately explains why Nudge is different.

**Architecture:** Keep the existing `MetaVsNudge` export and `#compare` anchor so the page and navigation need no changes. Make the component server-rendered and data-driven: a small local column/row model renders one semantic HTML table, with Tailwind handling the highlighted Nudge column and narrow-screen overflow.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons, Vitest

---

### Task 1: Lock the new comparison contract with a failing test

**Files:**
- Create: `tests/landing-comparison.test.ts`
- Test: `src/components/marketing/meta-vs-nudge.tsx`

**Step 1: Write the failing test**

Read the component source and assert:

```ts
expect(source).toContain("Why businesses choose Nudge");
expect(source).toContain("Meta's free AI");
expect(source).toContain("WATI, AiSensy, Interakt");
expect(source).toContain("Human receptionist");
expect(source).toContain("<table");
expect(source).toContain('scope="col"');
expect(source).toContain('scope="row"');
expect(source).not.toContain("Biased scorecard");
expect(source).not.toContain("LensChip");
```

Also assert the eight approved row labels and `id="compare"` remain present.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: FAIL because the current component contains the old headline and no table.

**Step 3: Commit the red test**

Run:

```bash
git add tests/landing-comparison.test.ts
git commit -m "test: define landing comparison contract"
```

### Task 2: Build the semantic comparison table

**Files:**
- Modify: `src/components/marketing/meta-vs-nudge.tsx`
- Test: `tests/landing-comparison.test.ts`

**Step 1: Replace the interactive model**

Remove `"use client"`, React state, Motion, ranking logic, score bars, and card components. Define local typed data for the four columns and eight outcome rows. Each cell uses a concise label with one of three tones: positive, partial, or negative.

**Step 2: Render semantic markup**

Render:

```tsx
<Section id="compare">
  <Container>
    <header>...</header>
    <div role="region" aria-label="Nudge competitor comparison" tabIndex={0}>
      <table>
        <thead>...</thead>
        <tbody>...</tbody>
      </table>
    </div>
  </Container>
</Section>
```

Use `scope="col"` for competitor headers and `scope="row"` for outcome labels. Highlight every Nudge cell with the existing green palette. Set a table `min-width` for legibility and make the first column sticky on narrow screens.

**Step 3: Run focused test to verify it passes**

Run: `npm test -- tests/landing-comparison.test.ts`

Expected: PASS.

**Step 4: Commit implementation**

Run:

```bash
git add src/components/marketing/meta-vs-nudge.tsx tests/landing-comparison.test.ts
git commit -m "feat: replace competitor scorecard with comparison table"
```

### Task 3: Verify the complete landing-page change

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Record the redesign**

Add a concise newest-first entry describing the table, messaging, responsive behavior, and removal of score/filter interaction.

**Step 2: Run all quality gates**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: every command exits 0.

**Step 3: Inspect the diff**

Run `git diff --check` and confirm only the scoped component, test, plans, and progress entry changed.

**Step 4: Commit progress**

Run:

```bash
git add PROGRESS.md
git commit -m "docs: record landing comparison redesign"
```
