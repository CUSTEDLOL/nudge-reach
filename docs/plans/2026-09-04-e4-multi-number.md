# E4 — Multiple WhatsApp Numbers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans.
> Head plan: `docs/plans/2026-09-04-enterprise-track.md` §E4. Branch: `e4-multi-number`.
> Riskiest workstream of the track — smallest possible green commits, nothing in parallel.

**Goal:** An org can connect several WhatsApp numbers; every inbound routes to the
right org AND number; every reply leaves from the number the customer wrote to.

**Decisions (confirmed with founder 2026-09-04):**
- **D-E4a — Numbers first, access later.** Everyone on the team sees all numbers;
  per-number staff visibility is a follow-up workstream (E4b), noted in the head plan.
- **D-E4b — One thread per customer (sticky routing), NOT one thread per number.**
  `Conversation` keeps `@@unique([orgId, contactId])` and gains `whatsappAccountId`
  = the last number the contact wrote to; replies (agent, inbox, follow-ups) leave
  from that number. Rationale: preserves the single-customer view, and leaves every
  existing upsert/dedupe path (`orgId_contactId`) untouched — the alternative
  (thread per number) rewrites campaign dedupe, follow-ups and /inbox/try.
  Tradeoff (documented): a customer simultaneously chatting with two branches
  interleaves into one thread. Revisit only with real demand.
- **D-E4c — Templates stay org-scoped**, submitted/polled via the DEFAULT number's
  WABA. Multi-WABA template sync is out of scope (most enterprise setups share one
  WABA across numbers). Documented limitation.
- **D-E4d — Adding a second number requires the `multiNumber` plan flag** (E0);
  the first number stays available to every tier as today.

## Tasks

### Task 1 — Schema + backfill
`WhatsappAccount`: drop `@unique` on `orgId` (keep plain index), add
`@@unique([phoneNumberId])` (webhook routing key), add `isDefault Boolean
@default(false)`. `Conversation` + `Campaign`: add `whatsappAccountId String?`.
Idempotent `scripts/backfill-multi-number.ts`: every existing account →
`isDefault: true`; point existing conversations/campaigns at their org's single
account. `db:push` + `db:rls` + run backfill.

### Task 2 — accounts.ts becomes multi-account (back-compat preserved)
`listWhatsappAccounts(orgId)`, `getDefaultWhatsappAccount(orgId)` (isDefault else
oldest), `setDefaultWhatsappAccount(orgId, id)`, `disconnectWhatsappAccount(orgId,
id)` (re-defaults if needed). `getWhatsappAccount(orgId)` / `getWhatsappCredentials
(orgId, whatsappAccountId?)` keep their signatures — default resolution — so the
dashboard/go-live-checklist/inbox-try callers stay untouched. `connectWhatsappAccount`
upserts by `phoneNumberId`; creating a SECOND account gates on `checkMultiNumber`.
Unit tests: default resolution, second-number plan gate, disconnect re-defaulting.

### Task 3 — Send pipeline routes by number
`SendOptions` gains `whatsappAccountId?`; `sendMessage` passes it to
`getWhatsappCredentials`. Callers thread it through: `agent/inbound.ts` (reply via
the conversation's account), `inbox/actions.ts` sendText/sendTemplate (same),
`followup/send.ts` + `knowledge/followups.ts` (conversation's account),
`send/queue.ts` (campaign's account else default). Unit test: reply leaves from the
conversation's account, campaign from its selected account.

### Task 4 — Inbound webhook stamps the number
`processInbound` already resolves the account by `phone_number_id`; pass
`account.id` into `handleInboundMessage(orgId, from, text, { whatsappAccountId })`
→ conversation upsert sets/updates `whatsappAccountId` (sticky = last inbound).
Simulator (`simulateInboundAction`, /inbox/try) uses the default account when one
exists, null otherwise (sim orgs need zero accounts — invariant 4).
Test: two accounts, contact writes to #2 → conversation stamped #2 → agent reply
credentials resolve #2.

### Task 5 — UI
Settings → WhatsApp: list numbers (default badge, set-default, disconnect), "Add
number" reuses the manual-credentials form (gated on `multiNumber` for the 2nd+).
Inbox thread header: show the number's displayName when the org has >1 account.
Campaign create: sending-number select when >1 (stored on the campaign).
Integrations page hero: "N numbers connected".

### Task 6 — Docs + gates
PROGRESS entry with founder notes (per-number live mode is still org-level; E4b
noted). Full gates + `npm run eval:agent` ≥ 90% (inbound path touched). Merge alone.
