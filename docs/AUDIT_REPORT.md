# Nudge — Phase 1 Audit Report

**Date:** 2026-07-05 · **Branch:** `phase-1-audit` · **Scope:** read-only, no edits.
**Baseline verified:** 293 tests passing (29 files), 48 routes, 28 Prisma models,
~37k lines TS across 294 files.

This is a defensive quality review of our own first-party app before launch. It
maps the codebase, lists redundancy and inconsistency, ranks hardening findings,
catalogues strategy drift vs. the AI-Front-Desk direction, and proposes the
Phase 2–8 plan. **No code was changed.**

---

## 0. Two conflicts to resolve before Phase 2 (per operating rule 0.1)

1. **Phase 2 target structure (`src/modules/…`) is a large, high-churn move.**
   The repo is root-level Next.js App Router (`app/`, `lib/`, `components/` at
   root; no `src/`). Moving to `src/app` + `src/modules/*` touches essentially
   every import in the codebase (~294 files). It is achievable green-at-every-
   commit, but it is the single largest and riskiest phase, delivers no customer
   value, and competes for time with Phase 5 (the actual moat). **Recommendation:
   a lighter reorg** — consolidate `lib/` domain folders and the `lib/webhook`
   vs `lib/webhooks` split, colocate feature components, without the full `src/`
   migration — captures ~80% of the discoverability win for ~20% of the risk.
   Flagged for your decision at the Phase 2 gate.

2. **MYR / Malaysia is absent.** Strategy names Malaysia as market #2 with RM
   pricing, but the 9-currency system (INR/USD/AED/SAR/SGD/IDR/BRL/MXN/GBP) has
   **no MYR**. This is a Phase 5.4 pricing gap, noted below.

---

## 1. Architecture map

### Actual structure
```
app/
  (app)/                     # authenticated route group (dark shell)
    dashboard, inbox/[id], contacts/[id], campaigns/[id], templates/[id],
    automations/[id]/runs, analytics, integrations, onboarding,
    settings/{general,team,agent,whatsapp,notifications,billing,data,audit},
    conversations/*          # redirect stubs → /inbox (correct)
  api/
    webhooks/{whatsapp,razorpay,stripe}, cron/process-queue,
    inbox/{list,[id]/messages}, campaigns/[id]/stats, templates/[id]/status,
    waitlist
  auth/{callback,confirm,signout}, login, waitlist, privacy, terms, page.tsx
lib/
  agent/{inbound,reply,prompt,window, tools/{capture-lead,capture-booking,
         handoff,index,types}}
  messaging/{index, drivers/{whatsapp-simulation,whatsapp-live}, types}
  send/{queue,sim-progress}          campaign/{generate,guardrails,schema}
  whatsapp/{template,approval,accounts,library}
  billing/{index,plans,money,razorpay,stripe,limits}
  automation/{engine,triggers,definitions,draft}
  analytics/, dashboard/, inbox/, demo/{seed,reset}, ai/{suggest-reply,tones}
  model-router/{index,guard}
  webhook/verify.ts   webhooks/dispatch.ts    # ⚠ singular vs plural split
  auth, org, consent, crypto, csv, phone, rate-limit, audit, api-keys,
  segments, env, env-schema, db, cn, supabase/*
components/
  ui/       (25 files — the primitive kit)
  app/      (sidebar, topbar, bottom-nav, shell, nav.ts)
  marketing/(24 files)   charts/(4)   whatsapp-preview.tsx
prisma/schema.prisma (28 models)   tests/ (29 files)   docs/ (10)   gtm/ (8)
```

### Assessment
The layering is **already sound**: `lib/` is domain-organized, `components/ui`
is a clean primitive layer, drivers use a simulation/live split, auth flows
through `requireOrg*`. The structure the code *implies* it wants is close to what
exists. The main gaps are the `webhook`/`webhooks` naming split and a handful of
loose `lib/*.ts` files that could join folders — not a structural crisis.

---

## 2. Redundancy list

| Item | Location | Evidence | Recommendation |
|---|---|---|---|
| `lib/webhook/` vs `lib/webhooks/` | `lib/webhook/verify.ts` (inbound Meta sig + STOP), `lib/webhooks/dispatch.ts` (outbound signed events) | Two near-identical folder names, different purposes | Rename to `lib/whatsapp/webhook-verify` (inbound) + `lib/integrations/outbound-webhooks` (or keep but document); the split is a footgun |
| Stale plan-value comment | `prisma/schema.prisma` (Org.plan) | Comment says `free \| starter \| growth \| scale`; code uses `pro` (`getPlan` maps legacy `scale`→`pro`) | Update comment to `…growth \| pro` |
| Two currency/format helpers | `lib/billing/money.ts` (`formatMoney`, `formatPlanPrice`) & `lib/dashboard/format.ts` (`formatMajorAmount`, `formatInrRupees`) | Overlapping money-formatting; `formatInrRupees` is legacy INR-only | Consolidate to `money.ts`; retire INR-only helpers (Phase 3) |
| Deep dead-code sweep incomplete | lib/, components/ | Two background audit agents were interrupted; each reported "several confirmed dead functions" but did not finish enumerating | **Run a depcheck + ts-prune pass in Phase 3** before deleting anything; do not delete on partial data |
| `conversations/` routes | `app/(app)/conversations/{page,[id]}` | Verified: proper `redirect()` stubs to `/inbox` | **Keep** (not dead — preserve old URLs) |

**Unused dependencies:** not yet verified with a tool. `npm audit` shows only a
transitive `postcss` issue (via `next`). A `depcheck` run is queued for Phase 3.

---

## 3. Inconsistency list

| Type | Detail | Location |
|---|---|---|
| **Auth pattern mixed** | Three entry points coexist: `requireOrg()` (returns Org), `requireOrgContext()` (returns role), `requireRole(ctx, …)`. Fine by design, but application is uneven — see §4 findings for actions that use `requireOrg` and thus *cannot* role-gate | `lib/auth.ts` + all `actions.ts` |
| **`ownerUserId` vs membership scoping** | `api/campaigns/[id]/stats` scopes `where: { org: { ownerUserId: claims.sub } }` (owner-only); `api/templates/[id]/status` correctly uses `OR: [ownerUserId, memberships.some]` | `app/api/campaigns/[id]/stats/route.ts:31` |
| **Strategy copy drift** | Product self-describes as "WhatsApp CRM" in metadata + hero (see §5) | `app/layout.tsx`, `components/marketing/hero.tsx` |
| **UI kit adherence** | Spot-check clean — marketing has its own button (intentional, different design system); app surfaces use `components/ui`. No obvious bypasses found (full sweep in Phase 3) | — |

---

## 4. Hardening findings (defensive review of our own code)

RLS, client-bundle env leaks, CSV injection, webhook signatures, and secret
storage were checked and are **largely clean**. Two authorization gaps and one
correctness bug stand out.

### HIGH

**H1 — AI agent config editable by any AGENT-role member (missing `requireRole`).**
`app/(app)/settings/agent/actions.ts:12` `saveAgentProfileAction` uses bare
`requireOrg()` and never calls `requireRole`. The AgentProfile controls what the
AI **auto-replies to customers** (business info, tone, enable on/off) and the
Settings nav hides it from agents — but the server action doesn't enforce that.
*Scenario:* an AGENT-role teammate crafts a direct form POST and rewrites the
customer-facing auto-reply persona, or disables the agent.
*Fix:* `const ctx = await requireOrgContext(); requireRole(ctx, "ADMIN");` (one line).
*Regression test:* assert an AGENT context throws.

### MEDIUM

**M1 — Campaign-stats polling is owner-only → broken for teammates (fails closed).**
`app/api/campaigns/[id]/stats/route.ts:31` scopes by `org.ownerUserId === claims.sub`.
A non-owner ADMIN/AGENT viewing a SENDING campaign polls this endpoint and gets
an empty/`not_found` response — the live stats dashboard silently stops updating
for them. Not a data leak (it over-restricts), but a real team-usage bug and
inconsistent with the templates-status route which handles membership correctly.
*Fix:* mirror the templates route's `OR: [{ ownerUserId }, { memberships: { some: { userId } } }]`.
*Regression test:* an ADMIN member gets 200 + stats for their org's campaign.

**M2 — `postcss` moderate CVE via transitive `next` dep.** `npm audit` (prod):
2 moderate (PostCSS XSS in CSS stringify). Fix requires a Next major downgrade
(breaking) — **triage as accepted**: not reachable in our usage (we don't feed
untrusted CSS through PostCSS stringify); revisit when Next ships a patched line.

### LOW / VERIFIED-CLEAN

- **Notifications action** (`settings/notifications/actions.ts`) uses
  `requireOrgContext` without `requireRole` — **acceptable**: it edits the
  caller's *own* `Membership.notificationPrefs` (self-service), scoped to
  `ctx.userId`. No gate needed. (Confirm the write is self-scoped in Phase 4.)
- **RLS coverage — CLEAN.** `scripts/enable-rls.ts` enumerates *all* `public`
  tables via `pg_tables` and enables RLS on each, so all 28 models are covered
  automatically (no per-model list to drift).
- **Client-bundle server-env leak — CLEAN.** The only `"use client"` files
  importing `lib/inbox/queries` do so via `import type` (erased at compile).
- **CSV formula injection — CLEAN.** `lib/csv.ts` `csvField` neutralizes
  `= + - @ \t \r`; both export routes (`contacts`, `messages`) route through it.
- **Webhook signatures — CLEAN.** WhatsApp (X-Hub-Signature-256, timing-safe),
  Razorpay (HMAC), Stripe (HMAC + replay-timestamp) all verify before processing;
  plan-activation reads `orgId` from the *verified* payload metadata set
  server-side at checkout, so it can't be spoofed to upgrade another org.
- **Secrets — CLEAN.** WhatsApp tokens AES-256-GCM at rest; API keys sha256
  show-once; no secrets returned to client or logged.
- **Rate limiting** covers public waitlist (per-IP), AI suggest (per-org),
  outbound test pings (per-org). Inbound webhooks are unthrottled but
  signature-gated. Acceptable.

---

## 5. Strategy-drift list

The product still reads as a "WhatsApp CRM," not an "AI Front Desk." Every item
below contradicts Section 1 positioning. **Landing page (marketing/*) is Phase 6;
everything else is Phase 3/7.**

| Drift | Location | Current text |
|---|---|---|
| App metadata title | `app/layout.tsx:26` | "Nudge — WhatsApp CRM for modern retail & D2C teams" |
| App metadata desc | `app/layout.tsx:30` | "The WhatsApp CRM your whole team runs on…" |
| OG/Twitter titles | `app/layout.tsx:41,50` | "The WhatsApp CRM your whole team runs on" |
| Hero headline | `components/marketing/hero.tsx:67` | "The WhatsApp CRM your…" *(Phase 6)* |
| Footer tagline | `components/marketing/footer.tsx` | "The WhatsApp CRM your whole team runs on…" *(Phase 6)* |
| README/PROGRESS | root | Lead with CRM/campaign framing, not AI-employee *(Phase 7)* |
| No flagship tier | `lib/billing/plans.ts` | Only Free/Starter/Growth/Pro; no "AI Front Desk" *(Phase 5.4)* |
| MYR absent | `lib/billing/money.ts`, `plans.ts` | Malaysia (market #2) has no local currency *(Phase 5.4)* |

---

## 6. Test coverage — strong on invariants

All 7 protected invariants have **direct unit tests**:

| Invariant | Test |
|---|---|
| Consent gate (`canSendMarketing`) | `tests/consent.test.ts` |
| 24h window (`isWithinServiceWindow`) | `tests/agent.test.ts` |
| STOP (`isStopMessage`) | `tests/webhook-verify.test.ts` |
| Haiku-only guard | `tests/env.test.ts` (+ `model-guard.test.ts`) |
| Agent tools (lead/booking/handoff) | `tests/agent-tools.test.ts` |
| Plan limits | `tests/plan-limits.test.ts` |
| Webhook signatures | `tests/{webhook-verify,razorpay-verify,global-markets}.test.ts` |
| CSV injection | `tests/csv.test.ts` |

**Gaps:** no test asserts tenant isolation at the *action* layer (that a wrong-org
id is refused) — it's enforced by `where: { orgId }` but not regression-guarded.
No test for the agent's tool-calling loop cap (`runAgent` maxSteps). Add both in
Phase 4.

---

## 7. Proposed execution plan (Phases 2–8) with effort estimates

| Phase | Scope | Effort | Risk | Notes |
|---|---|---|---|---|
| **2 — Restructure** | *Decision needed.* Full `src/modules/` (high churn) **or** lighter reorg (webhook split, lib consolidation, feature colocation) | Full: L (1–2 sessions) · Light: S | Full: high · Light: low | Recommend light; green at every commit either way |
| **3 — Purge** | depcheck + ts-prune sweep, delete dead code (logged), unify auth pattern, retire duplicate formatters, fix non-landing copy drift, stale comments | M | low | Do NOT delete on the interrupted agents' partial data — re-run tools |
| **4 — Hardening** | Fix H1 (agent role gate) + M1 (stats membership scoping); add tenant-isolation + tool-loop-cap regression tests; triage M2; update SECURITY.md | S–M | low | Highest value-per-effort; could even precede Phase 3 |
| **5 — Product (THE phase)** | 5.1 Google Calendar OAuth + real booking (sim driver); 5.2 Follow-Up "Revenue Recovery" pack from existing automation primitives; 5.3 concierge onboarding (clinics/salons vertical); 5.4 AI Front Desk tier + **MYR** + gating | L | med | The actual moat; everything else is prep. Needs `googleapis` dep approval (5.1) |
| **6 — Landing** | Awwwards-grade rebuild, AI-employee hero, Meta-vs-Nudge comparison, salary calculator, ₹/$ toggle; perf budgets; reduced-motion regression | L | med | Load design skills first; may need R3F dep approval |
| **7 — Docs/memory** | CLAUDE.md (strategy + invariants + rules), README rewrite, STRATEGY.md, DEMO_SCRIPT update, verify runbooks | S–M | low | Locks direction against future drift |
| **8 — Final sweep** | Full green, mobile QA ×4 breakpoints, security re-check, HANDOVER.md | S | low | TODO list starts with Meta paperwork + selling |

**Suggested reordering for value:** consider **Phase 4 before Phase 3** (fix the
two auth findings immediately; they're one-line changes with real customer-data
impact), and keep Phase 2 **light** to protect time for Phase 5. Both are your
call at the gates.

**New dependencies that will need approval:** `googleapis` (or a lean Google
Calendar REST client) in Phase 5.1; a 3D lib (R3F/Three) in Phase 6 — I'll
present the lightest option that meets the budget when we reach each.

---

**Phase 1 complete. No files changed except this report. Awaiting approval to
proceed to Phase 2 — and your decision on (a) full vs. light restructure, and
(b) whether to run Phase 4 before Phase 3.**
