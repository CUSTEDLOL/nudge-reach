# SEO operations runbook

Owner: founder/growth operator, with engineering for releases and incidents
Program: **four-month India sprint**
Checkpoints: end of **month 2** and end of **month 4**. Quarterly reviews apply
only after the sprint if the program is renewed; they are not extra months in
this sprint.

Never put secrets, raw webhook bodies, contact details, patient information,
Cal notes, meeting URLs or conversation content in tickets, analytics, logs or
this runbook.

## Production activation gates

Before calling measurement live:

- [ ] Deploy the reviewed release and repeat the anonymous HTTP/render checks.
- [ ] Apply the Prisma schema with the authorized production workflow.
- [ ] Run the repository RLS step and verify `pg_tables.rowsecurity = true` for
  `DemoBooking`; confirm there are no browser policies for this server-only table.
- [ ] Complete Search Console, GTM/GA4 and Cal.com setup below.
- [ ] Record operator, timestamp, property/container/event-type IDs and evidence
  links without copying credentials or webhook payloads.
- [ ] Keep simulation as the default until every live gate is evidenced.

## Search Console domain property and sitemap

- [ ] Ask the existing domain owner whether a `nudgeagent.app` domain property
  already exists; do not create a duplicate without checking.
- [ ] If needed, create a **Domain** property for `nudgeagent.app`.
- [ ] Copy Google's TXT verification value into the DNS provider, preserving
  existing records. This is an authorized external change and needs the domain
  owner.
- [ ] Wait for DNS propagation, verify the property, and record the verified
  owner and date. Never paste unrelated DNS-zone contents into the record.
- [ ] Submit `https://nudgeagent.app/sitemap.xml`.
- [ ] Confirm the sitemap can be fetched with HTTP 200 and that discovered URLs
  match the published registry. A submitted or discovered URL is not proof of
  indexing.
- [ ] Inspect the homepage, clinic hub, resources index and first guide after
  deployment. Record canonical selected by Google, last crawl and any exclusion.
- [ ] Export Pages and Performance baselines. Do not use a `site:` query as a
  complete indexed-page count.

## GTM and GA4

Confirm the active web stream and GTM container before changing tags. Use Preview
and GA4 DebugView/Realtime, then publish one reviewed container version with a
plain-language version note.

| Event | Source | Allowed parameters | Verification |
|---|---|---|---|
| `demo_cta_click` | Browser `dataLayer` | `surface`, `landing_path` | Click one demo CTA per stable surface; exactly one event; Cal trigger attributes and modal behavior remain intact. |
| `generate_lead` | Browser Cal success or access-form success | `lead_source` only | Cal dry-run emits `lead_source=cal`; access form emits `access_form`; neither browser event is the authoritative booking. |
| `qualify_lead` | Server GA4 Measurement Protocol | numeric two-part `client_id`, internal `lead_id` | Transition one stored booking to qualified; database succeeds even if GA4 is absent/fails; debug payload contains no personal data. |
| `disqualify_lead` | Server GA4 Measurement Protocol | numeric two-part `client_id`, internal `lead_id` | Transition one stored booking to dismissed and verify one event. |
| `close_convert_lead` | Server GA4 Measurement Protocol | numeric two-part `client_id`, internal `lead_id` | Transition one stored booking to converted and verify one event. |

- [ ] Create Custom Event triggers for the two browser event names and map only
  the allowed parameters.
- [ ] Confirm `generate_lead`, `qualify_lead` and `close_convert_lead` key-event
  treatment with the reporting owner. Keep `demo_cta_click` diagnostic.
- [ ] Configure server-only `GA4_MEASUREMENT_ID` and `GA4_API_SECRET`; neither
  may use a `NEXT_PUBLIC_` prefix.
- [ ] Use GA4's validation/debug destination before production collection where
  practical. Inspect field names, not real contact values.
- [ ] Verify the server payload contains only event name, numeric `client_id`
  and `lead_id=booking:<internal-id>`—never name, email, phone, Cal UID, notes,
  calendar time, landing URL or raw attribution.
- [ ] Document consent/legal review for analytics storage before activation.

## Cal.com booking measurement

- [ ] Confirm the booking event is exactly `hqnudge/30min`; the configured event
  type slug is `30min`.
- [ ] In the embed, keep arbitrary query forwarding disabled.
- [ ] Confirm only `utm_source`, `utm_medium`, `utm_campaign`,
  `metadata[landingPath]`, origin-only `metadata[referrer]`, and a validated
  numeric `metadata[gaClientId]` are forwarded.
- [ ] Create the webhook at
  `https://nudgeagent.app/api/webhooks/cal` for `BOOKING_CREATED` only.
- [ ] Generate a strong webhook secret, set the same value in Cal.com and the
  server-only `CAL_WEBHOOK_SECRET`, and confirm the supported version header.
- [ ] Confirm the deployed event will not exceed the deliberate ten-attendee
  ingress cap. If it can, review and test the cap before activation.
- [ ] Make one non-sensitive test booking. Confirm one `DemoBooking` row with the
  expected event type and internal attribution fields.
- [ ] Replay the same signed delivery through Cal's supported retry/test path.
  Confirm the row count for that `calUid` remains one and first-touch attribution
  is unchanged. Record only the internal row ID and pass/fail—not the raw payload
  or attendee details.
- [ ] Confirm Cal browser success produces aggregate `generate_lead`; treat the
  signed webhook/database row as authoritative.

## Weekly incident check

Run weekly during the sprint and after material releases:

- [ ] Tracking: compare browser demo clicks, browser leads, authoritative Cal
  bookings and lead transitions. Investigate a stage falling to zero when the
  adjacent system shows activity.
- [ ] Errors: review deployment/function logs and monitoring for new 5xx rates,
  webhook 401/400/413 spikes, timeouts and failed GA4 sends. Use request IDs and
  aggregate counts; do not print payloads.
- [ ] Indexing: review sitemap status, Pages changes, URL Inspection samples,
  robots/canonical changes and accidental `noindex` on public pages.
- [ ] Experience: check broken first-party links, unexpected redirect chains,
  mobile/desktop rendering and Core Web Vitals when field data exists.
- [ ] Anomalies: compare the latest complete week with a comparable prior period
  by page/query/device. Report absolute numbers when data is sparse; annotate
  releases, outages and campaign effects instead of inventing causation.
- [ ] Claims: spot-check changed public copy against product, price and policy
  evidence.

For an incident, record start time, affected stage/URLs, evidence, owner,
containment and recovery verification. Escalate security-sensitive or external
changes before acting.

## Monthly report

Use one row per calendar month, with links to the underlying exports and sales
reconciliation. Separate brand from non-brand and organic from other sources.

| Month | Non-brand impressions | Non-brand clicks | Organic bookings | Attended/worked | Qualified | Customers | Page/query opportunities | Actions and owner |
|---|---:|---:|---:|---:|---:|---:|---|---|
| YYYY-MM | — | — | — | — | — | — | — | — |

Also record deployment/content annotations, crawl/index coverage, available
Core Web Vitals, relevant referring domains and any attribution limitations.
The north star is qualified organic demo bookings; rankings and impressions are
diagnostics.

## Four-month review cadence

### End of month 2 checkpoint

- Technical crawl and index coverage: canonicals, sitemap, robots, broken links,
  redirect chains and public/private route behavior.
- Core Web Vitals/field-data review where evidence exists; otherwise keep the
  field unknown and label any lab measurement separately.
- Content quality and intent ownership for the clinic hub, three specialty pages,
  capability pages and supporting resources actually published by then.
- Booking conversion and lead-quality reconciliation from click through
  qualified demo.
- Decide the month-3/4 queue from first-party evidence.

### End of month 4 checkpoint

- Reconcile qualified demos, customers, revenue and time-to-close.
- Retain/improve/consolidate/redirect weak pages using the decision tree below.
- Review authority earned, prohibited tactics avoided and outreach learnings.
- Reset strategy and allocate the next quarter only if the program is renewed.

### Post-sprint quarterly review (renewal cadence only)

If renewed, repeat a quarterly technical, content and authority review: crawl and
index controls; Core Web Vitals; intent ownership/cannibalization; content decay;
claims and pricing; link quality and unlinked mentions; outreach results; and
qualified-demo/customer economics. This is the ongoing cadence after the
four-month sprint, not a 34-month plan.

## 30/60/90-day page decision tree

At days 30, 60 and 90 after publication or substantive revision:

1. Confirm the page is fetchable, canonicalized, internally linked and eligible
   for indexing. If not, fix the technical cause before judging demand.
2. Review impressions, clicks, queries, landing engagement and qualified-demo
   evidence. Treat sparse data as sparse.
3. Choose exactly one action:
   - **Retain:** intent is distinct, quality is current and performance/leading
     signals justify leaving the page stable.
   - **Improve:** intent fits but coverage, proof, internal links, snippet or
     conversion path is weak. Make a substantive change and reset the review date.
   - **Merge + redirect:** another URL better owns the same intent. Move useful
     material, set a permanent one-hop redirect and update links/sitemap.
   - **Retire + redirect:** the page has no defensible intent/value or is no
     longer supportable. Redirect to the closest relevant destination.
4. Never delete a linked or previously published URL without a documented
   redirect mapping. Verify the destination, status, canonical and sitemap after
   release.

## Claim review and content publication

- [ ] Assign one canonical URL to one primary intent; check for cannibalization.
- [ ] Define reader, decision stage, evidence and next action.
- [ ] Gather founder, product or clinic subject-matter input.
- [ ] Include something competitors cannot cheaply reproduce: a product
  screenshot/simulation, operator interview, original calculator/template,
  consented case study or privacy-reviewed aggregate evidence.
- [ ] Verify every product capability is shipped and entitled for the described
  plan. Use the approved pricing source; do not duplicate an unapproved price.
- [ ] Fact-check Meta policy against current primary documentation. Obtain
  qualified medical/legal review before making those claims.
- [ ] Remove unsupported rankings, outcomes, statistics, testimonials,
  certifications, partner status and customer stories.
- [ ] Keep Nudge positioned as an AI Front Desk. CRM/campaign phrases are
  secondary and campaigns are consented support capability, not the headline.
- [ ] Add unique metadata, canonical, useful H1, visible breadcrumbs/internal
  links and only applicable JSON-LD whose facts match the page.
- [ ] Confirm HTML is useful without JavaScript; test 1440×900 and 390×844,
  keyboard focus, mobile menu, reduced motion, overflow and primary CTA.
- [ ] Check every first-party link and safe external-link attributes.
- [ ] Publish only after review; submit/inspect, annotate the reporting timeline,
  and schedule 30/60/90-day reviews. Change dates only after substantive review.

## Market-expansion gate

India remains the sprint market. A Malaysia, Singapore or UAE page may enter the
queue only when all are true:

- sales can price, sell, onboard and support the offer in that market;
- local product/compliance/payment/availability claims are verified;
- first-party or sourced keyword/SERP evidence shows distinct demand;
- the page has genuinely localized language, examples, pricing and proof—not a
  country-name swap;
- it has a distinct canonical intent and conversion path; and
- the four-month India results and month-4 strategy reset support allocation.

If any gate is missing, keep the market page unpublished.

## Secret rotation and webhook failure

### Rotate `CAL_WEBHOOK_SECRET`

1. Open a restricted incident/change record; identify an authorized Cal and
   deployment operator.
2. Generate a new high-entropy secret in an approved secret manager. Never paste
   it into chat, tickets, logs or command output.
3. Because the route accepts one secret, schedule the small coordination window:
   update the deployment secret and Cal webhook secret as closely as possible.
4. Redeploy/restart as required, create one non-sensitive test booking, and
   verify HTTP 200 plus one deduplicated row.
5. Revoke the old secret and record only rotation time, operators and evidence.

### Investigate webhook failures

- 401: confirm secret/version configuration and signature header presence using
  redacted metadata. Rotate if compromise is suspected.
- 400: confirm supported webhook version, event type and declared schema; do not
  log or attach the body.
- 413: confirm the legitimate event stays under 64 KiB and the attendee cap;
  review any limit change in code/tests before deployment.
- 5xx/timeout: inspect request ID, aggregate error, database availability and
  unique-key/upsert health. Retry through Cal only after containment.
- Reconcile Cal delivery IDs/timestamps with internal row IDs and counts, never
  attendee details or payloads. Confirm retries leave one row per `calUid` and
  do not overwrite first touch.
- If trust is uncertain, disable the webhook or unset the secret so the route
  fails closed; browser `generate_lead` remains non-authoritative.

After recovery, repeat signature rejection, valid delivery, replay/deduplication,
GA4 non-blocking and no-personal-data checks. Record the incident without secrets
or payloads.
