# Agent Knowledge Memory — "the employee that trains itself"

**Date:** 2026-07-10 · **Status:** approved by founder · **Builds on:** `src/modules/agent`,
`AgentProfile`, concierge onboarding.

## Why

Today the agent's knowledge is one free-text blob (`AgentProfile.businessInfo`) pasted by the
owner and dumped whole into every prompt. Three problems: owners under-write it, the agent
re-reads everything on every message, and the agent has no way to learn what it doesn't know.
This feature makes the knowledge **structured, categorized, conditional, and self-growing** —
strengthening moat 3 (done-for-you) and retention (a 3-month-old agent knows hundreds of
facts a competitor's blank bot doesn't).

Approach chosen: **structured facts table** (no embeddings/RAG — an SMB's 50–500 facts fit
Haiku's context; deterministic and testable; RAG is a later upgrade if a client passes ~1,000
facts).

## 1. Data model (Prisma, additive; RLS via `db:rls` after `db:push`)

```prisma
model KnowledgeEntry {
  id        String   @id @default(cuid())
  orgId     String
  category  String   // menu_services | pricing | hours | location | policies | payments | faq | other
  fact      String   // one canonical statement, e.g. "Chicken dishes are served"
  condition String?  // plain-language applicability, e.g. "weekends only"
  source    String   // owner_answer | questionnaire | manual | import
  status    String   @default("active") // active | archived
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([orgId, status, category])
}

model OwnerQuestion {
  id            String    @id @default(cuid())
  orgId         String
  question      String    // customer-phrased question, cleaned
  questionKey   String    // normalized dedupe key
  status        String    @default("pending") // pending | answered | dismissed
  waiting       Json      @default("[]")      // [{conversationId, contactId, askedAt}] — every customer awaiting this answer
  askCount      Int       @default(1)
  answerText    String?   // raw owner answer
  entryIds      String[]  @default([])        // KnowledgeEntry ids distilled from the answer
  askedAt       DateTime  @default(now())
  answeredAt    DateTime?
  @@index([orgId, status])
}
```

Dedupe is code-level: before creating, look up a `pending` question with the same
`(orgId, questionKey)`; if found, append to `waiting`, bump `askCount`. Ten customers asking
"do you have chicken?" = one owner question, ten follow-ups.

## 2. Knowledge module — `src/modules/knowledge/`

- **`digest.ts` (pure, tested)** — active entries → compact categorized prompt digest:
  category headers, one line per fact, conditions rendered as `(only: weekends)`. Hard cap
  (~6k chars) with deterministic overflow order (oldest `other` facts dropped first, count of
  dropped facts noted). This is what the agent reads — never the raw table.
- **`normalize.ts` (pure, tested)** — `questionKey(question)`: lowercase, strip punctuation,
  collapse whitespace, drop leading filler ("do you", "is there", "what is"). Good-enough
  dedupe, no AI.
- **`distill.ts`** — (question, ownerAnswer) → `[{category, fact, condition?}]` via
  `lib/model-router` chat (Haiku), zod-validated, one strict retry. **Keyless fallback**
  (simulation/demo): one entry `{category: "other", fact: answerText}` — deterministic, the
  loop still works end-to-end without an API key.
- **`questions.ts`** — `askOwner()` (dedupe-or-create; called by the agent tool),
  `answerQuestion()` (distill → create entries → trigger follow-ups → audit log),
  `dismissQuestion()`. All org-scoped, role-gated ADMIN+ for answering.
- **`followups.ts`** — after an answer: for each `waiting` conversation, if
  `lastInboundAt` is within the 24h service window (`isWithinServiceWindow`), send ONE
  free-form reply through `sendMessage` (all existing gates apply) phrased from the distilled
  facts + thread it into the conversation; otherwise skip silently (memory-only — the chosen
  v1 behavior; template re-open is a later upgrade). Stamp per-conversation so a follow-up
  never double-sends.
- **`migrate.ts`** — "Structure my existing info": distills `AgentProfile.businessInfo` into
  entries (source `import`). The blob stays untouched as fallback until the owner clears it.

## 3. Agent changes — `src/modules/agent/`

- **`prompt.ts`**
  - **Any-business identity (kills the restaurant bug):** noun = curated template if the
    vertical has one, else the org's own vertical label humanized ("a jewellery business"),
    else "business". Scope = curated line if present, else the generic line: "products and
    services offered, prices, availability, opening hours, location, and orders or bookings".
  - **Time context:** inject `TODAY: Tuesday, 14 July 2026, 3:12 PM (Asia/Kolkata)` using the
    org's timezone — this is what makes conditional facts answer correctly ("chicken is
    weekends-only; today is Tuesday → no").
  - **Knowledge section:** categorized digest replaces the blob as the primary source of
    truth; legacy `businessInfo` blob appended below it while it still exists.
  - **New rule + conditional-facts instruction:** facts with a condition apply only when the
    condition holds NOW; if the answer isn't in the knowledge, use `ask_owner` (tool mode) /
    say you'll check with the team (no-tools mode). Never guess.
- **`tools/ask-owner.ts`** — new `defineTool`. Input: the customer's question (one sentence).
  Behavior: first searches active `KnowledgeEntry` rows for a matching fact (normalized-key
  and substring match) — if found, returns the fact to the model (the agent should answer,
  not ask). Otherwise dedupe-or-create the `OwnerQuestion`, register this conversation in
  `waiting`, and return ok → the agent tells the customer it's checking with the team and
  will get back to them. Never throws (tool contract).
- **`reply.ts`** — passes entries digest + org timezone/now into the prompt builder.

## 4. Owner surfaces — `src/app/(app)/knowledge/`

- **`/knowledge`** (sidebar link): top — **"Needs your answer"** queue (question, how many
  customers are waiting, answer textbox, Answer / Dismiss). Below — the **fact library**
  grouped by category: add / edit / archive facts (plain forms, server actions, ADMIN+).
  Includes the one-click "Structure my existing info" button when a legacy blob exists.
- **Dashboard**: pending-questions stat card linking to `/knowledge` (only when count > 0).
- **`/knowledge/questionnaire`** — owner's choice, two modes, one shared question script
  (deterministic, ~20 questions across: basics, services/menu + prices, hours, location,
  policies, payments, FAQs; per-vertical wording tweak where a curated template exists):
  - **Form mode:** all sections on one page, submit once.
  - **Interview mode:** chat-style UI asking the same script one question at a time (skip
    button per question). No AI asks the questions — the script is deterministic; AI only
    distills the answers. Cheap, testable, works keyless.
  - Both feed every answer through `distill.ts` into `KnowledgeEntry` rows.
- **Onboarding wizard + concierge:** checklist item "Teach your AI the business" linking to
  the questionnaire; concierge `getConciergeStatus` counts knowledge entries as the KB signal.

## 5. Invariants & guardrails (all seven preserved)

- All sends go through `sendMessage` — consent + per-tenant creds + 24h window enforced
  as today; follow-ups are free-form ONLY inside the window, else skipped (no new send path).
- Haiku-only via `lib/model-router` everywhere (distillation included); keyless fallbacks keep
  **simulation mode end-to-end** (sim tester → ask_owner → queue → answer → follow-up, zero keys).
- Every query org-scoped; new tables get RLS; actions role-gated (`requireRole` ADMIN+ for
  answer/dismiss/edit; AGENT can view).
- Agent stays scoped to the one business — the digest and blob remain the only source of truth.
- No new plan gates: available wherever the agent runs today.
- Audit log: `knowledge.answered`, `knowledge.dismissed`, `knowledge.entry_archived`.

## 6. Demo seed

Demo org gets ~10 categorized entries (some conditional — one "weekends only" style fact for
the money demo), 1 pending owner question with a waiting conversation, so the whole loop
demos in 30 seconds.

## 7. Testing (unit, mirrors `tests/`)

digest builder (grouping, conditions, cap/overflow) · questionKey normalization + dedupe ·
distill zod validation + keyless fallback · follow-up window check + double-send stamp ·
ask_owner tool (existing-fact short-circuit, dedupe, never-throws) · prompt: date injection,
any-vertical identity (jewellery ≠ restaurant regression), digest section, conditional-facts
rule · org scoping + role gates on the new actions. Existing agent tests updated.

## 8. Ops

`npm run db:push` + `npm run db:rls` after merge (two new tables). No new env vars. No new deps.

## Out of scope (explicitly)

WhatsApp-to-owner asking (v2) · template re-open of closed windows (v2) · embeddings/RAG ·
auto-ingest from Instagram/Google Maps/menu photos (separate spec) · fine-tuning (never —
policy + economics).
