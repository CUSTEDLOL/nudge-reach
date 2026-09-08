# Founder Control Room — Design

**Date:** 2026-09-08  
**Status:** Approved  
**Audience:** Nudge founders only

## Purpose

Turn the existing `/admin` surface into a reliable founder operations console
for the first 10–25 AI Front Desk clients. The console should make the next
important action obvious, make privileged changes safe, and explain failures
without exposing customer message bodies, credentials, or arbitrary database
access.

This is a hardening and completion pass, not a rebuild. The current founder gate,
sidebar shell, organization directory, organization tabs, leads, revenue,
events, operations health, and audit log remain the foundation.

## Product boundaries

The panel remains founder-only and fail-closed through `FOUNDER_EMAILS`.
Authorization is checked server-side in the admin layout, every page, and every
mutation. It is the only cross-organization product surface.

The panel will not include:

- founder impersonation or "log in as client";
- customer message bodies or conversation transcripts;
- decrypted tokens, API keys, credentials, or webhook secrets;
- arbitrary database editing or unrestricted job execution;
- organization deletion;
- internal staff roles or an admin RBAC system.

These exclusions keep tenant isolation, privacy, and the product's seven
protected invariants intact.

## Operating model

The primary workflow is:

> Notice → diagnose → act safely → confirm the result → retain an audit trail

The overview prioritizes work instead of presenting metrics without context.
Every attention item links to a filtered diagnostic page or the affected
organization. Privileged changes are made only inside the relevant organization
or failure record, where the founder can see the target and consequences.

## Information architecture

### Platform navigation

1. **Overview** — prioritized work queue followed by platform pulse.
2. **Organizations** — searchable and filterable client directory.
3. **Leads** — landing-page access requests and waitlist follow-up.
4. **Revenue** — subscriptions, trials, arrears, churn risk, and margins.
5. **Demand & events** — signup and product-usage signals.
6. **Operations** — system health, failures, stale work, and safe recovery.
7. **Audit log** — founder, client, and system changes across organizations.

### Organization navigation

Every organization page retains a persistent identity strip containing its
name, owner, plan, billing state, live/test mode, suspension state, and ID.

1. **Overview** — commercial state, authoritative readiness, incidents, usage,
   recent metadata-only activity, and founder notes.
2. **Setup & Front Desk** — knowledge, agent, templates, follow-ups, and
   concierge setup.
3. **Integrations** — WhatsApp, calendar, voice, CRM, API, webhooks, and custom
   actions.
4. **Team** — members, roles, number access, ownership, and invitations.
5. **Usage & cost** — value delivered, consumption, consent, and margin signals.
6. **Activity** — organization audit history and operational events.
7. **Controls** — plan, trial, subscription, limits, live/test mode, and danger
   zone.

## Page behavior

### Overview

The first section is a severity-ranked queue with Critical, Needs attention,
and Follow-up states. It includes system failures, stale processing, past-due
clients, expiring trials, readiness blockers, quiet live clients, new leads,
and abnormal platform-paid AI cost. Zero-count states stay quiet rather than
competing for attention.

The platform pulse remains below the queue: organizations, active
subscriptions, signups, active organizations, messages, bookings, payments,
and AI cost. Trends must have exact-value text or table alternatives.

### Organizations

Search supports organization name, owner/member email, organization ID, and
connected phone-number ID. Filters cover plan, live/test mode, billing state,
suspension, and readiness. Sorting supports newest, name, last activity, trial
expiry, and AI cost.

Rows show the owner, plan, mode, billing state, readiness, last activity, and
important warnings. Mobile uses a prioritized stacked row/card presentation;
desktop uses a sortable table. High-impact actions are not placed inline.

### Leads

Leads can be searched, filtered by source and status, paginated, contacted by
email or WhatsApp, moved through the pipeline, and annotated. Repeated email or
phone details are visibly grouped or flagged so duplicate submissions are not
mistaken for unrelated prospects.

### Revenue

Book-value MRR is explicitly separated by currency and never represented as
cash collected. The page surfaces trials ending soon, expired trials, past-due
and cancelled clients, live clients with no recent inbound activity, and
platform-paid AI cost that threatens margin. Each item links to the correct
organization context.

### Demand & events

The page supports date, event-type, organization, and vertical filters. It
provides an accessible trend summary and a detailed event table without message
content.

### Operations

The page begins with an overall Healthy, Degraded, or Critical state and clear
freshness timestamps. It monitors:

- queue backlog and dead work;
- failed outbound messages;
- failed webhook deliveries;
- rejected or stale-pending templates;
- dead CRM synchronization jobs;
- stale automation and cron heartbeats;
- abnormal platform-paid AI cost.

Recovery actions are shown only when the underlying operation is known to be
idempotent. Initial actions are scoped to one record: retry one safe failure,
refresh one template status, disable one failing endpoint, or open the affected
organization. There is no generic "run everything" control.

### Audit log

Filters cover organization, actor, action, result, and date. Details expand
instead of relying on inaccessible hover text or truncation. External or
multi-step operations distinguish requested, completed, and failed outcomes.
A CSV export supports incident review while continuing to exclude message
content and secrets.

## Organization behavior

### Authoritative readiness

There is one reusable readiness computation for admin and client surfaces. An
organization is Ready only when all required conditions are true:

- a usable WhatsApp account is connected;
- knowledge is configured;
- the AI Front Desk is enabled;
- the calendar is connected;
- at least one required template is approved;
- follow-ups are enabled.

Otherwise the status is Blocked or Degraded, with each failed check explaining
the issue and linking to its resolution. This removes the current false-positive
state where an organization can show Ready with zero WhatsApp accounts.

### Setup & Front Desk

The founder can inspect knowledge coverage, unanswered owner questions, agent
configuration, template status, follow-up configuration, and custom actions.
Concierge setup can be run or rerun after a confirmation that states what will
be updated. Agent and follow-ups can be enabled or paused independently, but
server-side plan and configuration gates remain authoritative.

### Integrations

The panel exposes status and metadata only. It can set the default WhatsApp
number, enable/disable supported integrations, revoke an API key, or disconnect
an integration after confirmation. Credential entry and reconnection stay in
the client's authenticated settings flow. Retry actions for failed sync work
live under Operations and are exposed only when idempotency is established.

### Team

The founder can send, resend, or revoke invitations; change roles; remove a
member; and transfer ownership. Server rules always prevent an ownerless
organization and scope membership/invitation targets to the selected
organization.

### Usage & cost

The page combines cost and value: AI calls/spend, voice allowance, messages,
bookings, paid payment requests, conversations, contacts, and consent totals.
It flags unusual spend, approaching limits, and prolonged inactivity. Charts
have exact-value alternatives.

### Activity

Organization audit rows and operational metadata share a consistent timeline.
Founder, client, failed, and system entries are distinguishable without relying
on color alone.

### Controls and danger zone

Routine controls include plan, trial, subscription state, voice allowance, and
feature overrides. Live/test mode and suspension are visually separated into a
danger zone. Organization deletion is deliberately absent.

## Action safety model

Actions use three protection levels:

1. **Routine:** notes and lead status submit directly with pending and result
   feedback.
2. **Account-changing:** plans, trials, subscription, roles, limits, and agent
   switches require confirmation and a recorded reason.
3. **Critical:** going live, suspension, ownership transfer, integration
   disconnection, and key revocation require a reason plus typed confirmation
   of the organization or target.

Every server mutation must:

- rerun `requireFounder`;
- validate inputs without trusting the UI;
- prove the target belongs to the organization;
- reject no-op and stale changes clearly;
- prevent duplicate execution;
- keep database changes and audit rows in one transaction where possible;
- use explicit requested/completed/failed audit events for external or
  multi-step work that cannot be atomic;
- record actor, target, previous state, new state, reason, timestamp, and
  outcome without secrets or message content;
- return a stable, user-safe result and preserve the form on failure;
- revalidate every affected view after success.

The admin panel does not introduce a new send path. Consent, opt-out,
suspension, plan, simulation, and 24-hour-window enforcement remain in their
existing lowest-level modules.

## Error and loading behavior

Admin-level and organization-level error boundaries replace framework error
screens with a concise explanation, retry action, and safe navigation path.
Slow page transitions use stable skeletons. Forms show pending state, disable
duplicate submission, catch rejected actions, retain entered values, display an
inline recovery message, and announce results accessibly. Unknown organizations
remain 404s.

Operational freshness uses explicit thresholds and text labels instead of an
uninterpreted "N days ago" value. Empty states explain whether nothing is wrong,
no data exists yet, or filters excluded all data.

## Visual system

The existing Nudge identity remains: official logo, brand green for navigation
and positive state, neutral surfaces for dense operational content, amber for
attention, and red for danger. The interface will not adopt a generic blue
admin-template palette.

Desktop stays information-dense; small screens prioritize core fields and use
stacked rows instead of forcing wide tables. Controls have visible focus,
meaningful labels, at least 44-pixel touch targets, and non-color status cues.
Motion is limited to 150–300 ms state transitions and respects reduced-motion
preferences.

## Verification strategy

Automated coverage will include:

- founder allowlist acceptance and fail-closed rejection;
- server-action authorization rather than UI-only hiding;
- cross-organization target rejection;
- transaction rollback when audit creation fails;
- action idempotency/no-op behavior and safe exception results;
- readiness combinations, including missing WhatsApp;
- suspension enforcement at login/app access and every outbound send layer;
- operation severity and stale-heartbeat classification;
- safe-retry eligibility;
- ActionForm pending, success, thrown-error, and confirmation behavior;
- privacy queries that never select message bodies or credentials;
- responsive and keyboard-accessible browser flows.

Before integration, run focused admin tests, the full test suite, ESLint, the
production build, and an authenticated browser walkthrough against a simulated
organization. No live message, billing, integration, or customer-data mutation
is part of the test walkthrough.

