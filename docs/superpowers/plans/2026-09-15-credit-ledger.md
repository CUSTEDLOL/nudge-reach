# AI Credit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Database tasks require the `supabase:supabase-postgres-best-practices` skill before editing `prisma/schema.prisma`.

**Goal:** Turn "included AI credits" from a displayed promise into a real, metered balance: every platform-paid LLM call and every Nudge-funded voice minute debits an org-scoped credit ledger; a zero balance pauses platform-paid AI and voice only; included credits reset each cycle; purchased credits expire after 12 months and are spent soonest-expiring first; top-up packs are bought through the existing Razorpay/Stripe flows; founders can grant credits and set Enterprise amounts.

**Architecture:** Two new tables in `src/modules/billing/` (`CreditGrant` = every positive balance with its own expiry; `CreditDebit` = one row per priced call, idempotent on the `AiUsage`/`VoiceCall` row it prices). Balance = `SUM(remainingMicroUsd)` over unexpired grants. Debits allocate FIFO-by-expiry inside a single Postgres transaction using `SELECT … FOR UPDATE` on the org's grant rows. The unit of account is **micro-USD** (integer; `1 credit = 5,000 micro-USD`), already the convention in `AiUsage.costMicroUsd`, so fractions accumulate exactly and nothing is ever rounded up per call. The debit hook lives in `src/lib/model-router/index.ts` (the single doorway, invariant #3): a cheap preflight (balance > 0) before the provider call, an exact post-hoc debit after it. `src/lib/model-router/usage.ts` stays as analytics; the ledger never reads its prices.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 on Supabase Postgres (`prisma db push` + `npm run db:rls`; no migrations directory), Vercel Cron (`/api/cron/process-queue`, every 5 min), Vitest 3 with hoisted `vi.mock("@/lib/db")` style, Razorpay/Stripe REST helpers already in `src/modules/billing/`.

**Spec:** `docs/plans/2026-09-11-tiered-pricing-design.md` §3, §4, §7, §8. `AGENTS.md` invariants #3, #4, #5.

## Global constraints

- Never write the banned word list from `tests/no-crypto-references.test.ts` anywhere (say "credit ledger" / "credit balance").
- Every ledger function takes `orgId` and every query filters by it (invariant #5). New tables get RLS enabled with no policies via `npm run db:rls` after `npm run db:push` (see `scripts/enable-rls.ts`, `PROGRESS.md` "RLS enabled on Org").
- Missing cost information is never free: an unpriced model is refused **before** the provider is called; a failed debit write is logged with a stable tag and re-driven by the reconciler; it is never swallowed like `usage.ts:76-79`.
- The ledger only ever pauses platform-paid AI and Nudge-funded voice. It must not touch `sendMessage`, the send queue, follow-ups, campaigns, CRM sync, scoring or the API.
- BYOK inference (`getByokRuntime` in `src/lib/model-router/byok.ts`) is never preflighted or debited.
- Keep it minimum viable: no reservations, no spending limits, no auto-recharge, no refunds UI.

## Decisions taken in this plan (and the code facts behind them)

1. **Unit of account = micro-USD integers.** `AiUsage.costMicroUsd` (`prisma/schema.prisma:769-793`) already uses it. Credits are a display conversion (`microUsd / 5_000`, one decimal). Row amounts fit `Int` up to ~429,000 credits per row; founder grants are capped at 400,000 credits.
2. **Simulation = shadow ledger, never gated.** "Simulated" for the ledger means *no provider was paid*: `env.SEND_MODE === "simulation"` (global switch, `src/lib/env-schema.ts:24`) **or** the call was the synthetic keyless path (`recordSyntheticUsage` callers in `suggest-reply.ts:139`, `summarize.ts:57`, `distill.ts:64`). Shadow debits are written with `simulated: true`, allocations empty, and touch no grant. They never block. This is stronger than the spec's "never consumes purchased credit" and is what lets the whole product demo with zero keys (invariant #4). `Org.simulated` (test-mode org on a live deployment) is **not** simulation for the ledger: with an `ANTHROPIC_API_KEY` set those calls cost Nudge real money and are metered and gated (this is how the 100-credit trial is enforced). Tradeoff: a dev deployment running `SEND_MODE=simulation` with a real key meters nothing; production runs live.
3. **Included credits reset on the calendar month (UTC).** There is no recurring subscription: checkout is a one-time monthly payment that sets `Org.currentPeriodEnd = now + 1 month` (`settings/billing/actions.ts:170-181`, `webhooks/razorpay/route.ts:48-61`, `webhooks/stripe/route.ts:33-50`). Campaign messages and voice minutes already reset on the calendar month (`limits.ts:262`, `voice/usage.ts:36-38`). The included grant for month `YYYY-MM` is idempotent on `(orgId, "included", "YYYY-MM")` and expires at the first of the next month. Tradeoff: a customer who pays on the 20th gets a full month's credits for ten days, then a fresh grant on the 1st; simple and consistent with the rest of the product. Alternative (tie to `currentPeriodEnd`) is noted as out of scope.
4. **Who gets a monthly included grant:** metered orgs with `subscriptionStatus === "active"` or `plan === "enterprise"`, and no live trial. A founder who comps a plan via `npm run plan:set` must also mark the subscription active in the admin panel (`setSubscriptionStatus`, `org-controls.ts:93-113`) for credits to flow. Expired trials fall to `free` (`trial.ts:25-31`, `includedCredits: 0`) and are therefore paused, which matches spec §3 "AI and paid outbound pause until a plan is bought".
5. **Metering classes** (pure `meteringFor(org)`): `includedCredits === null && !contactOnly` (legacy `front_desk`) → **unmetered** (shadow only, never paused; "never silently reprice" a legacy subscriber). Enterprise → metered, amount = `Org.includedCreditsOverride ?? 0` (0 makes a forgotten override visible: AI pauses and the admin card says so). Everything else → metered with `plan.includedCredits`. Trial orgs → metered against the trial grant only.
6. **Preflight is a zero check, debit is exact and post-hoc.** Cost is unknown until the provider answers. Two racing calls with 1 credit left both pass preflight; the second overdraws by at most one call (`maxTokens` ≤ 1,500 across all call sites → a few credits). Overdraft lands on the org's latest-expiring unexpired grant, which goes negative, so the next preflight blocks. If the overdraft sits on a purchased grant it is honoured against the next top-up; if on an included grant it dies with the month (Nudge absorbs at most one call per org per month).
7. **Voice:** every Nudge-funded minute debits `VOICE_MICRO_USD_PER_MINUTE` (150,000 = 30 credits, the spec's *assumption*), **and** the existing minute cap (`voiceUsage`, 402 in the initiation route) stays. This is the reading of spec §4 "Voice draws on the same credit balance … never advertise both allowances as simultaneously included"; the founder must confirm (see Open questions).
8. **Knowledge ingest and distill are charged.** They are platform-paid LLM calls with attribution (`ingest.ts:153-158,437-446`, `distill.ts:79-90`). Concierge onboarding run by the founder will therefore spend the client's credits; founder can top up with a grant. Flagged as an open question.

## Spec/code conflicts to surface (state the tradeoff, do not guess)

- **Model price.** Spec §4 says Nudge runs "Sonnet 4.6 US$3/$15". Code default is `RUNTIME_MODEL = "claude-sonnet-5"` (`env-schema.ts:21`), whose first-party rate on Anthropic's current sheet is $2 / $10 per MTok (cache read ≈ $0.20, cache write ≈ $2.50). `usage.ts:31` prices any "sonnet" substring at $3/$15 (overcounts Sonnet 5 by 50%). The rate card below uses the Sonnet 5 figures; the founder must confirm against https://platform.claude.com/docs/en/about-claude/pricing before enabling live charges (spec §8 step 4). A short Sonnet 5 reply (2,000 in / 300 out) is then 1.4 credits, not the 2.1 in the spec table.
- **Unknown model.** `usage.ts:40-50` prices unknown models as Sonnet ("overcounting beats undercounting"). Spec §7 says exact-model pricing and never free. The ledger **refuses** unpriced models before the call; `usage.ts` keeps its analytics behaviour untouched.
- **Cache tokens.** Anthropic's `input_tokens` excludes cached tokens; `drivers/anthropic.ts:42-44` drops `cache_read_input_tokens` / `cache_creation_input_tokens`, so today caching would be metered as free. Fixed in Task 1.
- **Unattributed platform calls.** `generateAgentReply` (`agent/reply.ts:36`) calls `chat()` with no attribution, and `GenerateInput.attribution` is optional (`model-router/index.ts:50`). Under the ledger a platform-paid call without attribution is refused; Task 4 makes attribution required on the platform path and fixes callers.

---

## File map

### Billing module (home of the ledger, product-2 reusable)

- Create `src/modules/billing/credit-rates.ts`: versioned rate card, exact model ids, cache prices, voice per-minute price, `priceCall()`, `UnpricedModelError`, credit/micro-USD conversion. Pure.
- Create `src/modules/billing/credits.ts`: `meteringFor`, `creditBalance`, `allocateFifo` (pure), `debitAiUsage`, `debitVoiceCall`, `assertCreditsAvailable`, `CreditsExhaustedError`, `CREDITS_EXHAUSTED_MESSAGE`, `issueTrialGrant`, `ensureIncludedGrant`, `issueIncludedCredits`, `topUpIncludedGrant`, `grantPurchasedCredits`, `grantFounderCredits`, `reconcileCreditDebits`, `estimateRemainingReplies` (pure).
- Create `src/modules/billing/credit-packs.ts`: pack config (pure, importable by client components).
- Create `src/modules/billing/credit-alerts.ts`: low-balance email (reuses `src/modules/email`).
- Modify `src/modules/billing/plans.ts`: replace the "CREDITS ARE DISPLAYED, NOT METERED" comments (lines 18-21, 96-102) with the truth once Task 4 ships.
- Modify `src/modules/billing/limits.ts`: nothing functional; `applyFeatureOverrides` is reused as-is by `meteringFor`.

### Model router (the doorway)

- Modify `src/lib/model-router/types.ts`: `DriverUsage` gains optional `cacheReadTokens`, `cacheWriteTokens`.
- Modify `src/lib/model-router/drivers/anthropic.ts`: `usageOf` (42-44) and `tally` (93-96, 153) read cache fields.
- Modify `src/lib/model-router/usage.ts`: `recordUsage` becomes awaitable (returns the `AiUsage` id or null), stores cache tokens; synthetic path unchanged.
- Modify `src/lib/model-router/index.ts`: `resolveRuntime` (60-75) asserts the platform model is priced; `generate`/`chat`/`runAgent` (77-107, 118-131, 161-190) call preflight before the driver and debit after it; attribution required on the platform path.

### Schema

- Modify `prisma/schema.prisma`: `CreditGrant`, `CreditDebit`; `Org.includedCreditsOverride Int?`, `Org.creditsLowNotifiedAt DateTime?`, relations; `AiUsage.cacheReadTokens`, `AiUsage.cacheWriteTokens`; `VoiceCall.creditDebit` relation.

### Call sites (gating)

- Modify `src/modules/agent/reply.ts`: catch `CreditsExhaustedError` in `generateAgentActionReply` (70-91) → handoff line; add attribution to `generateAgentReply` (36).
- Modify `src/modules/ai/suggest-reply.ts` (167-180), `src/modules/ai/summarize.ts` (74-80), `src/modules/knowledge/distill.ts` (78-95): return/propagate `CREDITS_EXHAUSTED_MESSAGE`.
- Modify `src/modules/campaign/generate.ts`: `orgId` required (74); the error propagates to `src/app/(app)/campaigns/actions.ts:128`.
- Modify `src/app/api/voice/initiation/route.ts` (79-86) and `src/modules/voice/reminder-calls.ts` (43): credit preflight beside the minute check.
- Modify `src/modules/voice/file-call.ts` (77-97): debit after the `VoiceCall` write; `simulated` flag parameter; `src/app/(app)/settings/voice/actions.ts:77-98` passes `simulated: true`.

### Grants, reset, reconciliation

- Modify `src/modules/orgs/org.ts` (126-143) and `src/modules/admin/create-workspace.ts` (wherever `trialEndsAt` is set): issue the trial grant.
- Modify `src/app/api/cron/process-queue/route.ts`: two new steps after `expire-trials` (57-59): `issue-included-credits`, `reconcile-credit-debits`; summary counts.
- Modify `src/app/(app)/settings/billing/actions.ts` (170-181) and both payment webhooks: `topUpIncludedGrant` on plan activation; credit-pack branch.

### Top-up purchase

- Modify `src/modules/billing/stripe.ts` (`createStripeCheckout`, 27-70): optional `lineName` + extra metadata instead of plan-only fields.
- Modify `src/app/(app)/settings/billing/actions.ts`: `startCreditCheckoutAction`, `confirmCreditCheckoutAction`.
- Modify `src/app/api/webhooks/razorpay/route.ts` and `src/app/api/webhooks/stripe/route.ts`: `kind === "credits"` branch → `grantPurchasedCredits`.
- Modify `src/app/(app)/settings/billing/plan-checkout.tsx`: generalise into a `CheckoutButton` taking `{ kind: "plan" | "credits", id, label }` (same widget flow).

### Founder controls

- Modify `src/modules/admin/org-controls.ts`: `grantCredits`, `setIncludedCreditsOverride`; `setTrial` (49-77) also moves the trial grant's `expiresAt`.
- Modify `src/modules/orgs/audit.ts`: `admin.credits_granted`, `admin.included_credits_changed`, `billing.credits_purchased` + labels.
- Modify `src/app/admin/orgs/[id]/actions.ts` and `src/app/admin/orgs/[id]/controls/page.tsx`: "AI credits" card (balance, grants, two `ActionForm`s).

### Customer UI + email

- Modify `src/app/(app)/settings/billing/page.tsx`: "AI credits" `StatCard`, remaining-work estimate, top-up packs, paused banner.
- Create `src/components/features/credit-banner.tsx`: one-line "AI paused" banner used on the billing page and inbox page.
- Modify `src/lib/env-schema.ts`, `.env.example`: `CREDIT_LEDGER_EPOCH` (ISO date; reconciler ignores `AiUsage` rows older than this).

### Tests and docs

- Create `tests/credit-rates.test.ts`, `tests/credit-ledger.test.ts`, `tests/credit-debit.test.ts`, `tests/credit-concurrency.test.ts`, `tests/credit-reset.test.ts`, `tests/model-router-credits.test.ts`, `tests/credit-gating.test.ts`, `tests/credit-topup.test.ts`, `tests/credit-founder-controls.test.ts`, `tests/credit-reconcile.test.ts`, `tests/credit-low-balance.test.ts`.
- Modify `tests/ai-usage.test.ts`, `tests/llm-drivers.test.ts` (cache tokens), `tests/billing-confirm.test.ts` (unchanged behaviour, plus `topUpIncludedGrant` mock).
- Modify `docs/plans/2026-09-11-tiered-pricing-design.md` §7 "Built and live" list, `PROGRESS.md`.

---

## Schema (Task 2)

```prisma
// One positive balance with its own expiry. Balance = SUM(remainingMicroUsd)
// over rows with expiresAt > now(). 1 credit = 5,000 micro-USD.
model CreditGrant {
  id                String   @id @default(cuid())
  orgId             String
  org               Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  kind              String   // included | trial | purchase | founder
  amountMicroUsd    Int      // issued (may be 0: an Enterprise org with no override)
  remainingMicroUsd Int      // decremented by debits; the latest-expiring grant may go slightly negative (one call's overdraft)
  // Idempotency key per kind: included = "YYYY-MM"; trial = "trial";
  // purchase = gateway payment/session id; founder = the audit row id.
  sourceKey         String
  note              String?
  issuedAt          DateTime @default(now())
  expiresAt         DateTime
  @@unique([orgId, kind, sourceKey])
  @@index([orgId, expiresAt])
}

// One row per priced piece of work, anchored to the usage row it prices so
// a retry (webhook redelivery, reconciler) can never debit twice.
model CreditDebit {
  id              String    @id @default(cuid())
  orgId           String
  org             Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  amountMicroUsd  Int
  purpose         String    // agent_reply | suggest | distill | ingest | campaign_copy | summary | voice
  model           String    // exact model id, or "voice"
  rateCardVersion String
  aiUsageId       String?   @unique
  aiUsage         AiUsage?  @relation(fields: [aiUsageId], references: [id], onDelete: SetNull)
  voiceCallId     String?   @unique
  voiceCall       VoiceCall? @relation(fields: [voiceCallId], references: [id], onDelete: SetNull)
  // [{ grantId, microUsd }] in FIFO order; [] for simulated (shadow) debits.
  allocations     Json
  simulated       Boolean   @default(false)
  createdAt       DateTime  @default(now())
  @@index([orgId, createdAt])
}
```

Additions: `Org.includedCreditsOverride Int?` (mirrors `voiceMinutesOverride`, line 46), `Org.creditsLowNotifiedAt DateTime?`, `Org.creditGrants CreditGrant[]`, `Org.creditDebits CreditDebit[]`; `AiUsage.cacheReadTokens Int @default(0)`, `AiUsage.cacheWriteTokens Int @default(0)`, `AiUsage.creditDebit CreditDebit?`; `VoiceCall.creditDebit CreditDebit?`.

Migration steps (this repo has no `prisma/migrations`): `npm run db:push` → `npm run db:rls` (enables RLS, no policies, on the two new tables; Prisma is table owner and bypasses RLS; the Supabase publishable key cannot read them) → `prisma generate` runs on postinstall/build. Reconciliation identity: `SUM(CreditGrant.amountMicroUsd) − SUM(CreditDebit.amountMicroUsd WHERE NOT simulated) = SUM(CreditGrant.remainingMicroUsd)` per org, checked by the reconciler and reported in the heartbeat.

## Pricing a call (Task 1)

`src/modules/billing/credit-rates.ts`:

```ts
export const RATE_CARD_VERSION = "2026-09-15";
export const MICRO_USD_PER_CREDIT = 5_000;

/** Micro-USD per million tokens. EXACT model ids only — no substring matching. */
export const MODEL_RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  // FOUNDER TO CONFIRM against platform.claude.com pricing before live charges.
  "claude-sonnet-5":  { input: 2_000_000, output: 10_000_000, cacheRead: 200_000, cacheWrite: 2_500_000 },
  "claude-haiku-4-5": { input: 1_000_000, output: 5_000_000,  cacheRead: 100_000, cacheWrite: 1_250_000 },
};

/** Spec §4 assumption (US$0.15/min = 30 credits). FOUNDER TO CONFIRM with carrier + ElevenLabs quotes. */
export const VOICE_MICRO_USD_PER_MINUTE = 150_000;

export class UnpricedModelError extends Error {}

export function priceCall(model: string, u: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }): number {
  const r = MODEL_RATES[model];
  if (!r) throw new UnpricedModelError(`No rate for model "${model}" (rate card ${RATE_CARD_VERSION})`);
  return Math.round((u.inputTokens * r.input + u.outputTokens * r.output + (u.cacheReadTokens ?? 0) * r.cacheRead + (u.cacheWriteTokens ?? 0) * r.cacheWrite) / 1_000_000);
}
export function priceVoiceMinutes(minutes: number): number { return minutes * VOICE_MICRO_USD_PER_MINUTE; }
export function microUsdToCredits(micro: number): number { return micro / MICRO_USD_PER_CREDIT; }
```

Rounding is to the nearest micro-USD (0.0002 credit), never to a whole credit. Only the platform Anthropic models need rates: BYOK models are never debited (`usage.ts` keeps approximating them for the dashboard). `resolveRuntime` asserts `MODEL_RATES[model]` exists right after `assertRuntimeModelAllowed(model)` (`index.ts:70`), so a misconfigured `RUNTIME_MODEL` fails fast at the first call and never spends unpriced money.

## The debit path (Task 4)

In `src/lib/model-router/index.ts`, each of `generate`, `chat`, `runAgent` becomes:

```ts
const { driver, rt, byok } = await resolveRuntime(attribution, opts);   // throws UnpricedModelError for an unpriced platform model
const metering = byok ? "byok" : await assertCreditsAvailable(attribution.orgId); // "metered" | "unmetered" | "shadow"; throws CreditsExhaustedError
const { text, usage } = await driver.chat(rt, …);
const aiUsageId = await recordUsage(attribution, rt.model, usage, { byok });      // awaited; still never throws (returns null on failure)
if (metering !== "byok") await settleDebit({ attribution, model: rt.model, usage, aiUsageId, simulated: metering === "shadow" });
return sanitizeText(text);
```

`settleDebit` (in `credits.ts`) wraps `debitAiUsage` in `try/catch`: on failure it logs `console.error("[credits] debit failed — reconciler will retry", { orgId, aiUsageId, purpose })` and returns. It does **not** throw (the customer's reply exists and Nudge already paid the provider) and it is **not** silent: the `AiUsage` row exists, and `reconcileCreditDebits` re-debits every platform, non-synthetic `AiUsage` row newer than `CREDIT_LEDGER_EPOCH` with `creditDebit: null` on the next cron tick (≤ 5 min), idempotent via the unique `aiUsageId`. If `recordUsage` itself returned null there is no anchor; that case logs `[credits] usage row missing` and is the one accepted loss (same failure class as today's analytics).

`debitAiUsage` — atomic under concurrent calls:

```ts
await prisma.$transaction(async (tx) => {
  const grants = await tx.$queryRaw<{ id: string; remainingMicroUsd: number; expiresAt: Date }[]>`
    SELECT id, "remainingMicroUsd", "expiresAt" FROM "CreditGrant"
    WHERE "orgId" = ${orgId} AND "expiresAt" > now()
    ORDER BY "expiresAt" ASC, "issuedAt" ASC
    FOR UPDATE`;
  const { allocations, overdraftOn } = allocateFifo(grants, amountMicroUsd);   // pure, unit-tested
  for (const a of allocations) await tx.creditGrant.update({ where: { id: a.grantId }, data: { remainingMicroUsd: { decrement: a.microUsd } } });
  if (overdraftOn) await tx.creditGrant.update({ where: { id: overdraftOn.grantId }, data: { remainingMicroUsd: { decrement: overdraftOn.microUsd } } });
  await tx.creditDebit.create({ data: { orgId, amountMicroUsd, purpose, model, rateCardVersion, aiUsageId, allocations } });
});
```

Row-level `FOR UPDATE` serialises debits per org (Postgres blocks the second transaction until the first commits, then it re-reads the decremented rows). Two orgs never contend. Prisma interactive transactions pin one connection, which is fine through Supabase's transaction-mode pooler (`DATABASE_URL` with pgbouncer, per `PROGRESS.md`). A `P2002` on `aiUsageId` means "already debited" → return without error. Shadow debits skip the lock entirely (`allocations: []`, no grant update).

Preflight `assertCreditsAvailable(orgId)`: `SEND_MODE === "simulation"` → `"shadow"`; `meteringFor(org) === "unmetered"` → `"unmetered"`; else `creditBalance(orgId)` (one `aggregate` `_sum.remainingMicroUsd` over unexpired grants); if `≤ 0`, call `ensureIncludedGrant(org, now)` (covers the ≤5-minute gap after month rollover before the cron issues it; idempotent) and re-read; if still `≤ 0` throw `CreditsExhaustedError`. Two reads per call is acceptable at Nudge's volume; no cache.

## Monthly reset and grants (Task 3)

- **Trial:** `issueTrialGrant(orgId, trialEndsAt)` — kind `trial`, sourceKey `"trial"`, 100 credits, `expiresAt = trialEndsAt`. Called where orgs are created with a trial: `src/modules/orgs/org.ts:127-143` and the founder path in `src/modules/admin/create-workspace.ts` (grep `trialEndsAt:`). `setTrial` in `org-controls.ts:49-77` updates the trial grant's `expiresAt` in the same transaction (0 days → expire now).
- **Included:** `issueIncludedCredits(now)` runs as a cron step. Selects orgs `where: { trialEndsAt: null, OR: [{ subscriptionStatus: "active" }, { plan: "enterprise" }] }` with `plan, featureOverrides, includedCreditsOverride`, computes amount via `meteringFor`, and does one `creditGrant.createMany({ data, skipDuplicates: true })` with `sourceKey = "YYYY-MM"` (UTC), `expiresAt = Date.UTC(y, m + 1, 1)`. The unique constraint makes double-issue impossible regardless of how many ticks run.
- **Upgrade mid-month:** `topUpIncludedGrant(orgId, now)` after every plan activation (`confirmCheckoutAction` line ~181, both webhooks): inside a `FOR UPDATE` on this month's included grant, if `amountMicroUsd < newPlanAmount`, add the difference to both `amountMicroUsd` and `remainingMicroUsd`. Downgrades leave the grant alone.
- **Expiry** needs no job: every read filters `expiresAt > now()`.

## Zero-balance behaviour (Task 5)

`CREDITS_EXHAUSTED_MESSAGE = "Your AI credits are used up, so AI replies, drafts, summaries and campaign copy are paused. Your inbox, campaigns and follow-ups keep working. Top up in Settings → Billing."`

| Call site | Behaviour on `CreditsExhaustedError` |
|---|---|
| `agent/reply.ts` `generateAgentActionReply` (70-91), reached from `agent/inbound.ts:163-183` | catch → return `{ text: HANDOFF_MESSAGE, handoff: true, actions: [], pausedForCredits: true }`; inbound sends the existing handoff line (free-form, inside the just-opened 24h window) and marks the conversation `handoff` so a human replies. No customer is left unanswered. |
| `ai/suggest-reply.ts` (167-180) | `{ ok: false, error: CREDITS_EXHAUSTED_MESSAGE }` |
| `ai/summarize.ts` (74-80) | `{ ok: false, error: CREDITS_EXHAUSTED_MESSAGE }` |
| `campaign/generate.ts` (98-127) | rethrow with `CREDITS_EXHAUSTED_MESSAGE`; `campaigns/actions.ts:128` already surfaces `err.message` |
| `knowledge/distill.ts` (78-95) | existing catch → raw-answer fallback (never load-bearing); `knowledge/ingest.ts` `ingestFile` (431) rethrows the message |
| `api/voice/initiation/route.ts` (79-86) | after the minute check: `if (await creditsExhausted(orgId)) return 402 { error: "credits exhausted" }` |
| `voice/reminder-calls.ts` (43) | `if (await creditsExhausted(org.id)) continue;` |

Never gated: `sendMessage`, `send/queue`, `followup/*`, `automation/*`, `crm/*`, `scoring/*`, `api/v1/*`, BYOK orgs.

## Top-up purchase (Task 6)

`src/modules/billing/credit-packs.ts`:

```ts
export const PURCHASED_CREDIT_TTL_DAYS = 365;
export const CREDIT_PACKS = [
  { id: "pack_1k",  credits: 1_000,  prices: { INR: 999,   SGD: 19 } },
  { id: "pack_5k",  credits: 5_000,  prices: { INR: 4_499, SGD: 89 } },
  { id: "pack_10k", credits: 10_000, prices: { INR: 7_999, SGD: 169 } },
] as const;   // other currencies: not sold (page shows "Contact us"), matching plans.ts's stale-currency warning
```

Flow mirrors the plan checkout exactly:
- `startCreditCheckoutAction(packId)` (`requireRole(ctx, "ADMIN")`): INR → `createRazorpayOrder(price*100, "credits_<pack>_<org>", { orgId, kind: "credits", packId })`; SGD → `createStripeCheckout({ …, metadata: { orgId, kind: "credits", packId }, lineName: "Nudge AI credits — 1,000 (…)" })`. Top-ups never touch `Org.plan`.
- `confirmCreditCheckoutAction` (instant UI, Razorpay only): `verifyPaymentSignature` → `fetchRazorpayOrder` → `notes.kind === "credits"`, `notes.orgId === ctx.org.id`, `order.amount === pack.prices.INR * 100` (same integrity checks as `confirmCheckoutAction:149-167`) → `grantPurchasedCredits({ orgId, packId, sourceKey: paymentId })`.
- Webhooks: `payment.captured` with `notes.kind === "credits"` → `grantPurchasedCredits({ …, sourceKey: payload.payload.payment.entity.id })`; `checkout.session.completed` with `metadata.kind === "credits"` and `payment_status === "paid"` → `sourceKey: session.id`. Both parse the id field they do not read today.
- `grantPurchasedCredits` creates `{ kind: "purchase", sourceKey, amount = credits*5000, expiresAt = now + 365 d }` and treats `P2002` as "already granted" (confirm action and webhook race safely; a redelivered webhook is a no-op). Audit `billing.credits_purchased`.

Note (out of scope): the existing plan webhooks are not idempotent on provider event id (a replay re-extends `currentPeriodEnd`). The credits branch is.

## Founder controls (Task 7)

- `grantCredits(orgId, credits, expiresInDays | null, founderEmail, reason)` in `org-controls.ts`: integer 1–400,000; days 1–730 or null (= 365); transaction: `founderAudit(…, "admin.credits_granted")` then `creditGrant.create({ kind: "founder", sourceKey: <audit row id>, note: reason })`. Pattern copied from `setVoiceMinutes` (136-160).
- `setIncludedCreditsOverride(orgId, credits | null, …)`: integer 0–400,000; audit `admin.included_credits_changed`; then `topUpIncludedGrant` so an Enterprise org gets this month's credits immediately.
- Admin card on `controls/page.tsx`: balance, per-grant table (kind, remaining, expires), the two `ActionForm`s (`askReason`), and a warning when Enterprise has no override. Actions in `admin/orgs/[id]/actions.ts` follow `setVoiceMinutesAction` (88-98).
- `scripts/set-plan.ts` unchanged (the admin panel is the credit surface).

## Customer UI and low-balance email (Task 8)

- Billing page: a fourth `StatCard` "AI credits" = `balance` credits (one decimal), hint `"of {included} included this month · purchased expire {date}"`; a second line `"≈ {n} more AI replies"` from `estimateRemainingReplies(balance, avgAgentReplyDebitLast30d)` (pure; falls back to the rate-card price of a 2,000/300-token reply on `RUNTIME_MODEL` when there is no history). A "Top up" row with the three packs using the generalised `CheckoutButton`. When balance ≤ 0 and the org is metered, `<CreditBanner />` (also rendered on the inbox page) shows `CREDITS_EXHAUSTED_MESSAGE`. In simulation the card says "test mode — usage is illustrative" (from shadow debits this month).
- Email: after a successful metered debit, `maybeNotifyLowCredits(orgId)` (fire-and-forget): if balance ≤ 10% of this month's included amount (or ≤ 0) and `creditsLowNotifiedAt` is not in this calendar month, `sendEmail` to the OWNER membership email (style of `inviteEmail` in `admin/team.ts:53-82`, plain text + minimal HTML, link to `/settings/billing`), then set `creditsLowNotifiedAt`. `sendEmail` is already a no-op without `RESEND_API_KEY`.

---

## Tasks (TDD; each independently shippable and green)

### Task 1: Rate card + cache-aware usage (≈3h)

**Files:** create `src/modules/billing/credit-rates.ts`; modify `src/lib/model-router/types.ts`, `drivers/anthropic.ts`, `usage.ts`, `prisma/schema.prisma` (AiUsage cache columns); tests `tests/credit-rates.test.ts`, update `tests/ai-usage.test.ts`, `tests/llm-drivers.test.ts`.

- [ ] Write `tests/credit-rates.test.ts`: `prices claude-sonnet-5 exactly (1M in + 1M out + 1M cache read + 1M cache write)`; `prices claude-haiku-4-5 exactly`; `does not substring-match ("claude-sonnet-5-turbo" throws UnpricedModelError)`; `rounds to the nearest micro-USD, never up to a credit (1 token in on Haiku = 1 micro-USD = 0.0002 credits)`; `every Anthropic model in BYOK_ALLOWED_MODELS.anthropic and the env RUNTIME_MODEL default is priced`; `priceVoiceMinutes(3) === 450_000`.
- [ ] Implement the rate card; extend `DriverUsage`; read `cache_read_input_tokens` / `cache_creation_input_tokens` in `usageOf` and `tally`; make `recordUsage` `async`, return the row id (null on failure), store cache tokens. Keep `computeCostMicroUsd` as-is for analytics.
- [ ] `npm run db:push && npm run db:rls`; run tests, lint, build.

### Task 2: Ledger schema + pure core (≈4h)

**Files:** `prisma/schema.prisma` (CreditGrant, CreditDebit, Org columns); create `src/modules/billing/credits.ts` (pure parts + `creditBalance`); `tests/credit-ledger.test.ts`.

- [ ] Tests: `allocateFifo spends the soonest-expiring grant first`; `skips nothing expired (caller filters) and splits across grants`; `overdraws onto the latest-expiring grant when short`; `overdraft anchor works with a 0-amount grant`; `meteringFor: legacy front_desk → unmetered; free → metered 0; enterprise without override → metered 0; enterprise with override → override; starter → 1,000; featureOverrides never widen credits`; `estimateRemainingReplies uses recent average, falls back to rate-card reply price`.
- [ ] Add models, `db:push`, `db:rls`; implement pure functions and `creditBalance` (`aggregate` `_sum` with `expiresAt > now`).

### Task 3: Grants: trial, monthly included, upgrade top-up (≈4h)

**Files:** `credits.ts`; `orgs/org.ts`, `admin/create-workspace.ts`, `admin/org-controls.ts` (`setTrial`); `api/cron/process-queue/route.ts`; `settings/billing/actions.ts`, both webhooks (`topUpIncludedGrant`); `tests/credit-reset.test.ts`.

- [ ] Tests (hoisted prisma mock, `$transaction` running the callback like `tests/admin-org-controls.test.ts`): `issueIncludedCredits builds YYYY-MM rows only for active/enterprise, non-trial, metered orgs and calls createMany with skipDuplicates`; `second run in the same month issues nothing new`; `month boundary uses UTC`; `enterprise uses includedCreditsOverride`; `ensureIncludedGrant is a no-op when the month's grant exists`; `topUpIncludedGrant adds only the difference on upgrade and nothing on downgrade`; `issueTrialGrant is 100 credits expiring at trialEndsAt`; `setTrial moves the trial grant expiry`.
- [ ] Implement; wire cron step `issue-included-credits`; wire `issueTrialGrant` at both org-creation sites; wire `topUpIncludedGrant` at the three activation sites.

### Task 4: Debit hook in the router + reconciler (≈6h)

**Files:** `src/lib/model-router/index.ts`, `credits.ts` (`assertCreditsAvailable`, `debitAiUsage`, `settleDebit`, `reconcileCreditDebits`), `agent/reply.ts` (attribution on `generateAgentReply`), `campaign/generate.ts` (`orgId` required), `env-schema.ts` + `.env.example` (`CREDIT_LEDGER_EPOCH`), cron step `reconcile-credit-debits`; `tests/credit-debit.test.ts`, `tests/model-router-credits.test.ts`, `tests/credit-reconcile.test.ts`.

- [ ] `tests/credit-debit.test.ts`: `locks the org's unexpired grants with SELECT … FOR UPDATE ordered by expiresAt`; `writes allocations and decrements each grant`; `P2002 on aiUsageId returns without a second decrement`; `simulated debit writes allocations [] and touches no grant`; `byok never debits`.
- [ ] `tests/model-router-credits.test.ts` (extends the `tests/ai-usage.test.ts` harness): `preflight throws CreditsExhaustedError at balance ≤ 0 and the provider is never called`; `preflight retries via ensureIncludedGrant before refusing`; `BYOK path skips preflight and debit`; `SEND_MODE=simulation → no gate, shadow debit`; `unpriced RUNTIME_MODEL is refused before mockCreate`; `platform call without attribution is refused`; `debit failure is logged with "[credits]" and the reply is still returned`; `runAgent debits once for the whole loop including cache tokens`.
- [ ] `tests/credit-reconcile.test.ts`: `re-debits platform non-synthetic AiUsage rows after the epoch with no CreditDebit`; `ignores byok, synthetic and pre-epoch rows`; `reports counts`.
- [ ] Implement; make `attribution` required on the platform path; update the `plans.ts` header comments to the new truth.

### Task 5: Zero-balance gating at call sites + voice (≈4h)

**Files:** `agent/reply.ts`, `ai/suggest-reply.ts`, `ai/summarize.ts`, `knowledge/distill.ts`, `knowledge/ingest.ts`, `api/voice/initiation/route.ts`, `voice/reminder-calls.ts`, `voice/file-call.ts`, `settings/voice/actions.ts`; `tests/credit-gating.test.ts`.

- [ ] Tests: `generateAgentActionReply returns the handoff line with pausedForCredits on exhaustion (no throw)`; `suggestReply and summarizeConversation return CREDITS_EXHAUSTED_MESSAGE`; `distillAnswer falls back to the raw fact`; `voice initiation returns 402 "credits exhausted" after the minute check`; `tickReminderCalls skips an exhausted org`; `fileCall debits ceil(durationSecs/60) × VOICE_MICRO_USD_PER_MINUTE anchored on voiceCallId, idempotent on redelivery`; `simulateCallAction files a shadow debit`.
- [ ] Implement `debitVoiceCall`, `creditsExhausted(orgId)` (a boolean wrapper over the preflight that never throws), the catches, and the `simulated` parameter on `fileCall`.

### Task 6: Top-up purchase (≈5h)

**Files:** create `credit-packs.ts`; modify `stripe.ts`, `settings/billing/actions.ts`, both webhooks, `plan-checkout.tsx` → `checkout-button.tsx`; `tests/credit-topup.test.ts`.

- [ ] Tests (style of `tests/billing-confirm.test.ts`): `startCreditCheckoutAction creates a Razorpay order with kind:"credits" notes and the INR pack price`; `SGD org gets a Stripe redirect with credits metadata`; `USD org is refused (pack not sold)`; `unknown packId refused`; `confirmCreditCheckoutAction refuses wrong org, wrong kind, wrong amount, bad signature`; `grants 1,000 credits expiring +365d idempotent on paymentId`; `razorpay webhook grants once across two deliveries`; `stripe webhook grants once and never changes Org.plan`.
- [ ] Implement.

### Task 7: Founder controls + admin card (≈3h)

**Files:** `admin/org-controls.ts`, `orgs/audit.ts`, `admin/orgs/[id]/actions.ts`, `admin/orgs/[id]/controls/page.tsx`; `tests/credit-founder-controls.test.ts`.

- [ ] Tests: `grantCredits rejects 0, non-integers, > 400,000, > 730 days`; `writes the founder grant in the same transaction as the admin.credits_granted audit row`; `setIncludedCreditsOverride audits before → after and tops up this month`; `null clears the override`.
- [ ] Implement; add the card.

### Task 8: Customer UI + low-balance email (≈4h)

**Files:** `settings/billing/page.tsx`, create `components/features/credit-banner.tsx`, inbox page, create `billing/credit-alerts.ts`; `tests/credit-low-balance.test.ts`.

- [ ] Tests: `notifies the OWNER once per calendar month when balance ≤ 10% of included`; `does not notify an unmetered or simulation org`; `skips cleanly when email is unconfigured`; `estimate line uses the pure helper`.
- [ ] Implement; keep the page server-rendered; no new UI primitives.

### Task 9: Concurrency integration test + docs (≈2h)

**Files:** `tests/credit-concurrency.test.ts`, `docs/plans/2026-09-11-tiered-pricing-design.md` §7, `PROGRESS.md`, `README.md` (one line on `TEST_DATABASE_URL`).

- [ ] `describe.skipIf(!process.env.TEST_DATABASE_URL)`: against a real Postgres, seed one org with a 10-credit grant; fire 20 concurrent `debitAiUsage` calls of 1 credit each; assert `remainingMicroUsd === −50_000` (10 covered, 10 overdrawn on the same grant), 20 debit rows, and the reconciliation identity holds; then fire the same 20 `aiUsageId`s again and assert nothing changes.
- [ ] Update the spec's "Built and live / Not built" lists and `PROGRESS.md`.

**Total estimate: ≈35 hours (about five focused days).**

## NOT in scope

Auto-recharge; spending limits or alerts beyond the single low-balance email; refunds/reversals and their UI; annual checkout; real Meta spend; credit packs in currencies other than INR/SGD; migrating legacy `free`/`front_desk` workspaces onto balances (they stay unmetered by design); idempotency of the *plan* webhooks on provider event id; removing or redesigning `usage.ts`; per-request "regeneration" semantics (every call is already new usage); verifying voice carrier/ElevenLabs costs; credit-expiry reminder emails; timezone-local month boundaries; a CLI for credit grants.

## Open questions for the founder

1. Confirm the rate card: is production really `claude-sonnet-5` ($2/$10) or Sonnet 4.6 ($3/$15) as the spec says? The credit examples in spec §4 change either way.
2. Voice: minute cap **and** 30 credits/min from the same balance (this plan's reading), or included minutes free of credits? And confirm the US$0.15/min assumption.
3. Should concierge-run knowledge ingest/distill spend the client's credits (default here: yes, they are platform-paid)?
4. Calendar-month reset (default here) versus reset on each monthly payment date.
5. Founder-comped plans need `subscriptionStatus = active` to receive monthly credits — acceptable?
6. Bounded overdraft of one call per org (Nudge absorbs it on included grants) — acceptable?
