# AGENTS.md — Nudge

Read automatically at the start of every session. It is the contract for how you
work in this repo and, above all, **what this product is**. Keep it short and true.

## What Nudge is (do NOT drift from this)

Nudge is **not another WhatsApp CRM.** That market is owned (AiSensy, WATI,
Interakt) and, since June 2026, "AI that replies on WhatsApp" is free platform
plumbing (Meta Business Agent). Competing there on features-at-tool-prices is a
guaranteed loss.

Nudge is an **AI Front Desk** — a done-for-you AI *employee* that runs a small
business's WhatsApp end-to-end. It is priced against the ₹18–25k/month human it
replaces, not against ₹999 software.

**The one-liner (north star for all copy):**
> "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk RUNS it — it books
> into your real calendar, chases every lead that goes quiet, collects payments,
> and we set the whole thing up for you. It's not software. It's your best
> employee, for a third of the salary."

**The three moats** (every build decision must strengthen at least one — they are
what Meta's free agent does NOT cover):
1. **Real actions in the client's real systems** — books into Google Calendar
   with availability checks, sends payment links, writes to their CRM.
2. **Outbound revenue generation** — the agent CHASES: follows up ghosted leads
   via approved templates, booking reminders, no-show recovery, re-engages after
   the 24h window. (Meta's agent is inbound-only.)
3. **Done-for-you service** — we set up the knowledge base, flows, templates and
   integrations (concierge onboarding). SMBs at this price buy an outcome.

**Positioning of the existing feature set:** the CRM / inbox / campaigns /
automations are **KEPT** — as self-serve lower tiers (Free / Starter / Growth /
Pro) for parity + price-anchoring, AND as the outbound-campaign capability
**bundled inside** the flagship (the "chases every lead" moat). The flagship is
**AI Front Desk** (₹14,999/mo India; ~S$599 / RM1,199 / $179; priced in all 10
currencies). Marketing leads with the flagship; campaigns ride inside it, never
as the headline. **Marketing is compliant only to opted-in recipients** — a
client's own first-party list, no paid ads required; cold lists are banned by
invariant #2. See `docs/META_COMPLIANCE_MARKETING.md`.

**Business model:** Meta "Model A" Tech Provider (client's WABA connects to us;
Meta bills the client for conversations; we earn the subscription). Access path:
start **per-client manual** (first ~1–10 clients), then become a **Tech
Provider** (incorporate + Meta Business Verification + App Review + Embedded
Signup) for scale. Founder-led direct sales into the sharpened beachhead —
**high-ticket lead-gen clinics** (hair-transplant / aesthetic-derma /
cosmetic-dental; NOT generic salons/gyms, which are blast-first + low-ticket) —
then a reseller/white-label channel. Markets: India → Malaysia → Singapore → UAE.

Full detail + competitive analysis: **`docs/STRATEGY.md`** (beachhead in §5a);
go-live compliance in **`docs/META_COMPLIANCE_INBOUND.md`** +
**`docs/META_COMPLIANCE_MARKETING.md`**. Do not re-open these decisions; do not
slide back to "WhatsApp CRM" copy or campaign-blast-first framing.

## The 7 protected invariants (NEVER break, in any change)

1. **Official Meta Cloud API only** — no gray-market automation, ever.
2. **Consent enforced in code** — marketing only to `opted_in`; double-gated
   (queue + `sendMessage`); opt-outs permanent; STOP always wins; imports can't
   resurrect an opt-out.
3. **Cheap AI at runtime** — Haiku or Sonnet only (`RUNTIME_MODEL`; Sonnet is the
   production choice since 2026-08-29), through the single `lib/model-router`,
   with the expensive-model guard intact. Never hardcode Opus/Fable at runtime.
4. **Simulation mode works end-to-end** — with `SEND_MODE=simulation` (default),
   the ENTIRE product (generate → send → calendar booking → follow-ups →
   dashboard) demos with zero external keys. Every new feature must too.
5. **Tenant isolation** — every query org-scoped, RLS backstop, roles enforced
   server-side (`requireOrgContext` + `requireRole`, not just hidden UI).
6. **24-hour service window** — enforced in code everywhere free-form messages
   can be sent (agent, inbox composer, follow-ups). Business-initiated
   re-engagement uses approved templates, not free-form.
7. **Agent scoped to one business** — grounded only in owner-provided knowledge;
   no general-purpose chatbot behavior (Meta Jan-2026 policy).

Each invariant has a direct test — see `docs/AUDIT_REPORT.md` §6 and the `tests/`.

## How to work here (Karpathy discipline)

- **Don't assume.** If a request conflicts with the repo, STOP, state the
  conflict + tradeoff, and ask. Never silently pick an interpretation.
- **Surface confusion immediately.** Never hide uncertainty behind confident code.
- **Minimum viable change.** No speculative features, no abstractions for
  single-use code. If 200 lines could be 50, rewrite before committing.
- **Surgical edits only.** Touch only what the task requires; no drive-by refactors.
- Before shipping, ask: "would a senior engineer say this is overcomplicated?"
- **Keep every commit green** (tests + build + lint). Work one coherent change at
  a time; update `PROGRESS.md`; commit with a clear message.

## Architecture — where new code goes

Structure mirrors the architecture (see **`docs/ARCHITECTURE.md`**). `@/*` → `src/*`.
1. A **route**? → `src/app/…` (thin; server actions colocate as `actions.ts`).
2. **Business logic for a bounded context**? → `src/modules/<context>/` (reuse an
   existing module first). Platform modules (orgs, messaging, consent,
   model-router, billing, integrations, calendar, followup) are product-2 reusable
   — keep them generic.
3. A **UI primitive**? → `src/components/ui/` (the only primitive layer). A feature
   composition → `src/components/features/`. Marketing → `src/components/marketing/`.
4. **Genuinely cross-cutting** (used by 3+ unrelated modules)? → `src/lib/`.
5. **Tests** mirror the module under test in `tests/`.

## Stack (decided — do not re-litigate)

Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres + Auth +
Storage) · Prisma · Postgres-backed queue + Vercel Cron · Vercel + Supabase ·
runtime LLM = Anthropic Haiku via `lib/model-router`. Node 20+ (nvm). Secrets in
`.env.local`; maintain `.env.example`.

## Before you build

Read `docs/STRATEGY.md`, `docs/ARCHITECTURE.md`, and `docs/PRD.md`. Write/keep
unit tests for the parts that cause real breakage: the WhatsApp template-payload
builder, the send-payload builder, the consent gate, the flagship gate, and the
24h-window rule. Prefer deterministic code over runtime AI wherever possible.
