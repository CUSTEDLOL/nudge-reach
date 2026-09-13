# Nudge — 34-month SEO program design

Date: 2026-09-14. Status: approved for implementation planning.

## 1. Decision

Nudge will run a vertical, commercial-first SEO program whose primary outcome is
**qualified organic demo bookings from high-ticket Indian clinics**. The first
beachhead is cosmetic dental, aesthetic dermatology and hair-transplant clinics.
Later market expansion follows product strategy (India → Malaysia → Singapore →
UAE) only when sales readiness and search evidence justify it.

SEO must strengthen Nudge's AI Front Desk position. It must not turn the product
into another generic WhatsApp CRM or lead with campaign blasting. The message is
that Nudge answers, books into real systems, follows up compliantly, collects
payments and is configured for the business.

Rankings, traffic and impressions are diagnostic metrics. The north-star metric
is qualified organic demo bookings per month; organic-sourced customers and
revenue are the final outcome. No ranking position is guaranteed.

## 2. Evidence behind the decision

### Current-site audit

- The live site is served over HTTPS by Vercel and the homepage is statically
  prerendered.
- Next.js metadata, canonical URLs, Open Graph metadata, Organization and
  SoftwareApplication JSON-LD, robots.txt and a sitemap already exist.
- The sitemap exposes only five public URLs: home, pricing, FAQ, privacy and
  terms. There is no resource hub, industry landing-page system, public author
  identity or case-study library.
- Sitemap dates are generated together at build time, causing unchanged pages
  to look newly modified after deployments.
- robots.txt disallows authenticated paths and `/login`, but a robots rule is
  not an indexing-removal mechanism. Private and utility surfaces need explicit
  `noindex` or authentication responses crawlers can evaluate.
- The authentication proxy allowlists public paths individually. Every new
  marketing route family must be made public deliberately or it will redirect
  anonymous visitors and crawlers to `/login`.
- The homepage H1 currently says “The #1 WhatsApp Agent That Handles Your
  Business.” The `#1` claim is unsupported, the phrase is generic, and it
  weakens the approved AI Front Desk positioning.
- The live homepage primarily converts through a Cal.com modal. GTM is present,
  but the repository contains no verified completed-booking or qualified-lead
  measurement. The older lead form exists but is not rendered on the current
  homepage.
- The response contains substantial markup and the homepage carries large
  visual assets (desktop hero videos around 2.2–2.6 MB and a CTA image around
  1.1 MB). This is a performance risk to measure, not proof of a failing Core
  Web Vital. The public PageSpeed endpoint was quota-limited during the audit,
  so no synthetic score is asserted.
- Public trust surfaces are thin: there is no About or author page, contact uses
  a Gmail address, and the terms still contain `[Legal Entity Name]`.

### Search-result audit

Current results for clinic AI receptionist and WhatsApp automation queries are
won by focused vertical pages, including clinic-wide, cosmetic-dental,
hair-transplant and aesthetic-clinic pages. Competitors describe concrete
workflows—availability, booking, reminders, deposits and follow-up—rather than
depending on one broad homepage.

This validates a small set of strong intent pages before broad informational or
programmatic expansion. It does not establish reliable search volume. Volume
and demand estimates remain unverified until Search Console and a keyword-data
source are connected.

### Primary external references

- Google: [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- Google: [people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Google: [robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- Google: [block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- Google: [Search Console performance reports](https://support.google.com/webmasters/answer/7576553)
- Google: [GA4 lead-generation events](https://support.google.com/analytics/answer/9267735)
- Cal.com: [embed events](https://cal.com/help/embedding/embed-events)
- Cal.com: [signed booking webhooks](https://cal.com/docs/developing/guides/automation/webhooks)

## 3. Goals and boundaries

### Goals

1. Establish trustworthy organic acquisition and lead-quality measurement.
2. Make every public page crawlable, indexable by intent and technically sound.
3. Build topical authority around the work of an AI Front Desk for high-value
   appointment businesses.
4. Convert organic demand into booked, attended, qualified demos and customers.
5. Earn relevant authority through useful assets, product evidence, partners
   and real customer outcomes.
6. Operate a repeatable 34-month measurement, publishing and refresh loop.

### Non-goals

- Promising a number-one ranking or treating average position as the business
  result.
- Publishing mass-generated pages, lightly rewritten city pages or search-first
  filler.
- Buying links, using private link networks, fabricating reviews or inventing
  statistics and case studies.
- Calling Nudge a WhatsApp CRM in the headline or making campaigns the story.
- Claiming medical, legal, security, partner or compliance status without
  review and evidence.
- Publishing country variants before Nudge can sell, support and substantiate
  the offer in that market.

## 4. Search market and page ownership

Nudge will own the intersection:

> AI Front Desk × WhatsApp × high-value appointment businesses × India

One primary URL owns each intent family to prevent cannibalization.

| URL | Primary intent | Job |
|---|---|---|
| `/` | AI Front Desk on WhatsApp | Category and brand page |
| `/industries/clinics` | AI receptionist for clinics India | Clinic solution hub |
| `/industries/cosmetic-dental-clinics` | AI receptionist for dental clinics | Specialty conversion page |
| `/industries/aesthetic-clinics` | WhatsApp automation for aesthetic clinics | Specialty conversion page |
| `/industries/hair-transplant-clinics` | WhatsApp automation for hair-transplant clinics | Specialty conversion page |
| `/features/whatsapp-appointment-booking` | WhatsApp appointment-booking automation | Real-calendar capability |
| `/features/automated-lead-follow-up` | WhatsApp lead-follow-up automation | Ghosted-lead/no-show recovery |
| `/features/whatsapp-payment-collection` | Collect payments through WhatsApp | Deposits and payment links |
| `/features/google-calendar-booking` | WhatsApp Google Calendar integration | Integration buying intent |
| `/how-it-works` | How an AI WhatsApp receptionist works | Workflow, setup and handoff |
| `/compare/meta-business-agent` | Meta Business Agent comparison | External-action/outbound moat |
| `/compare/whatsapp-chatbot-vs-ai-front-desk` | Chatbot vs AI receptionist | Category education |
| `/resources` | Clinic operational questions | Resource hub |
| `/pricing` | WhatsApp AI receptionist pricing | Commercial evaluation |
| `/faq` | Product objections and setup | Conversion support |

The homepage direction is “The AI Front Desk that books, follows up and
collects payments on WhatsApp.” Final copy must remain accurate to shipped and
entitled features.

Initial supporting content forms four clusters:

1. Patient enquiries and qualification.
2. Appointment booking and no-show reduction.
3. Compliant follow-up and lead recovery.
4. Deposits, payments, integrations and front-desk economics.

Every supporting article has one parent commercial page and one next action.
“WhatsApp CRM” may appear as a secondary comparison phrase, never as Nudge's
identity. City pages wait until unique local evidence and query demand exist.

### Keyword prioritization

- **P0:** AI receptionist for clinics India, WhatsApp AI receptionist for
  clinics and the three specialty variants.
- **P1:** WhatsApp appointment booking, automated lead/patient follow-up,
  no-show recovery, Google Calendar booking and payment collection.
- **P2:** Meta Business Agent comparisons, AI Front Desk versus chatbot,
  automation cost and official Cloud API setup.
- **P3:** broad CRM and city queries, considered only after conversion and
  impression evidence.

A query enters production only when it has distinct intent, product fit, a
credible evidence-backed angle and a conversion path. Search volume must be
labeled unknown until sourced.

## 5. Conversion and measurement design

### Funnel

| Stage | Event | Meaning |
|---|---|---|
| Organic landing | session attribution | Search-sourced visit and landing page |
| Demo opened | `demo_cta_click` | Secondary intent signal |
| Demo scheduled | `generate_lead` plus authoritative booking | Primary website conversion |
| Demo attended/worked | `working_lead` | Sales engagement |
| Clinic qualifies | `qualify_lead` | Primary SEO quality KPI |
| Customer closes | `close_convert_lead` | Revenue outcome |

The browser can use Cal.com's `bookingSuccessfulV2` event for immediate UX and
analytics feedback. A secret-verified, idempotent `BOOKING_CREATED` webhook is
the authoritative booking record. A browser event alone is insufficient
because blockers, navigation and duplicate events can distort it.

Attribution records first touch and last touch separately: source, medium,
campaign, landing path and referrer. The Cal booking UID deduplicates events.
Lead status changes connect the current admin pipeline to GA4's recommended B2B
lead events. Analytics must never include patient information, conversation
content, secrets or sensitive questionnaire answers.

### Reporting hierarchy

- **North star:** qualified organic demo bookings per month.
- **Revenue:** organic customers, subscription revenue and time-to-close.
- **Funnel:** booked, attended, qualified and purchased conversion rates.
- **Demand:** relevant non-brand clicks and impressions by page/query/country.
- **Experience:** commercial-page conversion, crawl/index coverage and Core Web
  Vitals.
- **Authority:** relevant referring domains and links earned to priority pages.
- **Guardrails:** query cannibalization, stale/zero-value pages, broken links,
  tracking failures and unsupported claims.

Daily rank checks are not the scorecard. Search Console's query, page, country
and device data and conversion trends drive decisions. Sparse early data is
reported as sparse rather than inflated into percentages.

## 6. Content production design

### Workflow

1. Confirm current intent using live results and available first-party data.
2. Assign the query family to exactly one canonical page.
3. Brief the reader, problem, decision stage, evidence and conversion path.
4. Gather founder, product or clinic-subject-matter input.
5. Draft with real workflows, original visuals/examples and cited sources.
6. Fact-check product, Meta-policy, pricing, medical and legal statements.
7. Add metadata, canonical, internal links and only applicable schema.
8. Render-test mobile/desktop, accessibility, performance and crawlability.
9. Publish, submit/inspect and annotate the reporting timeline.
10. Review at 30, 60 and 90 days; improve, merge, redirect or retire based on
    evidence.

Each page needs an element competitors cannot cheaply reproduce: product
screenshots, a working simulation, an owner/operator interview, an original
calculator, a compliant workflow template, anonymized aggregate evidence or a
real customer story. Dates change only after substantive review.

### Initial pace

- Month 1: measurement, technical corrections, content framework, homepage and
  clinic hub.
- Month 2: three specialty pages, two capability pages and two supporting
  resources.
- Month 3: remaining priority capability/comparison pages and three to four
  supporting resources.
- Thereafter: approximately two substantial new pages and two meaningful
  refreshes per month, adjusted by demand and sales evidence.

## 7. Technical architecture

- Public marketing content is statically renderable in the Next.js App Router.
- A typed content registry is the single source for slug, title, description,
  published/modified dates, canonical, parent cluster, authorship, draft state
  and social image.
- Long-form resources use the smallest maintainable local content format; avoid
  a remote CMS until multiple non-developer editors create a demonstrated need.
- Sitemap generation consumes only published registry entries and uses truthful
  modification dates.
- Draft and unknown slugs return 404 and never appear in navigation, feeds or
  sitemaps.
- Page templates produce visible breadcrumbs plus BreadcrumbList schema. Article
  schema is limited to genuine articles. Product/offer data comes from approved
  pricing sources rather than duplicated constants.
- New public route prefixes are explicitly allowed by the auth proxy. Login,
  authenticated app, admin, payment and utility surfaces carry appropriate
  `noindex` controls; security still relies on authentication, never SEO tags.
- Related links come from explicit cluster relationships, not uncontrolled
  keyword matching.
- HTML remains useful without client JavaScript. Heavy motion, video and embeds
  load without blocking the main content or primary CTA.

### Failure handling and build gates

- Invalid or duplicate slugs, canonicals, titles or primary page ownership fail
  validation.
- Invalid frontmatter or JSON-LD fails CI.
- Broken first-party links, missing sitemap entries and accidental draft
  publication fail CI.
- Cal webhook signatures, duplicate delivery and unknown versions fail safely
  without recording a conversion.
- Analytics failure never blocks demo booking.
- External-source outages do not remove already published static content.
- Unsupported claims are removed or softened; missing evidence is never filled
  with invented copy.

### Test coverage

- Public routes return 200 anonymously and protected routes remain protected.
- Every indexable page has one canonical, unique title/description and one
  meaningful H1.
- Private routes expose the intended robots directive.
- Sitemap contains every and only published canonical page.
- JSON-LD parses and matches visible facts.
- Unknown/draft resources return 404.
- Internal links resolve without redirect chains.
- Booking events deduplicate and reject invalid signatures.
- Production build, lint, unit suite and representative rendered-page checks
  remain green.

## 8. Authority and trust design

Nudge earns authority through proof, not link volume.

- Publish a real About page, founder bios and domain-based contact address.
- Correct legal identity and review public policies before using them as trust
  signals.
- Use named authors and reviewers where the subject needs specialist review.
- Show product workflows, screenshots and simulations.
- Publish attributable clinic case studies only after permission and with a
  clear measurement method.
- Create useful linkable assets such as a clinic front-desk cost calculator and
  compliant WhatsApp follow-up template library.
- Publish anonymized benchmarks only after sufficient representative data and
  privacy review.
- Earn relevant integration/partner listings where Nudge is actually eligible.
- Pursue founder commentary, webinars, podcasts and editorial contributions in
  clinic operations, healthcare business and WhatsApp ecosystems.
- Reclaim broken/unlinked mentions and conduct targeted editorial outreach each
  quarter.

Bought links, mass directories, reciprocal link schemes, fake reviews and
irrelevant guest-post networks are prohibited.

## 9. Operating roadmap

| Period | Outcome |
|---|---|
| Weeks 1–2 | GSC, GA4/GTM, booking attribution, crawl baseline and KPI dashboard |
| Months 1–3 | Technical foundation, content system and initial commercial/content cluster |
| Months 4–6 | Query-driven improvements, integrations/comparisons and first genuine case study |
| Months 7–12 | Deepen the best-converting India specialty and launch linkable assets |
| Months 13–18 | Customer evidence, workflow benchmarks, partnerships and pruning |
| Months 19–22 | Malaysia localization only if demand and sales readiness are proven |
| Months 23–26 | Singapore localization with unique pricing, language and evidence |
| Months 27–30 | Test UAE or reinvest in India if international evidence is weak |
| Months 31–34 | Consolidate authority, refresh winners and optimize conversion |

Cadence:

- Weekly: tracking, indexing, crawl and material traffic anomalies.
- Monthly: queries, pages, qualified demos, lead quality and the content queue.
- Quarterly: technical crawl, Core Web Vitals, content decay, competitors and
  earned authority.
- Six-monthly: market allocation, architecture and conversion review.
- Annually: strategy reset based on customer and revenue evidence.

Market pages are genuinely localized and use hreflang only when distinct market
versions exist. A country name swap is not localization.

## 10. First implementation boundary

The first implementation plan should cover the foundation, not all 34 months of
pages in one release:

1. Technical indexing and public-route corrections.
2. Typed SEO/content registry and sitemap integration.
3. Measurement instrumentation through completed and qualified demo stages.
4. Homepage positioning correction and clinic-hub foundation.
5. Resource templates and CI validation.
6. Baseline report and operating runbook.

Specialty pages and ongoing articles follow through small, reviewable batches.
Publishing medical/legal claims, international localization, case-study metrics
or aggregate benchmarks requires the corresponding real evidence and approval.

## 11. External access and decisions needed during execution

- DNS or existing Search Console owner access.
- GTM and GA4 access, including confirmation of the active GA4 property.
- Cal.com access for embed configuration and a signed webhook.
- A domain-based company email and confirmed legal entity name.
- Founder/subject-matter interviews and permission for any customer story.
- A keyword-volume source if volume-based forecasts are requested.

Lack of those inputs does not block the code/content foundation. It does block
claiming end-to-end production measurement, verified search baselines or genuine
customer proof.
