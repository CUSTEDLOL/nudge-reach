# SEO Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Nudge's measurable, crawl-safe SEO foundation, first clinic hub and first evidence-backed resource without drifting from AI Front Desk positioning.

**Architecture:** A typed marketing SEO registry owns canonical page metadata and sitemap dates. Public pages stay statically renderable, share small server components for breadcrumbs/JSON-LD, and use a typed local resource manifest rather than a remote CMS. Browser events provide immediate funnel signals while a signed Cal.com webhook writes the authoritative demo-booking record; Nudge's founder lead pipeline records qualification and conversion.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, Prisma 6/Postgres on Supabase, Vitest 3, Google Tag Manager/GA4 data layer, Cal.com embed events and signed webhooks.

**Spec:** `docs/plans/2026-09-14-seo-program-design.md`

## Global Constraints

- Nudge is an **AI Front Desk**, never a generic WhatsApp CRM; campaigns remain supporting capability, not headline.
- Primary market for this release: high-ticket Indian clinics. Primary KPI: qualified organic demo bookings.
- Keep all seven protected invariants in `AGENTS.md`; this release must not alter messaging, consent, runtime-model, simulation, tenant, 24-hour-window or business-scope behavior.
- Use only factual, shipped product claims and approved prices. Do not invent rankings, volumes, clinic statistics, testimonials, certifications or partner status.
- Public content is useful in server-rendered HTML without JavaScript.
- No remote CMS or programmatic city pages in this release.
- Never store patient data, Cal.com notes, raw booking payloads, secrets or conversation content in analytics.
- Database work requires the `supabase:supabase` and `supabase:supabase-postgres-best-practices` skills before editing; new public tables get RLS enabled with no browser policies.
- Next.js implementation requires `vercel:nextjs`; React/TSX completion requires the applicable Vercel React review skill.
- Follow TDD: observe every focused test fail for the intended reason before implementation, then pass it before moving on.
- Touch only files listed by the active task. Preserve the user's unrelated untracked files.

---

## File map

### SEO and content

- Create `src/modules/marketing/seo-pages.ts`: canonical page records, metadata factory, truthful dates and validation.
- Create `src/modules/marketing/structured-data.ts`: pure builders for breadcrumbs and article JSON-LD.
- Create `src/components/marketing/seo/breadcrumbs.tsx`: visible crawlable breadcrumbs.
- Create `src/components/marketing/seo/json-ld.tsx`: safe JSON-LD script renderer.
- Create `src/components/marketing/seo/landing-shell.tsx`: shared server-rendered page frame using existing Navbar/Footer.
- Create `src/app/industries/clinics/page.tsx`: first commercial clinic hub.
- Create `src/components/marketing/clinics/clinic-hub.tsx`: clinic-hub content composition.
- Create `src/content/resources/manifest.ts`: typed resource metadata with draft control and loader keys.
- Create `src/content/resources/whatsapp-appointment-booking-for-clinics.tsx`: first evidence-backed resource body.
- Create `src/app/resources/page.tsx`: resource index.
- Create `src/app/resources/[slug]/page.tsx`: static resource detail route.
- Modify `src/app/page.tsx`, `src/components/marketing/v2/hero-v2.tsx`, `src/components/marketing/navbar.tsx`, and `src/components/marketing/footer.tsx`: positioning and crawlable links.
- Modify `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`, and `src/lib/supabase/proxy-session.ts`: discovery/index controls.

### Measurement

- Create `src/modules/marketing/analytics.ts`: typed data-layer events, browser attribution and Cal metadata projection.
- Create `src/modules/marketing/cal-webhook.ts`: HMAC verification and whitelisted booking parsing.
- Create `src/modules/marketing/ga4.ts`: optional GA4 Measurement Protocol sender for qualified/converted lead events.
- Create `src/app/api/webhooks/cal/route.ts`: signed, idempotent booking ingestion.
- Modify `src/components/marketing/book-demo.tsx`: CTA and Cal success events plus attribution metadata.
- Modify `prisma/schema.prisma`: authoritative `DemoBooking` platform-lead table.
- Modify `src/modules/admin/leads.ts`, `src/app/admin/leads/lead-row.tsx`, and `src/app/admin/leads/actions.ts`: booking leads and qualification transitions.
- Modify `src/lib/env-schema.ts` and `.env.example`: optional Cal/GA4 configuration.

### Tests and operations

- Create `tests/seo-registry.test.ts`, `tests/seo-indexing.test.ts`, `tests/seo-structured-data.test.ts`, `tests/clinic-hub.test.ts`, `tests/resources.test.ts`, `tests/marketing-analytics.test.ts`, `tests/cal-webhook.test.ts`, `tests/cal-webhook-route.test.ts`, and `tests/ga4-leads.test.ts`.
- Modify `tests/admin-leads.test.ts`, `tests/landing-tracking.test.ts`, and `tests/env.test.ts`.
- Create `docs/SEO_OPERATIONS.md` and `docs/SEO_BASELINE.md`.
- Modify `PROGRESS.md` after all verification is current.

---

### Task 1: Typed SEO registry and truthful sitemap

**Files:**
- Create: `src/modules/marketing/seo-pages.ts`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/faq/page.tsx`
- Test: `tests/seo-registry.test.ts`

**Interfaces:**
- Produces: `SITE_ORIGIN`, `SeoPagePath`, `SEO_PAGES`, `seoPage(path)`, `metadataFor(path)`, `sitemapEntries()`.
- Consumes: Next.js `Metadata` and `MetadataRoute.Sitemap` types only.
- Later tasks extend `SEO_PAGES`; no other module owns canonical metadata or sitemap dates.

- [ ] **Step 1: Write the failing registry tests**

Create `tests/seo-registry.test.ts` with these contracts:

```ts
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  SEO_PAGES,
  metadataFor,
  seoPage,
} from "@/modules/marketing/seo-pages";

describe("SEO page registry", () => {
  it("has one absolute canonical per unique path", () => {
    const paths = SEO_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of SEO_PAGES) {
      expect(metadataFor(page.path).alternates?.canonical).toBe(page.path);
      expect(page.title.trim()).not.toBe("");
      expect(page.description.length).toBeGreaterThanOrEqual(80);
    }
  });

  it("uses reviewed dates instead of the current clock", () => {
    expect(seoPage("/").modifiedAt).toBe("2026-09-12");
    expect(seoPage("/pricing").modifiedAt).toBe("2026-09-12");
    expect(seoPage("/faq").modifiedAt).toBe("2026-07-19");
    expect(seoPage("/privacy").modifiedAt).toBe("2026-07-19");
    expect(seoPage("/terms").modifiedAt).toBe("2026-07-05");
  });

  it("builds the sitemap from every published registry page", () => {
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      SEO_PAGES.filter((page) => page.index).map(
        (page) => `https://nudgeagent.app${page.path === "/" ? "" : page.path}`,
      ),
    );
    expect(entries.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `npm test -- tests/seo-registry.test.ts`

Expected: FAIL because `@/modules/marketing/seo-pages` does not exist.

- [ ] **Step 3: Implement the registry and metadata factory**

Create `src/modules/marketing/seo-pages.ts` with this public shape and these initial records:

```ts
import type { Metadata, MetadataRoute } from "next";

export const SITE_ORIGIN = "https://nudgeagent.app";

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  modifiedAt: `${number}-${number}-${number}`;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  index: boolean;
}

export const SEO_PAGES = [
  {
    path: "/",
    title: "Nudge: the AI Front Desk that runs your WhatsApp",
    description: "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk books into your real calendar, follows up with quiet leads, collects payments, and is set up with you.",
    modifiedAt: "2026-09-12",
    changeFrequency: "weekly",
    priority: 1,
    index: true,
  },
  {
    path: "/pricing",
    title: "Pricing",
    description: "Compare Nudge AI Front Desk plans for WhatsApp replies, team inboxes, real calendar booking, payment links, compliant follow-ups, voice, and custom actions.",
    modifiedAt: "2026-09-12",
    changeFrequency: "weekly",
    priority: 0.9,
    index: true,
  },
  {
    path: "/faq",
    title: "Frequently asked questions",
    description: "Answers about Nudge setup, pricing, trials, the official WhatsApp Cloud API, business-specific AI, calendar booking, follow-ups, payments, and data handling.",
    modifiedAt: "2026-07-19",
    changeFrequency: "monthly",
    priority: 0.6,
    index: true,
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    description: "Read how Nudge handles account, conversation, customer, integration and usage data for its business-specific AI Front Desk and WhatsApp workspace.",
    modifiedAt: "2026-07-19",
    changeFrequency: "yearly",
    priority: 0.2,
    index: true,
  },
  {
    path: "/terms",
    title: "Terms of service",
    description: "Read the terms that govern business use of Nudge, including accounts, WhatsApp messaging, acceptable use, subscriptions, integrations and service limitations.",
    modifiedAt: "2026-07-05",
    changeFrequency: "yearly",
    priority: 0.2,
    index: true,
  },
] as const satisfies readonly SeoPage[];

export type SeoPagePath = (typeof SEO_PAGES)[number]["path"];

export function seoPage(path: SeoPagePath): (typeof SEO_PAGES)[number] {
  const page = SEO_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`Unregistered SEO page: ${path}`);
  return page;
}

export function metadataFor(path: SeoPagePath): Metadata {
  const page = seoPage(path);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    robots: page.index ? undefined : { index: false, follow: false },
  };
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  return SEO_PAGES.filter((page) => page.index).map((page) => ({
    url: `${SITE_ORIGIN}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(`${page.modifiedAt}T00:00:00.000Z`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
```

Make `src/app/sitemap.ts` return `sitemapEntries()`. Replace duplicate title,
description and canonical blocks on home/pricing/FAQ with `metadataFor(...)`;
preserve page-specific Open Graph overrides by spreading the factory result.

- [ ] **Step 4: Run focused tests and type-check through the production build**

Run: `npm test -- tests/seo-registry.test.ts tests/landing-tracking.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with `/sitemap.xml` generated and no metadata type error.

- [ ] **Step 5: Commit the registry slice**

```bash
git add src/modules/marketing/seo-pages.ts src/app/sitemap.ts src/app/page.tsx src/app/pricing/page.tsx src/app/faq/page.tsx tests/seo-registry.test.ts
git commit -m "fix(seo): centralize canonical pages and truthful sitemap dates"
```

---

### Task 2: Index controls and anonymous marketing routes

**Files:**
- Modify: `src/app/robots.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/lib/supabase/proxy-session.ts`
- Test: `tests/seo-indexing.test.ts`

**Interfaces:**
- Produces: exported `PUBLIC_PATHS` used by the proxy and tests.
- Consumes: existing `updateSession()` behavior and Next.js metadata inheritance.
- Later tasks rely on `/industries`, `/resources`, `/features`, `/compare`, and `/how-it-works` being anonymous.

- [ ] **Step 1: Write failing indexing-contract tests**

Create `tests/seo-indexing.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { PUBLIC_PATHS } from "@/lib/supabase/proxy-session";

describe("SEO indexing controls", () => {
  it("allows crawlers to read HTML noindex directives", () => {
    const disallow = robots().rules;
    const text = JSON.stringify(disallow);
    expect(text).toContain("/api/");
    expect(text).toContain("/auth/");
    expect(text).not.toContain("/login");
    expect(text).not.toContain("/dashboard");
  });

  it("marks login and the authenticated app shell noindex", () => {
    expect(readFileSync("src/app/login/page.tsx", "utf8")).toContain("index: false");
    expect(readFileSync("src/app/(app)/layout.tsx", "utf8")).toContain("index: false");
  });

  it("makes every planned marketing route family public", () => {
    for (const path of ["/industries", "/features", "/compare", "/resources", "/how-it-works"]) {
      expect(PUBLIC_PATHS).toContain(path);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm export/noindex failures**

Run: `npm test -- tests/seo-indexing.test.ts`

Expected: FAIL because `PUBLIC_PATHS` is private and login/app layouts do not
export a robots directive.

- [ ] **Step 3: Implement explicit noindex and readable crawler rules**

- Export `PUBLIC_PATHS` and append the five exact route prefixes from the test.
- Add `export const metadata: Metadata = { robots: { index: false, follow: false } }`
  to `src/app/login/page.tsx` and `src/app/(app)/layout.tsx`.
- Reduce robots.txt HTML disallows to `/api/` and `/auth/`. Authentication
  remains the security boundary; crawlers can follow protected URLs to the
  crawlable noindex login response.
- Keep `Sitemap: https://nudgeagent.app/sitemap.xml` unchanged.

- [ ] **Step 4: Verify the focused contract and existing auth tests**

Run: `npm test -- tests/seo-indexing.test.ts tests/signup-closed.test.ts tests/admin-gate.test.ts`

Expected: PASS; public route declarations must not open workspace creation or
admin access.

- [ ] **Step 5: Commit index controls**

```bash
git add src/app/robots.ts src/app/login/page.tsx 'src/app/(app)/layout.tsx' src/lib/supabase/proxy-session.ts tests/seo-indexing.test.ts
git commit -m "fix(seo): make indexing controls explicit"
```

---

### Task 3: Structured-data and crawlable marketing primitives

**Files:**
- Create: `src/modules/marketing/structured-data.ts`
- Create: `src/components/marketing/seo/json-ld.tsx`
- Create: `src/components/marketing/seo/breadcrumbs.tsx`
- Create: `src/components/marketing/seo/landing-shell.tsx`
- Test: `tests/seo-structured-data.test.ts`

**Interfaces:**
- Produces: `breadcrumbJsonLd(items)`, `articleJsonLd(input)`, `JsonLd`, `Breadcrumbs`, `LandingShell`.
- `BreadcrumbItem = { name: string; path: string }`.
- `ArticleSchemaInput = { headline; description; path; publishedAt; modifiedAt; authorName }`.

- [ ] **Step 1: Write failing pure-builder tests**

```ts
import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  breadcrumbJsonLd,
} from "@/modules/marketing/structured-data";

describe("marketing structured data", () => {
  it("builds absolute ordered breadcrumbs", () => {
    const value = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Clinics", path: "/industries/clinics" },
    ]);
    expect(value["@type"]).toBe("BreadcrumbList");
    expect(value.itemListElement[1]).toMatchObject({
      position: 2,
      item: "https://nudgeagent.app/industries/clinics",
    });
  });

  it("keeps article facts aligned to the visible resource", () => {
    const value = articleJsonLd({
      headline: "WhatsApp appointment booking for clinics",
      description: "An operational guide for clinic owners evaluating WhatsApp appointment booking.",
      path: "/resources/whatsapp-appointment-booking-for-clinics",
      publishedAt: "2026-09-14",
      modifiedAt: "2026-09-14",
      authorName: "Nudge team",
    });
    expect(value).toMatchObject({
      "@type": "Article",
      datePublished: "2026-09-14",
      dateModified: "2026-09-14",
    });
    expect(value.mainEntityOfPage).toContain("/resources/");
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `npm test -- tests/seo-structured-data.test.ts`

Expected: FAIL because the structured-data module does not exist.

- [ ] **Step 3: Implement pure builders and small server components**

Use `SITE_ORIGIN` from Task 1. Builders return plain serializable objects.
`JsonLd` accepts `value: Record<string, unknown>` and renders exactly one
`<script type="application/ld+json">` with `JSON.stringify(value)`.

`Breadcrumbs` renders an ordered `<nav aria-label="Breadcrumb">` with Next.js
`Link` elements. `LandingShell` accepts:

```ts
interface LandingShellProps {
  breadcrumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
  ctaTitle?: string;
  ctaBody?: string;
}
```

It composes the existing `Navbar`, `Footer`, `Breadcrumbs`, semantic `<main>`,
one visible `<h1>`, and an existing `LaunchDemoButton`. It does not become a
client component and does not add a new visual dependency.

- [ ] **Step 4: Test and lint the primitives**

Run: `npm test -- tests/seo-structured-data.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit the primitives**

```bash
git add src/modules/marketing/structured-data.ts src/components/marketing/seo tests/seo-structured-data.test.ts
git commit -m "feat(seo): add crawlable marketing page primitives"
```

---

### Task 4: Clinic hub and homepage positioning correction

**Files:**
- Create: `src/app/industries/clinics/page.tsx`
- Create: `src/components/marketing/clinics/clinic-hub.tsx`
- Modify: `src/modules/marketing/seo-pages.ts`
- Modify: `src/components/marketing/v2/hero-v2.tsx`
- Modify: `src/components/marketing/navbar.tsx`
- Modify: `src/components/marketing/footer.tsx`
- Test: `tests/clinic-hub.test.ts`
- Test: `tests/seo-registry.test.ts`

**Interfaces:**
- Consumes: `metadataFor`, `breadcrumbJsonLd`, `JsonLd`, `LandingShell`.
- Produces: public canonical `/industries/clinics` and homepage link to it.

- [ ] **Step 1: Write the page-contract test before the route**

Create `tests/clinic-hub.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/industries/clinics/page.tsx", "utf8");
const body = readFileSync("src/components/marketing/clinics/clinic-hub.tsx", "utf8");
const hero = readFileSync("src/components/marketing/v2/hero-v2.tsx", "utf8");

describe("clinic SEO landing page", () => {
  it("owns the clinic receptionist intent with concrete front-desk actions", () => {
    expect(page).toContain('metadataFor("/industries/clinics")');
    expect(body).toContain("AI Front Desk for clinics");
    for (const phrase of ["real calendar", "follow", "payment", "human handoff", "official WhatsApp Cloud API"]) {
      expect(body.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it("does not claim generic CRM leadership or unsupported proof", () => {
    expect(`${page}\n${body}\n${hero}`).not.toContain("The #1");
    expect(`${page}\n${body}`.toLowerCase()).not.toContain("best whatsapp crm");
    expect(`${page}\n${body}`).not.toMatch(/\d+%|trusted by \d+/);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-page failure**

Run: `npm test -- tests/clinic-hub.test.ts`

Expected: FAIL because the clinic page/component files do not exist.

- [ ] **Step 3: Register and build the clinic hub**

Add this registry record after `/`:

```ts
{
  path: "/industries/clinics",
  title: "AI Front Desk for Clinics on WhatsApp",
  description: "Nudge answers clinic enquiries on WhatsApp, checks real calendar availability, books appointments, follows up with quiet leads, collects deposits, and hands complex conversations to staff.",
  modifiedAt: "2026-09-14",
  changeFrequency: "monthly",
  priority: 0.9,
  index: true,
}
```

The page composition must use these visible sections and no numeric outcome
claim:

1. H1: “An AI Front Desk for clinics, on WhatsApp.”
2. Intro: replies are only the start; Nudge books, follows up and collects.
3. “Where clinic revenue leaks” — after-hours enquiries, calendar back-and-forth,
   quiet leads and avoidable no-shows, described without invented percentages.
4. “What the Front Desk actually does” — answers from owner-provided knowledge,
   checks real calendar availability, creates bookings, sends approved-template
   follow-ups outside the service window, shares payment links and hands off.
5. “Built around the rules” — official Cloud API, opted-in outreach, permanent
   opt-out, approved templates outside 24 hours, one-business knowledge scope.
6. “Set up with your clinic” — owner questionnaire, knowledge review, calendar,
   templates, simulation and controlled go-live.
7. CTA: “See Nudge run your clinic's WhatsApp” / “Book a Demo”.

Change the homepage H1 to:

```text
The AI Front Desk
That Runs Your WhatsApp
```

Preserve the existing WhatsApp glyph on the word “WhatsApp”. Add a visible
“Clinics” link in desktop/mobile navigation and the footer. Do not link to
specialty pages until those pages exist.

- [ ] **Step 4: Verify page contract, registry and build output**

Run: `npm test -- tests/clinic-hub.test.ts tests/seo-registry.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS and build output lists `/industries/clinics` as a static route.

- [ ] **Step 5: Render-review desktop and mobile**

Start: `npm run dev`

Inspect `/` and `/industries/clinics` at 1440×900 and 390×844. Confirm one H1,
no horizontal overflow, keyboard-reachable CTA, visible text before client
scripts, and working home/clinic/pricing/FAQ links. Record screenshots under a
temporary ignored directory; do not commit them.

- [ ] **Step 6: Commit the first commercial page**

```bash
git add src/app/industries/clinics src/components/marketing/clinics src/modules/marketing/seo-pages.ts src/components/marketing/v2/hero-v2.tsx src/components/marketing/navbar.tsx src/components/marketing/footer.tsx tests/clinic-hub.test.ts tests/seo-registry.test.ts
git commit -m "feat(seo): launch clinic AI Front Desk hub"
```

---

### Task 5: Typed resource system and first operational guide

**Files:**
- Create: `src/content/resources/manifest.ts`
- Create: `src/content/resources/whatsapp-appointment-booking-for-clinics.tsx`
- Create: `src/app/resources/page.tsx`
- Create: `src/app/resources/[slug]/page.tsx`
- Modify: `src/modules/marketing/seo-pages.ts`
- Modify: `src/components/marketing/navbar.tsx`
- Modify: `src/components/marketing/footer.tsx`
- Test: `tests/resources.test.ts`

**Interfaces:**
- Produces: `ResourceRecord`, `RESOURCE_MANIFEST`, `ResourceSlug`, `publishedResources()`, `resourceBySlug(slug)`.
- Resource loader map lives only in the dynamic page and has exactly the manifest's published slugs.
- Consumes: metadata/structured-data primitives from Tasks 1 and 3.

- [ ] **Step 1: Write failing resource-manifest tests**

```ts
import { describe, expect, it } from "vitest";
import {
  publishedResources,
  resourceBySlug,
} from "@/content/resources/manifest";

describe("resource manifest", () => {
  it("publishes unique canonical slugs with honest dates", () => {
    const resources = publishedResources();
    expect(resources.map((item) => item.slug)).toEqual([
      "whatsapp-appointment-booking-for-clinics",
    ]);
    expect(new Set(resources.map((item) => item.slug)).size).toBe(resources.length);
    expect(resources[0]).toMatchObject({
      publishedAt: "2026-09-14",
      modifiedAt: "2026-09-14",
      parentPath: "/industries/clinics",
      draft: false,
    });
  });

  it("returns undefined for unknown or draft resources", () => {
    expect(resourceBySlug("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and confirm missing manifest failure**

Run: `npm test -- tests/resources.test.ts`

Expected: FAIL because the content manifest does not exist.

- [ ] **Step 3: Implement the manifest and routes**

The first record is:

```ts
{
  slug: "whatsapp-appointment-booking-for-clinics",
  title: "WhatsApp Appointment Booking for Clinics: An Operational Guide",
  description: "A practical guide to connecting clinic enquiries, real availability, booking confirmation, reminders, deposits and human handoff on WhatsApp.",
  excerpt: "Map the complete path from a patient's first message to a confirmed slot without hiding availability, consent or handoff rules.",
  publishedAt: "2026-09-14",
  modifiedAt: "2026-09-14",
  authorName: "Nudge team",
  parentPath: "/industries/clinics",
  draft: false,
}
```

`/resources` lists only `publishedResources()`. The detail route uses
`generateStaticParams`, `generateMetadata`, `notFound()`, visible breadcrumbs,
Article JSON-LD and this exact loader key:

```ts
const LOADERS = {
  "whatsapp-appointment-booking-for-clinics": () =>
    import("@/content/resources/whatsapp-appointment-booking-for-clinics"),
} as const;
```

Register `/resources` and the first resource URL in `SEO_PAGES`, both dated
`2026-09-14`; priorities are `0.7` and `0.6`, change frequency `weekly` and
`monthly` respectively.

- [ ] **Step 4: Write the evidence-backed guide**

The component renders an `<article>` beneath the route-owned H1 and contains
these sections in order:

1. “Start with the booking outcome, not the bot” — confirmed service, staff,
   date/time, location and next step.
2. “Keep one availability source of truth” — check the connected calendar before
   offering slots; never promise an unverified opening.
3. “Collect only what the clinic needs” — name, contact, requested service and
   booking preference; complex/clinical questions go to staff.
4. “Separate replies from re-engagement” — explain the 24-hour customer service
   window and approved templates using current official Meta documentation
   verified on the implementation date.
5. “Confirm, remind and recover” — confirmation, reminder, reschedule and no-show
   recovery; no numeric performance claim.
6. “Use deposits deliberately” — send a payment link when the clinic's policy
   requires it, then confirm payment status without collecting card data in chat.
7. “Design the human handoff” — urgency, uncertainty, complaint and explicit
   request triggers.
8. “Measure the full journey” — enquiry, offered slot, booked, attended,
   rescheduled, no-show and recovered.
9. An implementation checklist and CTA to `/industries/clinics`.

Link primary-source Meta material near policy claims. Label the article as
operational product guidance, not medical or legal advice. Do not quote a source
beyond its permitted limit and do not use competitor statistics as Nudge facts.

- [ ] **Step 5: Verify manifest, routes and rendered facts**

Extend `tests/resources.test.ts` to read both resource files and assert every
published slug has a loader, title and section headings, every draft has no
loader, and the guide contains `24-hour`, `approved template`, `human handoff`,
and `/industries/clinics`.

Run: `npm test -- tests/resources.test.ts tests/seo-registry.test.ts tests/seo-structured-data.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with static `/resources` and first resource route.

- [ ] **Step 6: Render-review and commit**

Review both resource pages at 1440×900 and 390×844 for readable measure,
heading hierarchy, external-link safety, visible dates/byline, CTA and related
clinic link.

```bash
git add src/content/resources src/app/resources src/modules/marketing/seo-pages.ts src/components/marketing/navbar.tsx src/components/marketing/footer.tsx tests/resources.test.ts tests/seo-registry.test.ts
git commit -m "feat(seo): add typed resources and clinic booking guide"
```

---

### Task 6: Browser attribution and Cal.com funnel events

**Files:**
- Create: `src/modules/marketing/analytics.ts`
- Modify: `src/components/marketing/book-demo.tsx`
- Modify: `src/components/marketing/get-access.tsx`
- Test: `tests/marketing-analytics.test.ts`
- Modify: `tests/landing-tracking.test.ts`

**Interfaces:**
- Produces: `pushMarketingEvent(event)`, `captureAttribution(location, referrer, storage, cookie)`, `calMetadata(attribution)`.
- `AttributionSnapshot = { landingPath; referrer?; utmSource?; utmMedium?; utmCampaign?; gaClientId? }`.
- Event union includes `demo_cta_click`, `generate_lead`, and `cal_embed_error` with a non-sensitive `surface`.

- [ ] **Step 1: Write deterministic attribution/event tests**

Create tests using a fake `Storage` and fake `dataLayer` rather than jsdom.
Cover:

```ts
expect(captureAttribution(
  new URL("https://nudgeagent.app/industries/clinics?utm_source=google&utm_medium=organic"),
  "https://www.google.com/",
  storage,
  "_ga=GA1.1.12345.67890",
)).toMatchObject({
  landingPath: "/industries/clinics",
  referrer: "https://www.google.com/",
  utmSource: "google",
  utmMedium: "organic",
  gaClientId: "12345.67890",
});
```

Also assert first-touch values do not change on a later page, values over 200
characters are truncated, unknown query parameters are excluded, storage
exceptions return a current-page fallback, and `pushMarketingEvent` appends one
plain object to `window.dataLayer` when available.

- [ ] **Step 2: Run and confirm missing analytics module**

Run: `npm test -- tests/marketing-analytics.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement typed, non-blocking attribution**

Use storage key `nudge:first-touch:v1`. Whitelist only `utm_source`,
`utm_medium`, and `utm_campaign`. Store path, origin-only referrer and the three
UTM values; do not store arbitrary query strings. Parse `_ga` only when it
already exists. All browser/storage/data-layer failures are caught and return
without blocking UI.

- [ ] **Step 4: Wire Cal embed events and lead-form success**

Add `surface: string` to `BookDemoButton` with default `unknown`, and pass stable
values from navbar, hero, pricing, clinic hub, resources and footer call sites.
On click push `{ event: "demo_cta_click", surface, landing_path }`.

After Cal namespace initialization, subscribe exactly once:

```ts
w.Cal.ns[CAL_NAMESPACE]("on", {
  action: "bookingSuccessfulV2",
  callback: (event: { detail?: { data?: { uid?: string } } }) => {
    pushMarketingEvent({
      event: "generate_lead",
      lead_source: "cal",
      booking_uid: event.detail?.data?.uid,
    });
  },
});
```

Subscribe to `linkFailed` and push `cal_embed_error` without the provider's raw
message or URL. Initialize `data-cal-config` with the existing static JSON during
SSR/hydration, then replace it in `useEffect` with the static layout plus only
the whitelisted UTM and `metadata[...]` values returned by `calMetadata()`.
Set `Cal.config.forwardQueryParams = false`; forwarding the entire page query
string would violate the whitelist and could leak an unrelated sensitive
parameter into Cal.com.

After `/api/access` succeeds, push `{ event: "generate_lead", lead_source:
"access_form" }`. Analytics failure must not change the form's success state.

- [ ] **Step 5: Verify event contracts and existing landing integration**

Run: `npm test -- tests/marketing-analytics.test.ts tests/landing-tracking.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit browser measurement**

```bash
git add src/modules/marketing/analytics.ts src/components/marketing/book-demo.tsx src/components/marketing/get-access.tsx tests/marketing-analytics.test.ts tests/landing-tracking.test.ts
git commit -m "feat(analytics): measure demo intent and Cal bookings"
```

---

### Task 7: Authoritative signed Cal booking ingestion

**Required pre-task skills:** `supabase:supabase`, `supabase:supabase-postgres-best-practices`, `superpowers:test-driven-development`.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/marketing/cal-webhook.ts`
- Create: `src/app/api/webhooks/cal/route.ts`
- Modify: `src/lib/env-schema.ts`
- Modify: `.env.example`
- Test: `tests/cal-webhook.test.ts`
- Test: `tests/cal-webhook-route.test.ts`
- Modify: `tests/env.test.ts`

**Interfaces:**
- Produces: `verifyCalSignature(rawBody, signature, secret)`, `parseCalBooking(rawBody)`, `ingestCalBooking(input)`.
- `ParsedCalBooking = { calUid; attendeeName?; attendeeEmail?; attendeePhoneE164?; eventType; startTime; attribution }`.
- Route responds 401 bad signature, 400 invalid JSON/schema, 200 ignored event, or 200 `{ ok: true }`.

- [ ] **Step 1: Write HMAC and whitelist tests**

In `tests/cal-webhook.test.ts`, sign raw payloads with
`crypto.createHmac("sha256", secret).update(raw).digest("hex")`. Assert correct
signature accepted; missing, malformed, tampered and wrong-secret signatures
rejected without throwing.

Use a `BOOKING_CREATED` fixture containing uid, type `30min`, startTime,
attendee, metadata, notes and an unexpected object. Assert the parser returns
only the declared `ParsedCalBooking` fields, normalizes a valid phone, truncates
attribution strings to 200 characters, and never returns notes, meeting URL or
the raw payload. Non-`BOOKING_CREATED` and non-`30min` events return `null`.

- [ ] **Step 2: Run tests and confirm missing module**

Run: `npm test -- tests/cal-webhook.test.ts`

Expected: FAIL because `cal-webhook.ts` does not exist.

- [ ] **Step 3: Add the platform-level booking model**

Add:

```prisma
model DemoBooking {
  id                 String   @id @default(cuid())
  calUid             String   @unique
  attendeeName       String?
  attendeeEmail      String?
  attendeePhoneE164  String?
  eventType          String
  startTime          DateTime
  source             String   @default("cal")
  status             String   @default("new")
  landingPath        String?
  referrer            String?
  utmSource           String?
  utmMedium           String?
  utmCampaign         String?
  gaClientId          String?
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([status, createdAt])
  @@index([createdAt])
}
```

This is a pre-signup platform lead, not tenant data. Run `npx prisma format` and
`npx prisma generate`. When applying to a database, use `npm run db:push` then
`npm run db:rls`; verify `DemoBooking.rowsecurity = true` before treating the
deployment as ready.

- [ ] **Step 4: Implement strict parsing, verification and idempotent storage**

Add optional `CAL_WEBHOOK_SECRET` and `CAL_EVENT_TYPE_SLUG` (default `30min`) to
`envSchema`; document both in `.env.example`. Signature comparison decodes
equal-length hex buffers and uses `crypto.timingSafeEqual`.

Use Zod to parse only required payload fields. `ingestCalBooking` uses:

```ts
await prisma.demoBooking.upsert({
  where: { calUid: input.calUid },
  create: { ...mappedInput },
  update: {
    startTime: input.startTime,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    attendeePhoneE164: input.attendeePhoneE164,
  },
});
```

Attribution fields are immutable after creation so retries cannot overwrite
first touch. The route reads the raw body before JSON parsing and fails closed
when the secret is absent.

- [ ] **Step 5: Write and run route tests**

Mock `prisma.demoBooking.upsert`. Assert bad signature never calls Prisma;
invalid JSON returns 400; irrelevant events return 200 without a write; two
valid identical deliveries call the same unique `calUid` upsert and return 200.

Run: `npm test -- tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts tests/env.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit signed booking ingestion**

```bash
git add prisma/schema.prisma src/modules/marketing/cal-webhook.ts src/app/api/webhooks/cal/route.ts src/lib/env-schema.ts .env.example tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts tests/env.test.ts
git commit -m "feat(analytics): ingest signed Cal demo bookings"
```

---

### Task 8: Qualified-lead pipeline and optional GA4 offline events

**Required pre-task skills:** `supabase:supabase`, `supabase:supabase-postgres-best-practices`, `superpowers:test-driven-development`.

**Files:**
- Modify: `src/modules/admin/leads.ts`
- Modify: `src/app/admin/leads/lead-row.tsx`
- Modify: `src/app/admin/leads/actions.ts`
- Create: `src/modules/marketing/ga4.ts`
- Modify: `src/lib/env-schema.ts`
- Modify: `.env.example`
- Modify: `tests/admin-leads.test.ts`
- Create: `tests/ga4-leads.test.ts`

**Interfaces:**
- Extends: `LeadKind` with `booking`; `LeadStatus` with `qualified`.
- Changes: `LeadRow.phoneE164` to `string | null` so Cal bookings without phone remain valid.
- Produces: `sendGa4LeadEvent({ name, clientId, leadId })` returning `Promise<"sent" | "skipped" | "failed">`.
- Event names are `qualify_lead`, `disqualify_lead`, and `close_convert_lead`.

- [ ] **Step 1: Extend failing admin-lead tests**

Update the hoisted Prisma mock with `demoBooking` methods. Add fixtures and
assert:

- booking rows merge newest-first with access/waitlist rows;
- a missing booking phone does not create a WhatsApp link;
- counts include new booking records;
- search covers attendee name/email/phone;
- `qualified` is accepted and `hot` remains rejected;
- moving a booking from `contacted` to `qualified` requests one
  `qualify_lead` event; saving notes without a transition requests none;
- `dismissed` maps to `disqualify_lead`; `converted` maps to
  `close_convert_lead`.

- [ ] **Step 2: Run and confirm the new booking/status failures**

Run: `npm test -- tests/admin-leads.test.ts`

Expected: FAIL because `booking` and `qualified` are not supported.

- [ ] **Step 3: Implement normalized booking leads and transitions**

Set:

```ts
export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "dismissed"] as const;
export type LeadKind = "access" | "waitlist" | "booking";
```

Fetch `DemoBooking` only when kind is all/booking. Normalize secondary to email
or scheduled date text, vertical to `"clinic"`, and source to persisted
`utmSource ?? source`. Make duplicate detection skip null phones. In the row UI,
render the WhatsApp anchor only when a phone exists; always render booking email
and scheduled date safely.

`updateLead` must load the current booking status before updating so it returns
the transition:

```ts
type LeadTransition = {
  previous: LeadStatus;
  current: LeadStatus;
  gaClientId: string | null;
} | null;

export type UpdateLeadResult =
  | { ok: true; transition: LeadTransition }
  | { ok: false; error: string };
```

The database update succeeds even if later analytics delivery fails.

- [ ] **Step 4: Write GA4 sender tests**

Mock `fetch`. Assert missing measurement ID, API secret or client ID returns
`skipped` without network; configured calls POST to
`https://www.google-analytics.com/mp/collect`; the body contains one standard
event, `client_id`, and `{ lead_id: "booking:<id>" }`; non-2xx and thrown fetch
return `failed` without throwing.

- [ ] **Step 5: Implement optional Measurement Protocol delivery**

Add optional `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` to env schema/example.
Implement a five-second abort timeout. Do not include email, phone, name, notes,
calendar time or landing URL in the event.

After a successful booking status transition, `updateLeadAction` invokes the
mapped GA4 event only when `gaClientId` exists. Await it for observability but do
not change the successful admin response when it is skipped/failed. Access and
waitlist leads remain internally measurable until they carry a consented GA
client ID; do not fabricate one.

- [ ] **Step 6: Verify admin and analytics behavior**

Run: `npm test -- tests/admin-leads.test.ts tests/ga4-leads.test.ts tests/admin-actions.test.ts`

Expected: PASS.

Run: `npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit lead-quality measurement**

```bash
git add src/modules/admin/leads.ts src/app/admin/leads/lead-row.tsx src/app/admin/leads/actions.ts src/modules/marketing/ga4.ts src/lib/env-schema.ts .env.example tests/admin-leads.test.ts tests/ga4-leads.test.ts
git commit -m "feat(analytics): connect booked demos to lead quality"
```

---

### Task 9: Baseline, operating runbook and release verification

**Files:**
- Create: `docs/SEO_BASELINE.md`
- Create: `docs/SEO_OPERATIONS.md`
- Modify: `PROGRESS.md`
- Review: every file changed by Tasks 1–8

**Interfaces:**
- Produces: the repeatable weekly/monthly/quarterly operating process and an
  evidence-dated baseline. No runtime interface.

- [ ] **Step 1: Write the baseline with explicit evidence states**

`docs/SEO_BASELINE.md` must record audit date, environment and:

- current published/indexable URL inventory;
- HTTP/canonical/robots/sitemap checks;
- current homepage title, H1 and primary CTA;
- asset sizes from the repository;
- the current target query families and observed result types;
- known competing pages with source URLs and observation date;
- `unknown` for GSC clicks/impressions, indexed coverage, GA4 conversions,
  Core Web Vitals and referring domains until account evidence exists;
- the exact access needed to replace each unknown.

Do not use a `site:` query as a complete indexed-page count and do not copy a
third-party traffic estimate into first-party baseline fields.

- [ ] **Step 2: Write the operating runbook**

`docs/SEO_OPERATIONS.md` must contain:

1. Search Console domain-property verification and sitemap submission checklist.
2. GTM/GA4 checklist for `demo_cta_click`, `generate_lead`, `qualify_lead`,
   `disqualify_lead`, and `close_convert_lead`.
3. Cal.com checklist: event type `hqnudge/30min`, UTM tracking fields, webhook
   URL `/api/webhooks/cal`, `BOOKING_CREATED`, secret configured and one test
   booking deduplicated.
4. Weekly incident checks for tracking, 5xx, indexing and material anomalies.
5. Monthly report table: non-brand impressions/clicks, organic bookings,
   attended, qualified, customers, page/query opportunities and actions.
6. Quarterly technical/content/authority review.
7. 30/60/90-day page review decision tree: retain, improve, merge+redirect, or
   retire+redirect; never delete a linked URL without mapping it.
8. Claim-review and content-publication checklist from the design.
9. Market-expansion gate requiring sales readiness, distinct content and demand.
10. Secret rotation and webhook-failure procedure without printing payloads.

- [ ] **Step 3: Run focused and complete verification**

Run:

```bash
npm test -- tests/seo-registry.test.ts tests/seo-indexing.test.ts tests/seo-structured-data.test.ts tests/clinic-hub.test.ts tests/resources.test.ts tests/marketing-analytics.test.ts tests/cal-webhook.test.ts tests/cal-webhook-route.test.ts tests/ga4-leads.test.ts tests/admin-leads.test.ts tests/landing-tracking.test.ts tests/env.test.ts
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0. Record exact counts and build routes; do not say
“all tests pass” from partial output.

- [ ] **Step 4: Perform end-to-end anonymous and conversion checks**

With the local production server:

1. `/`, `/industries/clinics`, `/resources`, and the first resource return 200
   without a session.
2. `/dashboard` redirects a signed-out visitor to crawlable `/login` and login
   renders `noindex, nofollow`.
3. `/sitemap.xml` has fixed reviewed dates and every published canonical URL.
4. `/robots.txt` points to the sitemap and does not block crawlable noindex HTML.
5. A demo CTA pushes `demo_cta_click` without changing Cal behavior.
6. Cal dry-run success pushes `generate_lead` but does not create an authoritative
   booking.
7. One correctly signed `BOOKING_CREATED` fixture creates a booking; replaying it
   leaves one row.
8. Marking it qualified succeeds even when GA4 is unconfigured; with a mocked or
   debug GA4 destination it emits no personal data.

Render-review all new public pages at 1440×900 and 390×844. Validate canonical,
robots and JSON-LD using rendered HTML, not source-file inference alone.

- [ ] **Step 5: Update progress with only verified claims**

Add a newest-first `PROGRESS.md` entry listing the shipped URLs, measurement
events, test/build evidence, visual review, and external account steps still
pending. If GSC, GA4, DNS, Cal secret or production database were not actually
configured, state that plainly.

- [ ] **Step 6: Commit the verified foundation handoff**

```bash
git add docs/SEO_BASELINE.md docs/SEO_OPERATIONS.md PROGRESS.md
git commit -m "docs(seo): add organic growth baseline and runbook"
```

---

## Self-review result

- **Spec coverage:** This first release covers indexing, a typed registry,
  sitemap truth, public routing, reusable SEO components, clinic-hub positioning,
  the first resource, browser and authoritative booking measurement, lead
  quality, baseline and operations. The remaining specialty/capability pages,
  About/legal identity, case studies, authority outreach and international pages
  remain correctly sequenced after the foundation; the 34-month roadmap stays in
  the approved design.
- **Dependency boundary:** Tasks 1–6 run without production Supabase, GA4, GSC or
  Cal secrets. Tasks 7–8 build and test safely with mocks but production
  activation requires the documented database, RLS, Cal, GTM/GA4 and account
  access checks.
- **Type consistency:** `SeoPagePath` is derived from `SEO_PAGES` and expands as
  records are added. Resource slug, loader key and manifest key are identical.
  `DemoBooking.calUid` is the idempotency key. Admin lead kinds/statuses and GA4
  event mappings use the exact names declared above.
- **No speculative scale:** No city pages, external CMS, backlink automation,
  customer metrics or international duplication are included.
