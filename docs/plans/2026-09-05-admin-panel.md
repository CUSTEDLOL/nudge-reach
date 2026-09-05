# Founder Admin Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. Branch: `admin-panel`,
> built in an isolated git worktree (the main working tree carries e4b WIP). Merge after
> e4b lands. Gates per commit: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

**Goal:** One private place where the founders see the whole platform — every org, plan,
usage, cost, funnel and system health — with the few mutations they actually need
(set plan), audited.

**Architecture:** `/admin` is a new route group OUTSIDE the org-scoped app shell, backed by
`src/modules/admin/` — the ONLY module allowed to run cross-org queries (everything else
in the repo stays tenant-scoped; invariant 5 is about tenants, this is the platform
operator's console). Access = `FOUNDER_EMAILS` env allowlist checked server-side on every
request (decision D4); anyone else gets a 404, and no nav anywhere links to it.
**Zero schema changes** — every page reads tables that already exist (Org, AiUsage,
ContactEvent, WebhookDelivery, Template, ConversationMessage, BookingRequest,
PaymentRequest, AuditLog). Read-mostly; the one mutation writes an AuditLog row.
**Privacy rule: no customer message bodies are ever rendered in the panel** — counts and
metadata only.

---

## Access control (the foundation everything sits on)

- `src/lib/env-schema.ts`: add optional `FOUNDER_EMAILS` (comma-separated). Unset ⇒ the
  panel is OFF everywhere (fails closed).
- `src/modules/admin/auth.ts`: `requireFounder()` — reads the Supabase session claims
  (same `getClaims()` pattern as `requireOrgContext`), lowercases the email, checks
  membership in the parsed allowlist, calls `notFound()` otherwise. Returns
  `{ email }` for audit attribution. Every `/admin` page calls it via the shared
  `src/app/admin/layout.tsx` AND per-page (layouts don't re-run on soft nav — belt and
  braces, both cheap).
- Founder task at rollout: set `FOUNDER_EMAILS` in Vercel + `.env.local`
  (e.g. `visheshjain1705@gmail.com,<dhairya's login email>`).

## Pages (5, correctness before beauty — plain tables, existing UI primitives)

### 1. `/admin` — Overview
Aggregates via `Promise.all`, one shared `?days=7|30|90` range param (reuse
`parseRange` from `analytics/compute`):
orgs by plan (`org.groupBy(plan)`), live vs test (`groupBy(simulated)`), signups/day
(`Org.createdAt` series — reuse `fillDailyCounts`), platform AI cost/day + total
(`AiUsage` sum, BYOK split out), message volume (`ConversationMessage` count by day),
active orgs (distinct orgs with an inbound in range), bookings + payments-paid counts.
Renders stat cards + two `AreaVolumeChart`s (existing components).

### 2. `/admin/orgs` — every workspace
Table, newest first, cursor pagination (take 50), text search on org name / owner email
(from Membership). Columns: name, plan, live/test, WhatsApp numbers count, contacts,
messages 30d, AI cost 30d (+ % of plan price via existing `aiCostAlert` math — flag
over-threshold rows amber), created, last inbound. One query with `_count` selects +
one grouped AiUsage query — no N+1.

### 3. `/admin/orgs/[id]` — one workspace, deep
Org fields + settings; members + roles; connected numbers; agent profile (vertical,
enabled, knowledge count, pending owner questions); templates with Meta statuses;
follow-up config; AI usage series + totals; recent `ContactEvent`s; booking/payment
counts; recent AuditLog entries. **No message content.** Actions live here:
- **Set plan** — select over `PlanId` (validated server-side, same rules as
  `scripts/set-plan.ts`; extract that script's core into
  `src/modules/admin/set-plan.ts` so script + panel share one implementation), writes
  `AuditLog { orgId, actorUserId: "founder", actorName: "founder:<email>",
  action: "admin.plan_changed", detail: "<old> → <new>" }` directly (recordAudit needs
  an org membership context founders don't have — a direct, clearly-labeled row is the
  honest shape).

### 4. `/admin/events` — funnel & demand
`ContactEvent` counts by type by day (stacked view), signups split by `Org.vertical`
(the which-vertical-demand view the ads decision needs), opt-out rate trend, recent
events table (type, org, contact id, props — again no message text). This page grows
into the WS6 funnel report when the self-serve track resumes; keep its queries in
`src/modules/admin/events.ts` so that reuse is clean.

### 5. `/admin/ops` — is the platform healthy
Webhook delivery failures last 7d (WebhookDelivery ok=false, grouped by endpoint/org);
templates stuck PENDING > 24h or REJECTED (cross-org); most recent cron activity
(latest follow-up send / automation run / trial-expiry timestamps — "last tick" proxy);
orgs over the AI-cost alert threshold; pending WhatsappConnect-style requests if e4b
adds them. Each block links to the org detail page.

## Module layout

```
src/app/admin/layout.tsx        — requireFounder + minimal shell (5 tabs)
src/app/admin/page.tsx          — overview
src/app/admin/orgs/page.tsx     — list (+ search/cursor via searchParams)
src/app/admin/orgs/[id]/page.tsx + actions.ts
src/app/admin/events/page.tsx
src/app/admin/ops/page.tsx
src/modules/admin/auth.ts       — requireFounder
src/modules/admin/queries.ts    — overview + orgs queries (cross-org, header comment
                                  declaring this the only cross-org module)
src/modules/admin/events.ts     — event/funnel queries
src/modules/admin/ops.ts        — health queries
src/modules/admin/set-plan.ts   — shared with scripts/set-plan.ts
```

## Tests (written first, per task)

- `tests/admin-gate.test.ts`: unset env ⇒ denied; listed email (any case) ⇒ allowed;
  unlisted ⇒ denied; empty-string entries ignored.
- `tests/admin-queries.test.ts`: mocked prisma — overview aggregate shape; orgs-list
  pagination cursor; org-detail never selects message `body` (assert on the prisma
  select args — this encodes the privacy rule as a test).
- `tests/admin-set-plan.test.ts`: invalid plan rejected; valid change writes the plan
  AND the AuditLog row; script + panel share the same function.

## Commits (each green)

1. `feat(admin): founder gate + shell` — env, auth.ts, layout, empty overview, gate tests
2. `feat(admin): overview aggregates`
3. `feat(admin): orgs table with search + pagination`
4. `feat(admin): org detail (no message content)`
5. `feat(admin): set-plan action shared with the CLI script + audit`
6. `feat(admin): events & funnel page`
7. `feat(admin): ops health page + PROGRESS entry`

## Verification

- Gates per commit; manual walk: non-founder login → /admin is a 404; founder login →
  all 5 pages render against the real dev DB; set-plan on the demo org flips the
  Integrations gating live and leaves an audit row; `tests/admin-queries` privacy
  assertion green.
- Founder-manual list: set `FOUNDER_EMAILS` (Vercel + local), decide Dhairya's email.

## Deliberately NOT in v1

Impersonation/login-as-org (big security surface — own workstream if ever), editing org
data beyond plan, message-content viewing (privacy), charts polish, mobile layout,
revenue/MRR from payment providers (needs webhook reconciliation work — Ops page shows
subscriptionStatus counts only).
