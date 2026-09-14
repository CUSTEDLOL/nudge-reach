# SEO release baseline

Audit date: **2026-09-15**
Runtime/content snapshot: Tasks 1–8 through `df8ffd9`, compared with program base
`7232ce6`. This baseline document was introduced by Task 9 in `a817658`; it does
not treat Task 9's documentation commit as part of the runtime snapshot.
Environment: local Next.js 16.2.9 production build in simulation mode, served on
`127.0.0.1` with documented non-secret Supabase placeholders. This is a release
baseline, not evidence that the branch is deployed or that production accounts,
DNS, analytics, Cal.com or the database were changed.

## Evidence states

- **Verified locally** means reproduced from the production build, rendered HTML,
  repository files or automated tests on the audit date.
- **Observed externally** means returned by a read-only web search on the audit
  date. It is a point-in-time sample, not a ranking or search-volume claim.
- **Unknown** means no first-party account or production evidence was available.
  Unknown is not zero.

## Published and indexable release inventory

The typed registry and generated sitemap contain these eight indexable canonical
URLs. Dates are fixed review dates, not deployment timestamps.

| URL | Reviewed/modified | Build result |
|---|---:|---|
| `https://nudgeagent.app/` | 2026-09-12 | Static |
| `https://nudgeagent.app/industries/clinics` | 2026-09-14 | Static |
| `https://nudgeagent.app/resources` | 2026-09-14 | Static |
| `https://nudgeagent.app/resources/whatsapp-appointment-booking-for-clinics` | 2026-09-14 | SSG |
| `https://nudgeagent.app/pricing` | 2026-09-12 | Static |
| `https://nudgeagent.app/faq` | 2026-07-19 | Static |
| `https://nudgeagent.app/privacy` | 2026-07-19 | Static |
| `https://nudgeagent.app/terms` | 2026-07-05 | Static |

This inventory describes the reviewed branch. Production publication and Google
indexing remain unknown until deployment and Search Console evidence exist. No
`site:` query was used as an indexed-page count.

## Local HTTP, metadata and discovery checks

The local production server was tested without a session. The first start
returned HTTP 500 for every route because empty local Supabase URL/key values
caused the auth proxy to fail before routing. Restarting the same build with the
documented non-secret simulation placeholders isolated that environment issue;
the checks below then passed.

| Path | HTTP result | Canonical in rendered HTML | H1 | JSON-LD |
|---|---|---|---:|---:|
| `/` | 200 | `https://nudgeagent.app` | 1 | 1 graph script |
| `/industries/clinics` | 200 | `https://nudgeagent.app/industries/clinics` | 1 | 1 BreadcrumbList |
| `/resources` | 200 | `https://nudgeagent.app/resources` | 1 | none (not applicable) |
| `/resources/whatsapp-appointment-booking-for-clinics` | 200 | matching absolute URL | 1 | 2: BreadcrumbList and Article |
| `/dashboard` | 307 | redirects to `/login` | n/a | n/a |
| `/login` | 200 | none | 1 | none; rendered `noindex, nofollow` |
| `/sitemap.xml` | 200, `application/xml` | n/a | n/a | all eight canonical URLs and fixed dates |
| `/robots.txt` | 200, `text/plain` | n/a | n/a | allows `/`; disallows only `/api/` and `/auth/`; names the sitemap |

The rendered JSON-LD scripts parsed as JSON. The article headline and
published/modified dates matched the visible resource facts. These local checks
do not establish production HTTP status, crawl history or indexed coverage.

## Homepage conversion surface

Verified from rendered local production HTML and the 1440×900 and 390×844
screenshots:

- Title: `Nudge: the AI Front Desk that runs your WhatsApp`
- H1: `The AI Front Desk That Runs Your WhatsApp`
- Primary CTA: `Book a Demo`, implemented as a button that retains
  `data-cal-link="hqnudge/30min"` and the `30min` namespace.
- Secondary CTA: `Get Access`.

The exact-viewport screenshots covered `/`, `/industries/clinics`, `/resources`
and the guide at 1440×900 and 390×844. Headline wrapping, readable measure and
the visible navigation showed no visible clipping. A follow-up scripted
keyboard/mobile-menu/DOM probe did not return a result, so it is not counted as
a pass; the screenshots, rendered HTML checks and automated behavior tests are
the evidence retained.

### Conversion E2E handoff limitation

The Task 9 verification handoff is **incomplete for interactive and
database/authenticated conversion E2E**. No local Postgres binaries or listening
Postgres/Supabase ports were present, the repository has no installed Supabase
CLI, and the installed Docker client could not connect to a running daemon. No
database service was installed or started to expand the task scope. Consequently,
these four local-production checks remain pending:

1. Click a rendered demo CTA and observe exactly one `demo_cta_click` while Cal
   trigger behavior remains intact.
2. Complete a Cal embed dry-run and observe aggregate `generate_lead` without an
   authoritative booking write.
3. Send a correctly signed `BOOKING_CREATED` staging fixture to a disposable
   database, then resend it and confirm exactly one row with unchanged first-touch
   attribution.
4. Authenticate as an authorized founder, mark that stored booking qualified,
   verify success with GA4 unconfigured, then repeat against a mocked/debug GA4
   endpoint and inspect the restricted payload fields.

Unit/integration tests cover the underlying event, signature, upsert, transition
and analytics boundaries. They do not replace these omitted E2E checks.

## Repository asset baseline

These are source-file sizes, not compressed transfer sizes or performance
scores. The 22 files under `public/` total **9,103,347 bytes** (about 8.68 MiB).

| Asset | Bytes | Approx. MiB |
|---|---:|---:|
| `public/hero/finale.mp4` | 2,733,049 | 2.61 |
| `public/hero/park-cta-v2.mp4` | 2,282,471 | 2.18 |
| `public/cta/bottom-cta.png` | 1,153,325 | 1.10 |
| `public/logo.png` | 766,018 | 0.73 |
| `public/hero/finale-mobile.mp4` | 328,993 | 0.31 |
| `public/hero/park-cta-v2-mobile.mp4` | 328,759 | 0.31 |
| `public/hero/front-desk.jpg` | 274,856 | 0.26 |
| `public/hero/grass-edge.png` | 214,973 | 0.21 |

The large desktop video and CTA assets are performance risks to measure. Their
sizes do not prove a Core Web Vitals failure.

## Query families and result-type observation

The approved India-first query ownership remains:

- P0: AI/WhatsApp receptionist for clinics in India, then cosmetic-dental,
  aesthetic-dermatology and hair-transplant variants.
- P1: WhatsApp appointment booking, automated lead/patient follow-up, no-show
  recovery, Google Calendar booking and payment collection.
- P2: Meta Business Agent comparisons, AI Front Desk versus chatbot, automation
  cost and official Cloud API setup.
- P3: broad CRM and city terms only after demand and conversion evidence.

A read-only sample on 2026-09-15 used four queries: `AI receptionist for clinics
India WhatsApp`, `WhatsApp appointment booking automation clinics`, `AI
receptionist cosmetic dental clinics WhatsApp`, and `WhatsApp automation hair
transplant clinics`. The reproducibly recorded result type was focused vendor
landing pages. No reliable volume, position or traffic estimate was inferred.

Known competing pages returned in that sample included:

- [Deskyn AI — WhatsApp AI receptionist for appointment businesses](https://www.deskynai.in/)
- [FirstHelloAI — clinic AI receptionist and appointment booking](https://firsthelloai.com/clinics)
- [AiVaak Clinic — AI WhatsApp receptionist for Indian clinics](https://aivaak.com/clinic/)
- [Jessica AI — AI receptionist for medical clinics](https://jessicaai.in/medical-clinics)
- [NEVRMISS — clinic AI receptionist](https://nevrmiss.in/)
- [CareBuddy AI — clinic AI receptionist on WhatsApp](https://getcarebuddy.com/)

These URLs are search-result observations only. Their claims, prices and usage
figures were not adopted as Nudge facts.

## First-party baseline gaps and required access

| Field | State on 2026-09-15 | Evidence needed to replace `unknown` |
|---|---|---|
| GSC clicks and impressions | **unknown** | Read access to the verified `nudgeagent.app` Search Console domain property; export Performance results for the agreed date range, Web search type, queries/pages/countries/devices, and brand/non-brand classification. |
| Google indexed coverage | **unknown** | Owner or full-user access to the same domain property; Pages report export plus URL Inspection for each canonical after deployment and sitemap submission. |
| GA4 conversions/key events | **unknown** | Viewer/Analyst access to the confirmed production GA4 property and read access to the active GTM container; verify stream ID, tag versions, DebugView/Realtime events and key-event configuration. |
| Qualified organic demos/customers | **unknown** | Production `DemoBooking` schema applied with RLS verified, Cal webhook activated, source fields present, and authorized founder lead-pipeline/report access. |
| Core Web Vitals | **unknown** | Search Console Core Web Vitals access and sufficient field data, or a dated CrUX/PageSpeed field-data export; keep lab data separately labeled. |
| Referring domains | **unknown** | Search Console Links export and, if fuller coverage is required, dated read access/export from an approved backlink index. Do not substitute a traffic estimate. |
| DNS/domain-property verification | **unknown** | DNS provider access or confirmation from an existing verified Search Console owner, plus the final verification record and property screenshot/export. |
| Production HTTP and deployment state | **unknown** | Read access to the production deployment and logs, followed by the same anonymous HTTP/render checklist against `https://nudgeagent.app`. |

The activation procedure and recurring measurement cadence are in
[`SEO_OPERATIONS.md`](./SEO_OPERATIONS.md).
