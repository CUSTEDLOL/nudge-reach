# WhatsApp AI Content Engine Design

**Date:** 2026-09-17
**Status:** Approved

## Objective

Build a broad, useful search and Reddit content engine around WhatsApp AI
automation, lead response and follow-up. The program should attract business
owners and technically curious readers without repositioning Nudge as a generic
auto-reply bot.

The content promise is:

> Automatic replies are the first step. A useful WhatsApp AI system captures
> context, qualifies the lead, takes the next business action, follows up when
> appropriate and hands the conversation to a person when needed.

Nudge remains an AI Front Desk. “WhatsApp AI automation” is the discovery topic;
connected actions, outbound follow-up and done-for-you setup are the product
distinction.

## Audience and evidence boundary

The first audience is owners and operators of small appointment- and
enquiry-driven businesses, plus builders evaluating the official WhatsApp Cloud
API. Content may use restaurants and other small businesses as concrete examples,
but it must not create lightly rewritten industry pages.

There is currently no customer case study or publishable customer result. Until
there is one:

- do not invent customers, testimonials, benchmarks or conversion lifts;
- label worked examples as examples;
- make calculators use visitor-provided inputs and visible formulas;
- cite primary sources for Meta policy and platform facts;
- distinguish shipped Nudge behavior from a general architecture tutorial.

## Search architecture

### Pillar

`/whatsapp-ai-automation` owns the broad commercial-educational topic. It
explains the full system from inbound message through qualification, action,
follow-up and handoff. It links to the guides and tool below and provides a clear
path to a Nudge demo.

### First release

1. `/whatsapp-ai-automation`
   - Intent: understand and evaluate WhatsApp AI automation.
   - Unique value: a complete action-oriented system map, not an auto-reply list.
2. `/resources/how-to-build-whatsapp-ai-automation`
   - Intent: understand the technical architecture and build-versus-buy tradeoff.
   - Unique value: official Cloud API flow, webhook, business knowledge,
     model-router, action tools, 24-hour-window enforcement and human handoff.
3. `/resources/how-to-stop-losing-leads-on-whatsapp`
   - Intent: improve response and follow-up operations.
   - Unique value: a deterministic lead-state workflow and an audit checklist;
     no invented performance statistics.
4. `/tools/whatsapp-lead-leakage-calculator`
   - Intent: estimate the commercial effect of unanswered and unfollowed leads.
   - Unique value: local, no-storage calculation with every formula and
     assumption visible.

### Later queue

- AI replies for WhatsApp Business
- WhatsApp lead follow-up automation
- WhatsApp AI lead qualification
- WhatsApp AI lead generation: what it can and cannot do
- WhatsApp Business App vs Cloud API vs AI automation
- Official API vs unofficial WhatsApp automation
- WhatsApp AI automation for restaurants
- WhatsApp AI automation examples for small businesses
- WhatsApp automation readiness checker
- WhatsApp 24-hour window and template checker

Later pages are published only when they have distinct intent and useful content;
Search Console evidence may change their order. Restaurant material starts as a
substantial guide or example section, not a cloned landing-page template.

## First-release page design

The pillar is a statically rendered marketing route using the existing
`LandingShell`, breadcrumb JSON-LD, canonical metadata and CTA tracking. The two
guides use the typed resource manifest and loader system so their dates,
metadata, sitemap entries, bylines and publication state stay aligned. The
resource index changes from clinic-only language to a filter-free list that can
describe each resource's audience accurately.

The calculator is a public statically rendered route. A small client component
handles numeric inputs and calculations in the browser. It sends no input to the
server, uses no cookies and stores nothing. The formula module remains pure and
separately tested.

Suggested calculator inputs:

- inbound WhatsApp leads per month;
- percentage receiving no timely reply;
- percentage of replied leads that receive no follow-up;
- lead-to-customer conversion rate;
- average first-sale value.

Outputs:

- leads at risk from missed replies;
- leads at risk from missing follow-up;
- estimated customers and revenue at risk per month and year;
- the exact formulas and a warning that the result is a planning estimate, not
  a promised recovery outcome.

Input validation clamps percentages to 0–100 and prevents negative or non-finite
values. Empty inputs produce an incomplete state rather than misleading zero
results.

## Internal linking and indexing

- Homepage and Resources link to the pillar.
- The pillar links to both guides and the calculator using descriptive anchors.
- Each guide links back to the pillar, to the other relevant resource/tool and
  to an appropriate product/demo action.
- The calculator links to the lead-loss guide and pillar.
- Every published page has one unique H1, title, description, self-canonical,
  visible breadcrumb and sitemap entry.
- Article JSON-LD is limited to the two real guides. The interactive calculator
  receives breadcrumb markup only; no unsupported rich-result type is added.
- Modification dates change only after substantive review.

## Editorial rules

- Write for a real operator problem first; include target phrases naturally.
- No keyword stuffing, arbitrary word counts or mass-produced variants.
- Explain that WhatsApp automation captures and converts demand; it does not
  create customers from nowhere.
- Marketing follow-up applies only to opted-in recipients. STOP and opt-outs
  always win, and re-engagement outside the service window uses approved
  templates.
- Recommend only the official Meta Cloud API. Never teach browser scraping or
  gray-market automation.
- State where a human must take over and keep the agent scoped to the business.
- Include diagrams, checklists, formulas or concrete workflows competitors
  cannot reproduce by merely rewriting definitions.

## Reddit distribution

Reddit is a manual founder-led distribution and research channel, not a link
scheme.

- Use one transparent founder account that identifies the relationship to
  Nudge when relevant.
- Read each community's current rules before posting.
- Start with helpful comments and native posts; do not paste the same post into
  multiple communities.
- Link only when the linked page directly answers the question and the community
  permits it.
- Use designated promotion threads for direct product promotion.
- Never automate posting, mass-message users, manipulate votes, use alternate
  accounts or conceal commercial affiliation.

Each first-release page produces one native Reddit angle:

1. “What actually has to exist behind a WhatsApp AI reply?”
2. “The architecture mistakes I found while building on the official Cloud API.”
3. “A five-state workflow for stopping WhatsApp leads from disappearing.”
4. “I built a transparent calculator for the leads a business already receives.”

Posts give the useful explanation directly on Reddit. A link is optional, not
the substance of the post.

## Four-month cadence

### Month 1

- Publish the pillar, two first guides and lead-leakage calculator.
- Submit the new sitemap URLs and inspect the pillar and tool in Search Console.
- Begin founder comments and one native Reddit post per week.

### Month 2

- Publish auto-reply, follow-up and lead-qualification guides.
- Build the automation-readiness checker if the first calculator earns useful
  engagement or search impressions.
- Improve internal links based on the first query data.

### Month 3

- Publish the platform comparison and restaurant use-case guide.
- Build the 24-hour-window checker with current primary-source verification.
- Refresh pages whose Search Console queries reveal a clear coverage gap.

### Month 4

- Consolidate overlapping pages instead of allowing keyword cannibalization.
- Improve titles, introductions and CTAs from page/query and qualified-lead data.
- Publish a real case study only if a customer later grants permission and the
  measurement method is defensible.
- Review Reddit referral traffic, conversations and demo quality; continue only
  the formats that generated useful engagement.

## Verification

- Unit tests cover calculator formulas, invalid inputs and deterministic output.
- Resource tests keep manifest and loader keys synchronized and prove drafts do
  not enter routes or the sitemap.
- SEO registry tests cover unique paths, metadata, fixed dates and sitemap
  membership.
- Render tests verify one H1, visible breadcrumbs, correct article JSON-LD and
  contextual internal links.
- Anonymous production checks verify HTTP status, canonical, sitemap membership
  and no redirect chains.
- Full tests, TypeScript, lint and production build remain green before release.
