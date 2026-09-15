# Internal Pricing Economics Guide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the outdated pricing explainer with a concise founder-only India/Singapore unit-economics guide and verified Word/PDF review copies.

**Architecture:** Keep `docs/plans/2026-09-11-tiered-pricing-design.md` as the single editable source. Generate the tracked Word document and a review PDF from it, then visually inspect both. This is a documentation-only change: do not alter plan configuration, credit behavior, checkout, or production data.

**Tech Stack:** Markdown, Pandoc, DOCX, LibreOffice/Poppler rendering, current TypeScript billing sources, official vendor price sheets.

---

### Task 1: Rewrite the authoritative pricing record

**Files:**
- Modify: `docs/plans/2026-09-11-tiered-pricing-design.md`
- Reference: `src/modules/billing/plans.ts`
- Reference: `src/modules/billing/credit-rates.ts`
- Reference: `src/modules/billing/credits.ts`
- Reference: `docs/superpowers/plans/2026-09-15-credit-ledger.md`

**Step 1: Preserve the approved decisions**

Keep the approved plan prices, included credits, feature gates, top-up prices,
trial rules, BYOK policy, Enterprise guidance, Meta Model A treatment, and stale-
currency warning unchanged.

**Step 2: State the costing formulas**

Use these formulas consistently:

```text
AI cost = credits consumed × US$0.005
cash contribution = price − payment fee − AI cost − included voice cost
fully loaded contribution = cash contribution − allocated core infrastructure − service-time cost
margin = contribution ÷ price
```

Use the approved assumptions:

```text
US$1 = INR 90 = SGD 1.35
Razorpay domestic = 2.36% effective
Stripe Singapore domestic card = 3.4% + SGD 0.50
voice = US$0.15/minute
core infrastructure = US$45/month (Vercel Pro US$20 + Supabase Pro US$25)
service time = US$20/hour
onboarding amortisation = 6 months
```

For the illustrative early-stage fully loaded view, allocate shared core
infrastructure across 10 active customers and label the following service-time
allowances as assumptions to replace with measured data:

| Plan | Onboarding | Monthly support |
|---|---:|---:|
| Entry | 1 hour | 0.25 hour |
| Starter | 2 hours | 0.5 hour |
| Growth | 4 hours | 1 hour |
| Pro | 8 hours | 2 hours |

**Step 3: Keep the guide concise**

Replace the long record with these sections:

1. Founder summary.
2. Approved India/Singapore plans.
3. What one credit means and what consumes it.
4. Representative task costs and allowance reach.
5. Other costs Nudge incurs.
6. Cash and fully loaded plan margins.
7. Light/expected/heavy usage and high-volume Enterprise.
8. Pricing guardrails.
9. Built, pending, and not production-enabled.
10. Assumptions and next measurements.

Keep paragraphs short. Prefer one table over repeated prose. Call revenue after
some costs “contribution,” never “profit.” Explicitly state that Meta bills the
customer and is not a Nudge cost.

**Step 4: Correct implementation status**

Record:

```text
Built in code: exact-model/cache-aware rate card; CreditGrant/CreditDebit core;
trial and paid-period grants; renewal/reset behavior; model-router preflight,
debit and reconciliation.

Not production-enabled: schema push and RLS for the new credit tables.

Pending: friendly call-site zero-balance handling; top-up purchase; founder
credit controls; customer balance/top-up UI; low-balance alerts.
```

Do not claim the credit system is live merely because Tasks 1–4 are committed.

**Step 5: Verify calculations independently**

Run a read-only Node calculation for both markets and compare every printed
number with its output. Expected key cash-contribution checks at full included
usage, before infrastructure/service labor:

```text
India Entry:   INR 1,373.62
India Starter: INR 4,431.02
India Growth:  INR 8,638.02
India Pro:     INR 15,927.02 (includes all 100 voice minutes)
SG Starter:    SGD 78.724
SG Growth:     SGD 300.439
SG Pro:        SGD 582.094 (includes all 100 voice minutes)
```

**Step 6: Check the Markdown diff**

Run: `git diff --check -- docs/plans/2026-09-11-tiered-pricing-design.md`

Expected: exit 0 with no output.

**Step 7: Commit the source rewrite**

```bash
git add docs/plans/2026-09-11-tiered-pricing-design.md
git commit -m "docs(pricing): explain founder unit economics"
```

---

### Task 2: Generate and inspect the Word document

**Files:**
- Modify: `docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx`
- Reference: `docs/plans/2026-09-11-tiered-pricing-design.md`

**Step 1: Load the document skill**

Use `@documents:documents` and follow its DOCX generation and render-verification
workflow. Reuse the existing document where helpful; do not alter the enterprise
proposal artifacts in `output/docx/` or `output/pdf/`.

**Step 2: Regenerate the Word file**

Run:

```bash
pandoc docs/plans/2026-09-11-tiered-pricing-design.md \
  -o docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx
```

Expected: Pandoc exits 0 and the DOCX opens as a valid Word document.

**Step 3: Render the DOCX to page images**

Use the command prescribed by the document skill. Render every page, not only
the first page.

Expected: no table clipping, split headings, orphaned labels, missing currency
symbols, or unreadably small text.

**Step 4: Inspect extracted text**

Run:

```bash
pandoc docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx -t plain
```

Expected: all ten sections, both markets, all costing assumptions, and the
three-part implementation status appear once.

**Step 5: Commit the Word review copy**

```bash
git add docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx
git commit -m "docs(pricing): regenerate internal economics guide"
```

---

### Task 3: Produce and inspect the PDF review copy

**Files:**
- Create: `output/pdf/NUDGE_INTERNAL_PRICING_ECONOMICS.pdf`
- Reference: `docs/NUDGE_PRICING_EXPLAINED_UPDATED.docx`

**Step 1: Load the PDF skill**

Use `@pdf:pdf` and follow its render-and-inspect workflow.

**Step 2: Convert Word to PDF**

Use LibreOffice as prescribed by the document/PDF skills, targeting
`output/pdf/NUDGE_INTERNAL_PRICING_ECONOMICS.pdf`.

Expected: conversion exits 0 and `pdfinfo` reports a non-zero page count.

**Step 3: Render every PDF page**

Use Poppler to render the PDF pages to a temporary directory.

Expected: every page renders successfully and matches the Word rendering.

**Step 4: Inspect the pages visually**

Check every rendered page for clipping, overflow, font substitution, table
wraps, blank pages, and missing symbols. If any defect is found, revise the
Markdown/layout and repeat Tasks 2–3.

**Step 5: Verify searchable text**

Run:

```bash
pdftotext output/pdf/NUDGE_INTERNAL_PRICING_ECONOMICS.pdf -
```

Expected: the PDF contains selectable text and the same ten sections as the
source.

---

### Task 4: Record the update and complete verification

**Files:**
- Modify: `PROGRESS.md`
- Verify: all pricing artifacts above

**Step 1: Update progress**

Add a newest-first entry that says:

- the pricing explainer is now founder-only and covers India/Singapore cash and
  fully loaded contribution;
- official/list vendor prices and planning assumptions are separated;
- credit-ledger Tasks 1–4 are in code, Tasks 5–8 and production schema/RLS remain;
- Word and PDF were regenerated and visually checked;
- no product price, checkout behavior, or production state changed.

**Step 2: Run documentation integrity checks**

Run:

```bash
git diff --check
rg -n "NOT yet built|not built — see|credits are a promise, not a meter" \
  docs/plans/2026-09-11-tiered-pricing-design.md PROGRESS.md
```

Expected: `git diff --check` exits 0; the stale-status search returns no matches.

**Step 3: Load final verification skill**

Use `@verification-before-completion` before claiming completion.

**Step 4: Run repository checks sequentially**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass, lint exits 0, and the Next.js production build exits
0. Run these sequentially because `npm run build` regenerates Prisma and can
interfere with a concurrent test process.

**Step 5: Review the exact commit scope**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only the pricing source, Word/PDF review copies, and `PROGRESS.md` are
part of this implementation. Leave the user's existing untracked enterprise
proposal and `supabase/` artifacts untouched.

**Step 6: Commit the completion record**

```bash
git add PROGRESS.md output/pdf/NUDGE_INTERNAL_PRICING_ECONOMICS.pdf
git commit -m "docs(pricing): publish internal economics review copy"
```

**Step 7: Hand off**

Provide clickable links to the Word document, PDF, and authoritative Markdown
source. Summarize the most important India/Singapore contribution-margin result
and state clearly which credit-ledger pieces are not production-enabled.
