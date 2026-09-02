# Landing Page Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render Google Tag Manager and Facebook domain verification in the landing page document and publish it.

**Architecture:** Keep document-level integration markup in the App Router root layout. Put the GTM loader and Facebook meta tag in `<head>`, and put the GTM noscript fallback first in `<body>`.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Vercel

---

### Task 1: Add placement regression test

**Files:**
- Create: `tests/landing-tracking.test.ts`

1. Read `src/app/layout.tsx` and assert the Facebook tag, GTM loader, and noscript iframe exist.
2. Assert the loader is within `<head>` and the fallback precedes normal body content.
3. Run `npm test -- tests/landing-tracking.test.ts` and confirm it fails because the loader and meta tag are not in `<head>`.

### Task 2: Correct document markup

**Files:**
- Modify: `src/app/layout.tsx`

1. Add an explicit `<head>` immediately after `<html>` opens.
2. Put the GTM loader first in `<head>` and the Facebook verification meta tag after it.
3. Keep the GTM noscript fallback first in `<body>`.
4. Run the focused test and confirm it passes.

### Task 3: Verify and publish

**Files:**
- Modify: `PROGRESS.md`

1. Record the completed integration in `PROGRESS.md`.
2. Run the full tests, lint, and production build.
3. Commit only the scoped files, preserving unrelated working-tree changes.
4. Deploy to Vercel production.
5. Fetch the public landing-page HTML and confirm all three tags are present.
