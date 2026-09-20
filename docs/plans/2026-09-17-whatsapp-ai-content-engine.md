# WhatsApp AI Content Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish a broad WhatsApp AI automation pillar, two substantial guides, a transparent lead-leakage calculator, and an operating calendar that turns each asset into compliant founder-led Reddit distribution.

**Architecture:** Keep static marketing facts in the existing typed SEO and resource registries. Render the pillar and tool as public App Router pages, render the guides through the existing resource loader, and keep calculator math in a pure module with a small no-storage client interface. Every new page is self-canonical, internally linked, included in the sitemap, and grounded in official WhatsApp Cloud API behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, existing marketing `LandingShell` and structured-data helpers

---

### Task 1: Register and expose the new public route families

**Files:**
- Modify: `tests/seo-indexing.test.ts`
- Modify: `tests/seo-registry.test.ts`
- Modify: `src/lib/supabase/proxy-session.ts`
- Modify: `src/modules/marketing/seo-pages.ts`

**Step 1: Write failing public-route and registry tests**

Add assertions that `/whatsapp-ai-automation`, `/tools`, and
`/tools/whatsapp-lead-leakage-calculator` are public while lookalike paths such
as `/tools-private` remain protected. Add registry assertions for:

```ts
expect(seoPage("/whatsapp-ai-automation")).toMatchObject({
  title: "WhatsApp AI Automation: From Reply to Qualified Lead",
  modifiedAt: "2026-09-17",
  priority: 0.9,
});
expect(seoPage("/tools/whatsapp-lead-leakage-calculator")).toMatchObject({
  title: "WhatsApp Lead Leakage Calculator",
  modifiedAt: "2026-09-17",
  priority: 0.8,
});
```

**Step 2: Run the focused tests and confirm RED**

Run: `npm test -- tests/seo-indexing.test.ts tests/seo-registry.test.ts`

Expected: failures for missing public paths and missing SEO registry entries.

**Step 3: Add the minimal public prefixes and SEO records**

Add `/whatsapp-ai-automation` and `/tools` to `PUBLIC_PATH_PREFIXES`. Add two
indexable `SeoPage` records with unique descriptions, fixed review dates,
`changeFrequency: "monthly"`, and the priorities asserted above.

**Step 4: Run the focused tests and confirm GREEN**

Run: `npm test -- tests/seo-indexing.test.ts tests/seo-registry.test.ts`

Expected: all focused tests pass.

**Step 5: Commit**

```bash
git add tests/seo-indexing.test.ts tests/seo-registry.test.ts src/lib/supabase/proxy-session.ts src/modules/marketing/seo-pages.ts
git commit -m "feat(seo): register WhatsApp AI pillar and tool routes"
```

### Task 2: Generalize resource metadata and register the two guides

**Files:**
- Modify: `tests/resources.test.ts`
- Modify: `src/content/resources/manifest.ts`
- Modify: `src/content/resources/loaders.ts`
- Modify: `src/app/resources/[slug]/page.tsx`
- Modify: `src/app/resources/page.tsx`
- Create: `src/content/resources/how-to-build-whatsapp-ai-automation.tsx`
- Create: `src/content/resources/how-to-stop-losing-leads-on-whatsapp.tsx`

**Step 1: Write failing manifest and rendering tests**

Require the published slug order to be:

```ts
[
  "how-to-build-whatsapp-ai-automation",
  "how-to-stop-losing-leads-on-whatsapp",
  "whatsapp-appointment-booking-for-clinics",
]
```

Extend `ResourceRecord` and fixtures with:

```ts
audienceLabel: string;
eyebrow: string;
ctaTitle: string;
ctaBody: string;
```

Assert that resource cards use the record's `audienceLabel`, and that the
dynamic page passes its record-specific eyebrow and CTA copy to `LandingShell`.
Assert loader keys remain exactly aligned with published slugs.

**Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/resources.test.ts`

Expected: type/runtime failures because the fields, records and loaders do not
exist yet.

**Step 3: Add manifest records and loader mappings**

Use these page facts:

```ts
{
  slug: "how-to-build-whatsapp-ai-automation",
  title: "How to Build WhatsApp AI Automation with the Official Cloud API",
  description: "Learn the architecture behind a reliable WhatsApp AI automation: Cloud API webhooks, business knowledge, AI replies, actions, follow-ups and human handoff.",
  excerpt: "A practical system map for moving from an inbound WhatsApp message to a grounded reply, business action, compliant follow-up and human handoff.",
  publishedAt: "2026-09-17",
  modifiedAt: "2026-09-17",
  authorName: "Nudge team",
  parentPath: "/whatsapp-ai-automation",
  audienceLabel: "Build guide",
  eyebrow: "WhatsApp AI build guide",
  ctaTitle: "Prefer a working AI Front Desk to a build project?",
  ctaBody: "Nudge connects the official WhatsApp Cloud API to your business knowledge, calendars, follow-ups, payments and human team, then helps you set it up.",
  draft: false,
}
```

```ts
{
  slug: "how-to-stop-losing-leads-on-whatsapp",
  title: "How to Stop Losing Leads on WhatsApp",
  description: "Use a clear WhatsApp lead-response and follow-up workflow so every opted-in enquiry has an owner, status, next action and safe human handoff.",
  excerpt: "A five-state operating workflow for answering, qualifying and following up with WhatsApp leads without relying on memory or sending unwanted messages.",
  publishedAt: "2026-09-17",
  modifiedAt: "2026-09-17",
  authorName: "Nudge team",
  parentPath: "/whatsapp-ai-automation",
  audienceLabel: "Lead operations",
  eyebrow: "WhatsApp lead operations",
  ctaTitle: "Give every WhatsApp lead a next action",
  ctaBody: "See how Nudge answers from your business knowledge, keeps lead context, follows up with consent and hands important conversations to your team.",
  draft: false,
}
```

Update the existing clinic record with accurate resource-specific display fields.
Add temporary valid article components containing an `<article>` wrapper and no
`<h1>` so the loader contract compiles; later tasks replace their contents.

**Step 4: Make the resource shell and index data-driven**

Replace the hard-coded clinic eyebrow/CTA and `For clinics` label with the new
manifest fields. Keep the existing demo button behavior and Article JSON-LD.

**Step 5: Run the focused tests and confirm GREEN**

Run: `npm test -- tests/resources.test.ts tests/seo-registry.test.ts`

Expected: all focused tests pass and the sitemap now derives both new guides.

**Step 6: Commit**

```bash
git add tests/resources.test.ts src/content/resources/manifest.ts src/content/resources/loaders.ts 'src/app/resources/[slug]/page.tsx' src/app/resources/page.tsx src/content/resources/how-to-build-whatsapp-ai-automation.tsx src/content/resources/how-to-stop-losing-leads-on-whatsapp.tsx
git commit -m "feat(seo): register broad WhatsApp AI guides"
```

### Task 3: Build the WhatsApp AI automation pillar

**Files:**
- Create: `tests/whatsapp-ai-pillar.test.ts`
- Create: `src/app/whatsapp-ai-automation/page.tsx`

**Step 1: Write the failing render contract**

Render the page and assert:

- one H1 containing `WhatsApp AI automation`;
- canonical metadata from `metadataFor("/whatsapp-ai-automation")`;
- visible sections in this order: definition, complete workflow, architecture,
  replies versus actions, lead capture and qualification, follow-up rules,
  business examples, build-versus-buy, next steps;
- crawlable links to both new guides, the calculator, `/pricing`, and `/`;
- one BreadcrumbList JSON-LD script;
- no unsupported customer result or `#1` claim.

**Step 2: Run the test and confirm RED**

Run: `npm test -- tests/whatsapp-ai-pillar.test.ts`

Expected: module-not-found failure.

**Step 3: Implement the static pillar page**

Use `LandingShell`, `JsonLd`, `breadcrumbJsonLd`, server-rendered sections and
real `<Link href>` links. Include this core sequence:

```text
Inbound message → consent/context check → grounded answer → qualification →
business action → status/owner → compliant follow-up → human handoff
```

Explain that auto-replies acknowledge a lead, while useful automation also
records context and completes a next action. Explain that lead generation must
have an actual source—website CTA, QR code, organic enquiry, opted-in campaign
or click-to-WhatsApp ad—and that the automation handles what happens after the
conversation starts. Use restaurants, clinics, property enquiries and local
services as distinct examples without promising outcomes.

**Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/whatsapp-ai-pillar.test.ts`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add tests/whatsapp-ai-pillar.test.ts src/app/whatsapp-ai-automation/page.tsx
git commit -m "feat(seo): publish WhatsApp AI automation pillar"
```

### Task 4: Write the official Cloud API build guide

**Files:**
- Modify: `tests/resources.test.ts`
- Modify: `src/content/resources/how-to-build-whatsapp-ai-automation.tsx`

**Step 1: Add failing guide assertions**

Require ordered H2s for:

1. `Define the business outcome before the bot`
2. `Use the official WhatsApp Cloud API`
3. `Receive messages through a verified webhook`
4. `Ground replies in business knowledge`
5. `Give the AI narrow business actions`
6. `Track conversation and lead state`
7. `Enforce the 24-hour service window`
8. `Design human handoff before launch`
9. `Test the complete system safely`
10. `Decide whether to build or buy`

Assert a safe primary-source link to Meta's Cloud API documentation, links to
the pillar and lead-loss guide, one article wrapper, no H1, and explicit language
that unofficial browser automation is not recommended.

**Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/resources.test.ts`

Expected: guide-content assertions fail.

**Step 3: Write the complete guide**

Use the existing article typography patterns. Include a visible scope note,
architecture flow, webhook verification and idempotency explanation, business-
specific grounding, tool authorization, state storage, consent, template path,
handoff, simulation/UAT checklist and an honest build-versus-buy table. Do not
publish credentials, internal secrets, unsupported Meta-partner claims or copy
from third-party articles.

**Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/resources.test.ts`

Expected: all resource tests pass.

**Step 5: Commit**

```bash
git add tests/resources.test.ts src/content/resources/how-to-build-whatsapp-ai-automation.tsx
git commit -m "feat(content): publish official WhatsApp AI build guide"
```

### Task 5: Write the WhatsApp lead-loss operations guide

**Files:**
- Modify: `tests/resources.test.ts`
- Modify: `src/content/resources/how-to-stop-losing-leads-on-whatsapp.tsx`

**Step 1: Add failing guide assertions**

Require ordered H2s for:

1. `A lead is lost when the next action disappears`
2. `Use five clear lead states`
3. `Acknowledge first, then answer accurately`
4. `Qualify only what the business needs`
5. `Give every conversation an owner and deadline`
6. `Follow up with consent and context`
7. `Stop automation when a person takes over`
8. `Review the leaks every week`
9. `Use the lead-loss checklist`

Assert the five states `New`, `Active`, `Waiting`, `Follow-up due`, and `Closed`;
links to the pillar and calculator; STOP/opt-out language; one article wrapper;
and no H1 or fabricated benchmark.

**Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/resources.test.ts`

Expected: new guide assertions fail.

**Step 3: Write the complete guide**

Use deterministic operational advice: record source, status, owner, last inbound
time, next action and due time; pause scheduled follow-ups when the lead replies;
require opt-in for marketing; require approved templates outside the service
window; honor STOP permanently; and define a weekly audit. Use examples rather
than claimed performance results.

**Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/resources.test.ts`

Expected: all resource tests pass.

**Step 5: Commit**

```bash
git add tests/resources.test.ts src/content/resources/how-to-stop-losing-leads-on-whatsapp.tsx
git commit -m "feat(content): publish WhatsApp lead-loss guide"
```

### Task 6: Build and test the calculator domain logic

**Files:**
- Create: `tests/lead-leakage-calculator.test.ts`
- Create: `src/modules/marketing/lead-leakage.ts`

**Step 1: Write failing formula and validation tests**

Define:

```ts
interface LeadLeakageInputs {
  monthlyLeads: number;
  missedReplyPercent: number;
  missingFollowupPercent: number;
  conversionPercent: number;
  averageSaleValue: number;
}
```

Use these transparent formulas:

```text
missedReplyLeads = monthlyLeads × missedReplyPercent / 100
repliedLeads = monthlyLeads - missedReplyLeads
missingFollowupLeads = repliedLeads × missingFollowupPercent / 100
leadsAtRisk = missedReplyLeads + missingFollowupLeads
customersAtRisk = leadsAtRisk × conversionPercent / 100
monthlyRevenueAtRisk = customersAtRisk × averageSaleValue
annualRevenueAtRisk = monthlyRevenueAtRisk × 12
```

Require percentages to clamp to 0–100, counts/values to clamp at zero, finite
numbers only, and currency outputs to remain raw numbers in the pure module.

**Step 2: Run the test and confirm RED**

Run: `npm test -- tests/lead-leakage-calculator.test.ts`

Expected: module-not-found failure.

**Step 3: Implement the pure calculation module**

Export a normalizer, calculator and result type. Round lead/customer outputs to
two decimal places and money to the nearest whole unit. Do not add persistence,
analytics or network calls.

**Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/lead-leakage-calculator.test.ts`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add tests/lead-leakage-calculator.test.ts src/modules/marketing/lead-leakage.ts
git commit -m "feat(tools): add transparent lead-leakage calculations"
```

### Task 7: Publish the calculator page and accessible client interface

**Files:**
- Create: `tests/lead-leakage-page.test.ts`
- Create: `src/app/tools/whatsapp-lead-leakage-calculator/page.tsx`
- Create: `src/app/tools/whatsapp-lead-leakage-calculator/lead-leakage-calculator.tsx`

**Step 1: Write failing page and UI render tests**

Assert one H1, canonical metadata, breadcrumb JSON-LD, five labelled numeric
inputs, a result region with `aria-live="polite"`, visible formula/assumption
copy, `No information entered here is stored`, and links to the pillar and
lead-loss guide. Render the client component with deterministic initial values
and assert the calculated example labels are visible.

**Step 2: Run the test and confirm RED**

Run: `npm test -- tests/lead-leakage-page.test.ts`

Expected: module-not-found failure.

**Step 3: Implement the page and calculator**

Use `LandingShell`, existing form visual language, `inputMode="decimal"`,
`min="0"`, and `max="100"` for percentages. Keep initial fields empty; display
an instructional empty state until all required numbers are present. Format
money with `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`
and clearly state that users may interpret the same formula in their own local
currency. Never submit or store values.

**Step 4: Run the focused tests and confirm GREEN**

Run: `npm test -- tests/lead-leakage-calculator.test.ts tests/lead-leakage-page.test.ts`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add tests/lead-leakage-page.test.ts src/app/tools/whatsapp-lead-leakage-calculator/page.tsx src/app/tools/whatsapp-lead-leakage-calculator/lead-leakage-calculator.tsx
git commit -m "feat(tools): publish WhatsApp lead-leakage calculator"
```

### Task 8: Connect the content cluster across the site

**Files:**
- Create: `tests/seo-content-links.test.ts`
- Modify: `src/app/resources/page.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Write a failing internal-link test**

Assert that the homepage and Resources page contain crawlable links to
`/whatsapp-ai-automation`; the Resources page contains the two guide links and
the calculator link; and the anchor text is descriptive rather than `Read more`.

**Step 2: Run the test and confirm RED**

Run: `npm test -- tests/seo-content-links.test.ts`

Expected: homepage/resources pillar and calculator assertions fail.

**Step 3: Add the minimal internal-link surfaces**

Add a compact server-rendered learning section to the homepage after the
feature/product explanation and before pricing. Add a featured-tools block to
Resources above the article list. Reuse existing colors, spacing, borders and
`Link` components; do not add animation or a new visual system.

**Step 4: Run the test and confirm GREEN**

Run: `npm test -- tests/seo-content-links.test.ts tests/resources.test.ts`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add tests/seo-content-links.test.ts src/app/resources/page.tsx src/app/page.tsx
git commit -m "feat(seo): connect the WhatsApp AI content cluster"
```

### Task 9: Add the publishing and Reddit operating calendar

**Files:**
- Create: `tests/seo-content-calendar.test.ts`
- Create: `docs/SEO_CONTENT_CALENDAR.md`

**Step 1: Write the failing operations test**

Require the document to contain 16 numbered weeks, the later content queue from
the design, a Search Console review at weeks 4/8/12/16, one native Reddit angle
per week, a per-community rule check, transparent founder disclosure, and bans
on automated posting, unsolicited DMs, vote manipulation and copy-pasted
cross-posts.

**Step 2: Run the test and confirm RED**

Run: `npm test -- tests/seo-content-calendar.test.ts`

Expected: missing-file failure.

**Step 3: Write the four-month calendar**

Give each week one primary website action, one Reddit action, one measurement
check and one outcome owner. Mark future topics as planned rather than published.
Include a reusable Reddit preflight checklist and UTM convention, but do not
automate or publish any external post.

**Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/seo-content-calendar.test.ts`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add tests/seo-content-calendar.test.ts docs/SEO_CONTENT_CALENDAR.md
git commit -m "docs(seo): add content and Reddit operating calendar"
```

### Task 10: Record and verify the first release

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Record the release accurately**

Add a concise entry naming the four new URLs, evidence boundary, calculator
privacy behavior, internal-link cluster and Reddit manual-only rule.

**Step 2: Run all verification gates**

Run: `npm test`

Expected: all tests pass, with only the existing database-gated concurrency
tests skipped.

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: production build succeeds and statically renders the pillar, tool and
both resource routes; sitemap generation includes all four new canonical URLs.

**Step 3: Review the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended SEO/content files changed.

**Step 4: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(seo): record WhatsApp AI content release"
```

### Task 11: Integrate, deploy and verify production

**Files:**
- No new source files

**Step 1: Merge the verified branch into `main` without touching unrelated work**

Inspect the main worktree first. If unrelated tracked edits remain, do not stash,
overwrite or include them; coordinate the integration around them.

**Step 2: Push `main` and monitor the automatic Vercel production deployment**

Verify that the deployed commit SHA matches the merged commit.

**Step 3: Verify live behavior**

Check the pillar, both guides and calculator for HTTP 200, apex canonical,
exactly one H1 and crawlable internal links. Check `sitemap.xml` for the four new
URLs and confirm `www` continues to redirect permanently to the apex hostname.

**Step 4: Search Console handoff**

Ask the user to inspect/request indexing only for the pillar and calculator
first, preserving URL Inspection quota. The sitemap remains the discovery path
for the two guides. Explain that indexing and ranking are not guaranteed and
that performance data may remain sparse initially.
