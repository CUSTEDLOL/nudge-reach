# AI cost accuracy — prompt caching + one real rate card

**Date:** 2026-09-20 · **Status:** implemented

**Goal:** stop over-paying Anthropic for prompt tokens we re-send unchanged,
and price every call — platform and BYO-key — from verified published rates
instead of hand-guessed ones.

---

## What was wrong

**1. Prompt caching was priced but never switched on.**
`credit-rates.ts` carried `cacheRead` / `cacheWrite` rates and the Anthropic
driver read `cache_read_input_tokens` / `cache_creation_input_tokens` back off
every response — but no call ever set `cache_control`. Those columns had been
recording `0` since launch and every prompt token was billed at full input
price.

That is expensive here specifically because of what the prefix contains and
how often it is re-sent:

- the vertical system template (`modules/agent/prompt.ts`)
- the org's knowledge digest — up to 6,000 chars (`modules/knowledge/digest.ts`)
- the tool schemas
- 12 messages of history (`HISTORY_LIMIT`, `modules/agent/inbound.ts`)

`runAgent` re-sends all of it on **every** step, up to `maxSteps = 5`, plus one
more full call on the cap-out path. A reply that calls two tools is three full
sends of an identical prefix.

**2. Two rate cards that disagreed.**

| | `modules/billing/credit-rates.ts` | `lib/model-router/usage.ts` (deleted) |
|---|---|---|
| Used by | credit ledger (real money) | dashboard / BYO visibility |
| Matching | exact model id | **substring** |
| Cache tokens | priced | **ignored entirely** |
| Sonnet | $2 / $10 (correct) | **$3 / $15 (stale)** |
| `gpt-5.2` | absent | matched `"gpt-5"` → **$1.25 / $10 instead of $1.75 / $14** |

The substring table also meant enabling caching would have made the dashboard
*under*-report, because `input_tokens` excludes cached tokens and the cache
columns were never priced.

## What changed

**Caching** (`lib/model-router/drivers/anthropic.ts`) — one `cache_control:
{type: "ephemeral"}` breakpoint on the system block, in all four call sites
(`generate`, `chat`, the `runAgent` loop, the cap-out closing call). Anthropic
renders `tools → system → messages`, so a single breakpoint on `system` caches
the tool schemas with it.

Tool order was already deterministic (fixed built-in array + custom actions
`orderBy: createdAt asc`), so no sort was added — a test now pins that, since
unstable order would silently invalidate the prefix.

**One rate card** (`modules/billing/credit-rates.ts`, `RATE_CARD_VERSION`
bumped to `2026-09-20`) — the substring table is deleted and `recordUsage`
prices from `MODEL_RATES` via a new `estimateCostMicroUsd`:

- `priceCall` — unchanged, still **throws** on an unknown model, so the ledger
  can never move money at a guessed rate.
- `estimateCostMicroUsd` — display only, **never throws** (metering must not be
  able to break the call it measures), counts cache tokens, and falls back to
  the dearest row on the card so an unpriced model over-states rather than
  showing $0. The fallback is computed, not hardcoded.

## Rates and where they came from

| Model | Input | Output | Cache read | Cache write | Source |
|---|---:|---:|---:|---:|---|
| `claude-sonnet-5` | $2.00 | $10.00 | $0.20 | $2.50 | platform.claude.com, 2026-09-15 |
| `claude-haiku-4-5` | $1.00 | $5.00 | $0.10 | $1.25 | platform.claude.com, 2026-09-15 |
| `gpt-5.2` | $1.75 | $14.00 | $0.175 | $1.75 | developers.openai.com, 2026-09-20 |
| `gpt-5-mini` | $0.25 | $2.00 | $0.025 | $0.25 | developers.openai.com, 2026-09-20 |

OpenAI caching is automatic with no write surcharge, so a "write" is billed as
an ordinary input token.

## Cross-provider cache accounting (the BYO half)

Putting `cacheRead` rates on the BYO rows exposed that they were dead code:
neither BYO driver reported cached tokens at all. Worse, the two families
count them in opposite directions:

| Provider | Prompt-token field | Cached tokens are… |
|---|---|---|
| Anthropic | `input_tokens` | **excluded** — reported separately |
| OpenAI | `prompt_tokens` | **included** in the total |
| Google | `promptTokenCount` | **included** in the total |

So a BYO-OpenAI org was billed on the dashboard for its *whole* prompt at the
full $1.75 input rate, even on the portion OpenAI had discounted to $0.175 —
an over-statement of up to ~90% of the cached part, in the opposite direction
to the Anthropic bug.

`DriverUsage.inputTokens` is now defined as **uncached input on every
provider** (`types.ts`), and the OpenAI and Gemini drivers subtract their
cached portion out (clamped at 0 if a provider's counts ever disagree). Both
agent loops tally through `usageOf` so the split lives in exactly one place
per driver.

## Expected saving

For a reply that calls two tools (~4,000-token prefix, three sends):

| | Input tokens billed | Cost |
|---|---:|---:|
| Before | ~12,000 at full rate | ~$0.029 |
| After | ~4,000 written once at 1.25x, ~8,000 read at 0.1x | ~$0.011 |

Roughly **60%** off a tool-using reply. Break-even is two calls sharing the
prefix; every agent reply makes at least two, seconds apart, well inside the
5-minute TTL (which each read refreshes).

Caching is a no-op below the model's minimum cacheable prefix — 1,024 tokens on
Sonnet 5 — so an org with a thin knowledge base neither saves nor pays extra.

## Open — needs a founder decision

**1. The Google BYOK model ids are not real.** `BYOK_ALLOWED_MODELS.google`
lists `gemini-3-pro` and `gemini-3-flash`; neither appears on Google's
published price sheet (which carries `gemini-3.1-pro-preview`,
`gemini-3.7-flash`, `gemini-3.8-flash`). They were deliberately **left off**
the rate card rather than mapped to a guess, so they price at the conservative
fallback. Decide which Gemini ids we support, then add their rates and fix
the allow-list.

Note the failure mode, which is worse than a silent fallback: these ids are
**on the allow-list**, so they pass every local check and resolve as `active`
— then Google rejects the id at call time. `byokStatus` reports `active` and
cannot detect this; only fixing the allow-list can. See "webhook resilience"
below for what that thrown error currently does.

**2. `gemini-3.8-flash` pricing is promotional** — $0.75 / $3.75 through
2026-12-31, then $1.50 / $7.50 on 2027-01-01. Whatever we adopt needs a diary
note.

**3. The cold-start reply estimate is still a guess.** `estimateRemainingReplies`
falls back to a 2,000-in / 300-out reply when an org has no history
(`modules/billing/credits.ts`). Real replies look closer to 12,000 input
tokens, so the "≈ n more AI replies" figure and the "10,000 credits ≈ 7,100
replies" line in the enterprise proposal are both optimistic. Left untouched
rather than swapped for another guess — one day of real `AiUsage` rows after
this ships gives the true number.

## Follow-up shipped alongside: the silent BYOK fallback

`getByokRuntime` returned `null` on every failure — no account, plan
downgraded, model unlisted, key undecryptable — so the caller could not tell
"no BYO configured" (normal) from "BYO configured but broken" (the org
believes it pays its own provider while every call runs on the platform key
and burns platform credits). The founder panel showed provider, model and
"key present", which all still looked healthy.

Resolution now happens once in a shared `resolve()`, and `byokStatus(orgId)`
exposes the outcome — `none` / `simulated` / `active` / `fallback` with a
reason — so the two cannot drift. `getByokRuntime` keeps its exact contract
(returns `null`, never throws, never takes the agent down); the org's
Integrations tab in the founder panel now shows the fallback and its reason
in red.

## Found, NOT fixed: webhook resilience

`src/app/api/webhooks/whatsapp/route.ts` has no try/catch around
`handleInboundMessage`, and `modules/agent/reply.ts` only catches
`CreditsExhaustedError` — everything else rethrows. So any provider error
(a bad BYOK model id, a revoked key, a provider outage) propagates out of
`POST`, the route 500s, `webhookEvent.processedAt` is never set, Meta retries,
and the customer gets no reply at all.

That wants a deliberate decision — swallow and reply with a fallback line,
dead-letter the event, or 200-and-queue — so it was left alone rather than
patched in passing.

## Verification

`npx tsc --noEmit` clean · `npx vitest run` 1301 passed / 3 skipped (the
skipped three are `credit-concurrency`, which needs real Postgres) ·
`npm run lint` clean · `npm run build` clean.

New: `tests/model-router-caching.test.ts` (6). Extended:
`tests/credit-rates.test.ts` (14), `tests/byok.test.ts` (14) and
`tests/llm-drivers.test.ts` (11 — four
existing `toEqual` usage assertions relaxed to `toMatchObject`; their token
values are unchanged, the object simply carries `cacheReadTokens` now). `tests/ai-usage.test.ts` lost its
`computeCostMicroUsd` block — those assertions encoded the stale $3/$15 Sonnet
price and the substring fallback, and now live in `credit-rates.test.ts`.

**Not yet measured in production.** The saving above is arithmetic, not an
observation. After deploy, confirm `AiUsage.cacheReadTokens` is non-zero on
agent replies; if it stays 0, something upstream is varying the prefix.
