# E0 — Enterprise Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Head plan: `docs/plans/2026-09-04-enterprise-track.md` §E0. Branch: `e0-enterprise-foundation`. Scope is exactly E0's five items — no drive-bys.

**Goal:** The tier + feature-flag foundation every later enterprise workstream gates on, plus the append-only `ContactEvent` table so history starts accruing now for E6.

**Architecture:** Extend the existing `PlanLimits` boolean precedent (`aiFrontDesk`) with six feature flags and an `enterprise` tier (not self-serve purchasable). Copy the `checkAiFrontDesk` helper shape exactly. `ContactEvent` copies the `recordAudit` fire-and-forget write pattern. No new systems.

**Tech stack:** unchanged (Next.js App Router, Prisma+Supabase RLS, vitest, npm).

---

### Task 1: Plan matrix — `enterprise` tier + six feature flags (TDD)

**Files:**
- Test: `tests/plan-matrix.test.ts` (new)
- Modify: `src/modules/billing/plans.ts`, `src/modules/billing/limits.ts`

**Step 1 — failing test.** `tests/plan-matrix.test.ts` asserts the full F4 matrix:

| flag | free | starter | growth | pro | front_desk | enterprise |
|---|---|---|---|---|---|---|
| publicApi | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| webWidget | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| leadScoring | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| customActions / byoLlm / multiNumber | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

plus: `getPlan("enterprise")` resolves; enterprise numerics all `null` (unlimited) and `aiFrontDesk: true`; `PLAN_PRICES.enterprise` is 0 in all 10 currencies; enterprise is **excluded from the self-serve billing grid** (new `selfServe(plans)` filter or `contactOnly: true` flag — assert the billing page source list omits it); legacy mapping `getPlan("scale") → pro` still holds.

**Step 2 — run, confirm FAIL** (`npx vitest run tests/plan-matrix.test.ts`).

**Step 3 — implement.** `plans.ts`: add `"enterprise"` to `PlanId`; extend `PlanLimits` with the six booleans (JSDoc pointing at the head plan F4); set them on all six plan objects; add the enterprise `Plan` (`name: "Enterprise"`, tagline "For teams that need Nudge to fit their stack", `contactOnly: true` new optional field, prices 0). `limits.ts`: one generic private helper + six public wrappers mirroring `checkAiFrontDesk` exactly: `checkPublicApi(orgId)`, `checkCustomActions`, `checkByoLlm`, `checkMultiNumber`, `checkWebWidget`, `checkLeadScoring` — each returns the same `LimitCheck` shape with a friendly upsell message naming the lowest tier that has it.

**Step 4 — run to green.** **Step 5 — gates + commit** `feat(e0): enterprise tier + feature-flag matrix`.

### Task 2: Gate API-key + webhook actions on `publicApi` (TDD)

**Files:**
- Test: `tests/integrations-gate.test.ts` (new; mock `@/modules/orgs/auth` + `@/lib/db` following the pattern in `tests/campaign-update-auth.test.ts`)
- Modify: `src/app/(app)/integrations/actions.ts` (`createApiKeyAction` :106, `createWebhookEndpointAction` :172 — the two *create* actions; revoke/toggle/delete/test stay ungated so a downgraded org can clean up)
- Modify: `src/app/(app)/integrations/page.tsx` — pass a `gated` flag so the API-keys / webhooks cards render the upsell state instead of the forms when the plan lacks `publicApi`.

**Steps:** failing test (starter org → `{ok:false}` message mentions Growth; growth org → passes role+plan and proceeds) → implement (`const gate = await checkPublicApi(ctx.org.id); if (!gate.allowed) return { ok:false, message: gate.message }` after the role check) → green → commit `feat(e0): plan-gate API keys + webhooks on publicApi`.

### Task 3: `ContactEvent` table + `recordContactEvent` (TDD)

**Files:**
- Modify: `prisma/schema.prisma` — new model + `Org` relation:
  ```prisma
  // Append-only contact/business event history (enterprise track E0).
  // E6 lead-scoring reads it; writes are fire-and-forget and must never
  // break the flow that emits them. Message volumes are NOT events (too
  // hot) — derive those from ConversationMessage/Message directly.
  model ContactEvent {
    id        String   @id @default(cuid())
    orgId     String
    org       Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
    contactId String?
    type      String   // lead_stage_changed | opted_out | booking_status | payment_paid | widget_click | ...
    props     Json     @default("{}")
    createdAt DateTime @default(now())
    @@index([orgId, type, createdAt])
    @@index([orgId, contactId, createdAt])
  }
  ```
- Create: `src/modules/contacts/events.ts` — `recordContactEvent(orgId, type, { contactId?, props? })`: `void prisma.contactEvent.create(...).catch(() => {})` (recordAudit pattern, `src/modules/orgs/audit.ts:66-84`).
- Test: `tests/contact-events.test.ts` — mocked prisma: writes the row; a rejecting prisma never throws to the caller.

**Steps:** schema + `npm run db:push` + `npm run db:rls` (verify AiUsage-style output line for ContactEvent) → failing test → helper → green → commit `feat(e0): append-only ContactEvent history`.

### Task 4: Instrument the emit sites

**Files (all fire-and-forget, one line each + the import):**
- `src/modules/agent/tools/capture-lead.ts:36` — after the QUALIFIED update: `lead_stage_changed` `{from, to: "QUALIFIED", source: "agent"}`.
- `src/app/(app)/contacts/actions.ts:245,512` and `src/app/(app)/inbox/actions.ts:334` — stage writes: `lead_stage_changed` `{to: stage, source: "manual"}` (fetch `from` only where the row is already in hand; don't add reads).
- Opt-outs: `optOutContact` in `contacts/actions.ts` + the STOP path in `src/modules/agent/inbound.ts` (the `optedOutAt: new Date()` writes): `opted_out` `{source: "manual" | "stop"}`.
- Booking status: every `BookingRequest.status` write site (grep `bookingRequest.update` / `status:` — known: `src/modules/followup/reminders.ts` no-show pass; plus any booking UI action found by grep): `booking_status` `{status, bookingRequestId}`.
- `src/modules/payments/index.ts` `markPaymentPaid` success path: `payment_paid` `{paymentRequestId, amountMinor, currency}`.

**Test:** extend `tests/payment-link.test.ts` (payment_paid emitted on settle) + one capture-lead emission assertion in `tests/agent-tools.test.ts`. Commit `feat(e0): emit contact events at stage/opt-out/booking/payment sites`.

### Task 5: `scripts/set-plan.ts` + PLAN.md pause + PROGRESS

**Files:**
- Create: `scripts/set-plan.ts` — esbuild-bundle pattern (mirror `preflight-live`): args `--org <id|owner-email-prefix> --plan <planId>`; validates plan against `PlanId`; prints before → after; refuses unknown plans. npm script `plan:set`.
- Modify: `PLAN.md` header — mark WS3–WS7 **PAUSED** referencing `docs/plans/2026-09-04-enterprise-track.md` (includes the already-pending whitespace edit).
- Modify: `PROGRESS.md` — E0 entry: what shipped + founder-manual list (assign enterprise via `npm run plan:set -- --org … --plan enterprise`; no Vercel changes needed).

Commit `feat(e0): set-plan founder script; pause WS3-WS7 in PLAN.md`.

## Verification

- Every commit: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- After Task 3: `npm run db:rls` output shows `ContactEvent: RLS enabled`.
- Manual sim walk: as demo.owner (free-tier org) → Integrations page shows the gated upsell on API keys; `npm run plan:set -- --org <demo org> --plan growth` → form appears; capture a lead via /inbox/try → `ContactEvent` row with `lead_stage_changed` exists (check via `npx prisma studio` or a one-liner query).
- Paste-back summary at the end: shipped, test evidence, founder-manual steps, open questions.
