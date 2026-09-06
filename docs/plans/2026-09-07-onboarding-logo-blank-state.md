# Onboarding Logo and Blank State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show the official Nudge identity in app navigation and ensure an onboarding choice appears selected only after that question has been explicitly completed.

**Architecture:** Keep complete fallback values in `WorkspaceProfile` for downstream personalization, but add a small colocated pure helper that gates each answer's visible questionnaire value using `lastCompletedStep`. Replace the placeholder `BrandMark` artwork with the existing official wordmark and compact icon assets without changing its public component API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Next Image

---

### Task 1: Define and test answer visibility

**Files:**
- Create: `src/app/(app)/onboarding/question-state.ts`
- Create: `tests/onboarding-question-state.test.ts`

**Step 1: Write the failing test**

Create focused cases for a fresh question, a completed question, and a question after a later completed step:

```ts
import { describe, expect, it } from "vitest";
import { visibleChoiceValue } from "@/app/(app)/onboarding/question-state";

describe("onboarding question state", () => {
  it("keeps an unanswered question visually blank", () => {
    expect(visibleChoiceValue("owner", 1, 0)).toBe("");
    expect(visibleChoiceValue("enquiry-booking-payment", 3, 2)).toBe("");
  });

  it("restores the saved value for completed questions", () => {
    expect(visibleChoiceValue("owner", 1, 1)).toBe("owner");
    expect(visibleChoiceValue("bookings", 2, 6)).toBe("bookings");
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/onboarding-question-state.test.ts`

Expected: FAIL because `question-state.ts` does not exist.

**Step 3: Implement the minimal pure helper**

```ts
export function visibleChoiceValue<T extends string>(
  value: T,
  questionStep: number,
  lastCompletedStep: number
): T | "" {
  return lastCompletedStep >= questionStep ? value : "";
}
```

**Step 4: Run the focused test**

Run: `npx vitest run tests/onboarding-question-state.test.ts`

Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add 'src/app/(app)/onboarding/question-state.ts' tests/onboarding-question-state.test.ts
git commit -m "test: define onboarding answer visibility"
```

### Task 2: Replace the placeholder app mark with official assets

**Files:**
- Modify: `src/components/features/app-shell/brand-mark.tsx:1-44`
- Modify: `tests/onboarding-ui-contract.test.ts`

**Step 1: Write the failing brand contract test**

Add a test that reads `brand-mark.tsx` and asserts both official assets are used:

```ts
it("uses the official Nudge assets in expanded and compact navigation", () => {
  const source = readFileSync(
    "src/components/features/app-shell/brand-mark.tsx",
    "utf8"
  );

  expect(source).toContain('src="/logo-mark.png"');
  expect(source).toContain('src="/icon.svg"');
  expect(source).not.toContain("MessageSquare");
});
```

**Step 2: Run the contract test to verify it fails**

Run: `npx vitest run tests/onboarding-ui-contract.test.ts`

Expected: FAIL because `BrandMark` still contains the placeholder inline chat bubble.

**Step 3: Implement the official brand rendering**

- Import `Image` from `next/image`.
- Preserve the existing `/dashboard` link, accessible label, focus treatment,
  `compact` prop, and `className` prop.
- When expanded, render `/logo-mark.png` at its intrinsic 1570×334 ratio with
  `unoptimized`, `priority`, `alt="Nudge"`, and an approximately 28px visual
  height.
- When compact, render `/icon.svg` at 32×32 with empty alt text because the link
  already supplies the accessible name.
- Remove the placeholder chat SVG and separately typeset `Nudge` label.

**Step 4: Run the contract test**

Run: `npx vitest run tests/onboarding-ui-contract.test.ts`

Expected: all onboarding UI contract tests PASS.

**Step 5: Commit**

```bash
git add src/components/features/app-shell/brand-mark.tsx tests/onboarding-ui-contract.test.ts
git commit -m "feat: use official Nudge app branding"
```

### Task 3: Wire blank states into every single-choice question

**Files:**
- Modify: `src/app/(app)/onboarding/wizard.tsx:20-455`
- Modify: `tests/onboarding-ui-contract.test.ts`

**Step 1: Add a failing integration contract test**

Assert that all five single-choice questions pass their value through the new
visibility helper with the correct step number:

```ts
it("shows saved values only after their question has been completed", () => {
  const source = readFileSync(
    "src/app/(app)/onboarding/wizard.tsx",
    "utf8"
  );

  expect(source.match(/visibleChoiceValue\(/g)).toHaveLength(5);
  expect(source).toContain("visibleChoiceValue(profile.journey, 3, profile.lastCompletedStep)");
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/onboarding-ui-contract.test.ts`

Expected: FAIL because the wizard currently passes every fallback profile value
directly into `ChoiceCards`.

**Step 3: Implement the minimal integration**

- Import `visibleChoiceValue` from `./question-state`.
- Gate the values for role (step 1), primary outcome (step 2), customer journey
  (step 3), team shape (step 4), and guidance (step 6).
- Do not change saving, animation, selected styling, or backend actions.
- Keep systems unchanged because its valid fallback is already an empty array.

Example:

```tsx
<ChoiceCards
  options={JOURNEY_OPTIONS}
  value={visibleChoiceValue(profile.journey, 3, profile.lastCompletedStep)}
  // existing props remain unchanged
/>
```

**Step 4: Run all focused onboarding tests**

Run: `npx vitest run tests/onboarding-question-state.test.ts tests/onboarding-ui-contract.test.ts tests/onboarding-actions.test.ts tests/workspace-profile.test.ts`

Expected: all focused tests PASS.

**Step 5: Commit**

```bash
git add 'src/app/(app)/onboarding/wizard.tsx' tests/onboarding-ui-contract.test.ts
git commit -m "fix: keep unanswered onboarding choices blank"
```

### Task 4: Verify behavior and record completion

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Run lint on the changed implementation and tests**

Run: `npx eslint 'src/app/(app)/onboarding/question-state.ts' 'src/app/(app)/onboarding/wizard.tsx' src/components/features/app-shell/brand-mark.tsx tests/onboarding-question-state.test.ts tests/onboarding-ui-contract.test.ts`

Expected: no errors.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: all tests PASS.

**Step 3: Run the production build**

Run: `npm run build`

Expected: Prisma generation and Next.js production build complete successfully.

**Step 4: Inspect the local onboarding flow**

- Open `http://localhost:3000/onboarding` as a fresh or partially completed owner.
- Confirm the real green wordmark appears in the header.
- Confirm the current unanswered question has no selected card.
- Choose an option, go back from the next question, and confirm the answer is restored.
- Check compact navigation at a mobile viewport and the sidebar's collapsed state.
- Confirm visible focus, hover, loading, and reduced-motion behavior remains usable.

**Step 5: Update progress and commit**

Add a concise entry to `PROGRESS.md` with the verified commands and outcome.

```bash
git add PROGRESS.md
git commit -m "docs: record onboarding identity verification"
```
