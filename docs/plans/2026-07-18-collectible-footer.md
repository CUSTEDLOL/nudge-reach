# Collectible Footer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic dark green marketing footer with a themed collectible-card footer and a grass edge at the bottom of the site.

**Architecture:** Keep the change contained to the shared marketing footer component so home, pricing, FAQ, privacy, and terms inherit the new ending. Use pure React and Tailwind utility classes for the card, link groups, stats, and grass strip; do not add new assets or dependencies.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS v4, lucide-react icons.

---

### Task 1: Rewrite Shared Footer

**Files:**
- Modify: `src/components/marketing/footer.tsx`

**Step 1: Replace visual shell**

Change the root footer from the dark `bg-[#0b3d2e]` block to a pale `bg-[#f8fbf1]` footer with a subtle line grid and top fade.

**Step 2: Add footer content**

Keep links to features, compare, pricing, FAQ, login, email, privacy, and terms. Preserve `BookDemoButton` for demo-triggering links.

**Step 3: Add collectible card**

Create an `ActionCollectibleCard` helper inside the file with a bordered trading-card frame, layered scene, WhatsApp mini mock, title, and stat chips for Books, Chases, and Collects.

**Step 4: Add grass edge**

Create a `GrassEdge` helper inside the file using repeated CSS blade spans and place it as the last element inside the footer.

### Task 2: Documentation

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Add progress note**

Add a top entry describing the collectible-card footer and grass-strip ending.

### Task 3: Verification

**Commands:**
- Run: `npm run lint -- src/components/marketing/footer.tsx`
- Run: `npm run build`
- Run: `git diff --check`

**Expected:** lint exits 0, production build exits 0, and diff check has no whitespace errors.
