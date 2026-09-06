# Onboarding Logo and Blank-State Design

**Date:** 2026-09-07

## Goal

Make the onboarding questionnaire feel deliberate and trustworthy by showing the
real Nudge identity and by never presenting a fallback recommendation as though
the user selected it.

## Approved experience

- The expanded app brand mark uses the real green NUDGE wordmark from
  `public/logo-mark.png`.
- Compact navigation uses the official green square glyph from `src/app/icon.svg`.
- A question the user has not answered shows every option in its neutral state.
- Selecting an option keeps the existing one-click save-and-advance interaction.
- Returning to a completed question restores the saved selection.
- Existing green brand accents, animation, keyboard focus, reduced-motion
  handling, loading feedback, and error feedback remain intact.

## State model

The stored workspace profile keeps its safe fallback values because dashboard
recommendations depend on a complete profile. The questionnaire must not use a
fallback value as proof that a question was answered.

`lastCompletedStep` is the source of truth for answer visibility:

- if `lastCompletedStep` is lower than a question's step, its choice-card value
  is empty and no card is selected;
- if `lastCompletedStep` includes that step, the saved profile value is shown;
- when a choice is saved, the existing action writes both the choice and the new
  completed-step value before advancing.

This keeps the database and profile schema unchanged while making the UI state
accurate. The systems question already starts with an empty array and needs no
new fallback treatment.

## Components

- `BrandMark` will render the existing official image assets instead of the
  placeholder chat-bubble SVG and text treatment. Its link behavior and compact
  API remain unchanged so onboarding, sidebar, and mobile top bar stay
  consistent.
- `OnboardingWizard` will derive each single-choice question's visible value
  from the stored answer and its completion step.
- `ChoiceCards` retains its accessible `aria-pressed` interaction and existing
  selected, hover, focus, disabled, and saving states.

## Failure behavior

If saving fails, the current inline error remains visible and the locally chosen
value remains available for retry. No new network or persistence path is added.

## Verification

Tests will assert that:

- the app brand component references the official wordmark and compact glyph;
- an unanswered current step passes an empty value to its choice cards;
- a completed step passes its stored value and therefore restores the answer;
- existing onboarding navigation contracts still pass.

Run the focused onboarding tests, lint the changed files, run the full test suite,
and build the Next.js application. Finally, inspect the flow in the local browser
at desktop and mobile widths.
