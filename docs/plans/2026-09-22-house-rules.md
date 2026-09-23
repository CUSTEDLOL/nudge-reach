# House Rules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give an owner a place to tell the AI *how to behave* ("always push the waitlist", "never quote a price") that outranks the facts, on one Training page shared by the free trial and the full app — and retire the Setup page.

**Architecture:** A new `AgentRule` row per instruction, authored in plain English and silently distilled to a one-line imperative (with a deterministic guardrail so the distiller can rephrase but never introduce a new URL/email/price/number). `buildAgentSystemPrompt` gains a HOUSE RULES block above the knowledge digest, and the digest's "your only source of truth" heading softens so it stops contradicting the rules. Setup's fields are re-homed into a collapsible section on Training; opening hours move to Bookings. Design: `docs/plans/2026-09-22-house-rules-design.md`.

**Tech Stack:** Next.js App Router + TypeScript, Prisma/Postgres (Supabase), zod, vitest, `lib/model-router` (Haiku via `RUNTIME_MODEL`), Tailwind + `src/components/ui/*`.

---

## Before you start

- Read `AGENTS.md` (the seven invariants) and the design doc above **in full**, including §5a — it carries hard constraints discovered by a code read, and getting them wrong breaks the trial.
- Branch from current `main` (which includes the follow-ups merge `2c60b53`): `git worktree add .worktrees/house-rules -b feat/house-rules`, then `npm install` and `npx prisma generate` in it. Work only there; the parent checkout is `main` and other sessions use it.
- Commands: `npx tsc --noEmit`, `npm run lint`, `npx vitest run <file>`, `npm test`, `npm run build`. All green at every commit. Capture real exit codes (`cmd; echo $?`) — zsh ignores `PIPESTATUS`.
- **Invariant reminders that bite in this work:** #7 (agent scoped to one business — rules must never become a general-assistant escape hatch), #4 (works with no API key — the distiller needs a deterministic fallback), #3 (all AI through `lib/model-router`, metered), #5 (org-scoped queries).

### Hard constraints from the trial (design doc §5a)

- `tests/trial-training.test.tsx` pins the current trial UI. It will need rewriting in Task 7 — **rewrite it, never weaken it.** Preserve its negative assertions: no `data-source-card`, nothing matching `/step 1|progress/i`, nothing matching `/clinic|patient/i`, no `/trial/setup`.
- **New "Your business" section copy must not contain the words clinic, patient, progress or step** (that test asserts their absence).
- The trial's fact counter string `"Facts 0/50"` must not change. Rules are counted separately: **5 active in trial, 20 in full**.
- Put `data-tour="training-source"` on the **What it knows** section — `modules/trial/tour.ts` already looks for it and currently falls back to an amber "still loading" notice because nothing renders it. Free bug fix; do not change `tour.ts`.

---

### Task 1: Schema — the AgentRule table

**Files:** Modify `prisma/schema.prisma`

**Step 1: Add the model** (after `KnowledgeEntry`, whose shape it mirrors):

```prisma
// How the AI should BEHAVE, as opposed to what is true (KnowledgeEntry).
// Rules outrank facts in the prompt — see docs/plans/2026-09-22-house-rules-design.md.
model AgentRule {
  id          String   @id @default(cuid())
  orgId       String
  org         Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  /** The owner's own sentence — this is what the UI shows. */
  text        String
  /** The distilled line the prompt carries. Never surfaced to the owner. */
  instruction String
  scope       String   // always | never | when
  condition   String?  // for scope "when": "someone asks about pricing"
  status      String   @default("active") // active | archived
  source      String   // owner | migrated_donots | migrated_businessinfo | concierge
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([orgId, status, order])
}
```

Add `agentRules AgentRule[]` to `model Org`'s relation list.

**Step 2:** `npx prisma generate && npx tsc --noEmit` → both clean.
**Step 3: Do NOT run `db:push`.** The founder runs schema pushes. Note it for Task 10.
**Step 4: Commit** `git add prisma/schema.prisma && git commit -m "feat(rules): AgentRule table for how the AI should behave"`

---

### Task 2: The rule vocabulary + the distiller guardrail (pure)

**Files:** Create `src/modules/agent/rules.ts`; Test `tests/agent-rules.test.ts`

This module must be **pure** (zod + string helpers only, no db/env) so the UI, the server and the tests share it.

**Step 1: Write the failing tests** covering:
- `ruleSchema` accepts `{ text, instruction, scope: "always"|"never"|"when", condition? }`; rejects an unknown scope; caps `instruction` at 200 chars and `text` at 500; `condition` required when scope is `"when"` and rejected otherwise.
- `MAX_ACTIVE_RULES` is `{ trial: 5, full: 20 }`.
- `describeRule({ scope: "always", text })` → `"Always: <text>"`; `"never"` → `"Never: <text>"`; `"when"` → `"When <condition>: <text>"` (the list's plain-English line).
- **`introducesNewSpecifics(original, distilled)`** — the guardrail, and the most important test in this task:
  - `("push the waitlist at https://getgutfeeling.in/", "Always point customers to https://getgutfeeling.in/")` → `false` (same URL, fine)
  - `("push the waitlist", "Always point customers to https://evil.example/")` → `true` (invented a URL)
  - `("email admin@x.com", "Email support@x.com")` → `true` (different email)
  - `("consults are ₹500", "Consults cost ₹900")` → `true` (different number)
  - `("consults are ₹500", "Tell them consults are ₹500")` → `false`
  - case/trailing-slash/`www.` differences on the same URL → `false` (normalise before comparing)
  - numbers that are part of a word the original had (e.g. "B12") → `false`
- `renderRulesBlock(rules)` → the exact prompt block (empty array → `""`).

**Step 2:** run → fail (module missing).

**Step 3: Implement.** `introducesNewSpecifics` extracts URLs, emails, and standalone numbers (incl. currency-prefixed) from both strings, normalises (lowercase, strip `www.`, strip trailing `/`), and returns `true` if the distilled set has any member the original set lacks. Keep the regexes simple and readable; prefer false-positives (reject a good distillation) over false-negatives (ship an invented URL).

`renderRulesBlock`:
```ts
export function renderRulesBlock(rules: Array<{ instruction: string }>): string {
  if (!rules.length) return "";
  return [
    "HOUSE RULES — follow these in every reply, even when the knowledge below points elsewhere:",
    ...rules.map((r) => `- ${r.instruction}`),
  ].join("\n");
}
```

**Step 4:** tests pass; `tsc`, `lint` clean.
**Step 5: Commit** `feat(rules): rule vocabulary and the distiller guardrail`

---

### Task 3: The prompt — rules above facts

**Files:** Modify `src/modules/agent/prompt.ts`; Test `tests/agent-prompt-rules.test.ts` (new) and check `tests/agent-prompt-voice.test.ts` still passes

**Step 1: Write the failing tests:**
- With rules present, the prompt contains the HOUSE RULES block, and its index is **before** the index of the knowledge heading.
- The knowledge heading is now `"BUSINESS KNOWLEDGE — your source of truth for facts:"` and the string `"your only source of truth"` **no longer appears anywhere** in the built prompt (this is the line that was defeating the owner's instruction).
- With no rules, no HOUSE RULES heading appears and the prompt is otherwise unchanged from today (snapshot the no-rules output against the current builder before you edit, and assert equality after).
- Rules appear for `channel: "voice"` too.
- The scope guardrail (`Only help with <business>…`) and the never-invent instruction are still present (invariant #7).

**Step 2:** run → fail.

**Step 3: Implement.** Add `rules?: Array<{ instruction: string }>` to `AgentPromptOptions`. In `buildAgentSystemPrompt`, build `const rulesBlock = renderRulesBlock(options.rules ?? [])` and place it immediately before `knowledgeSections`. Change the two headings:
- `"BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):"` → `"BUSINESS KNOWLEDGE — your source of truth for facts (never invent anything not stated here):"`
- the no-digest branch likewise: `"BUSINESS INFORMATION — your source of truth for facts (never invent anything not stated here):"`

Leave `blob` (`businessInfo`) exactly where it is for now — Task 8 migrates it; until then it must keep working.

**Step 4:** tests pass; full `npm test` green (other prompt tests may assert the old heading — if so, **update them to the new wording**, which is a legitimate change, and say which in the commit).
**Step 5: Commit** `feat(rules): house rules outrank facts in the agent prompt`

---

### Task 4: Reading rules at every call site

**Files:** Modify `src/modules/agent/profile.ts` (or wherever the profile is loaded for a reply — grep `buildAgentSystemPrompt` for callers: `modules/agent/reply.ts`, `modules/voice/initiation.ts`, `modules/ai/suggest-reply.ts`); Test `tests/agent-rules-wiring.test.ts`

**Step 1:** Add a loader in `src/modules/agent/rules-store.ts`:
```ts
export async function activeRules(orgId: string, limit: number): Promise<{ instruction: string }[]>
```
— `prisma.agentRule.findMany({ where: { orgId, status: "active" }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], take: limit, select: { instruction: true } })`.

**Step 2:** Pass `rules` into `buildAgentSystemPrompt` at **every** call site. Tests (mocked prisma) assert each caller passes them and that the org id is scoped.

**Step 3:** Verify with a grep that no caller of `buildAgentSystemPrompt` was missed — a missed one means rules silently don't apply on that channel.
**Step 4: Commit** `feat(rules): apply house rules on WhatsApp, voice and suggested replies`

---

### Task 5: Authoring — the distiller

**Files:** Create `src/modules/agent/distill-rule.ts`; Test `tests/agent-distill-rule.test.ts`

Mirror `src/modules/knowledge/distill.ts` exactly in shape (read it first).

- `distillRule({ orgId, text, scope, condition? }): Promise<{ instruction: string }>`
- Model path: `generate()` via `lib/model-router`, `attribution: { orgId, purpose: "rule_distill" }` (add that to `UsagePurpose` in `src/lib/model-router/usage.ts`). System prompt: turn the owner's sentence into ONE imperative under 200 characters, preserving every URL/email/number exactly, no new facts.
- **`rule_distill` is an absorbed purpose — the platform pays, never the client.** Add it to `isAbsorbedPurpose` in `src/modules/billing/credits.ts` alongside `ingest`, `distill` and `concierge_draft` ("Plan decision 8: concierge setup work is never charged to the customer"). Writing a rule is setup work, like teaching it a fact. Cost is ~0.1 credits per rule, once. Test that a zero-credit org can still author a rule (the absorbed branch returns before the balance read).
- Note for Task 7's UI: rules ride in the **cached** part of the system prompt (`cache_control: ephemeral` in `drivers/anthropic.ts`), so the recurring cost to the client is ~0.02 credits per reply — negligible. The cap exists for **answer quality, not cost**: past ~10 competing instructions a model starts silently dropping some.
- **Guardrail:** run `introducesNewSpecifics(text, instruction)`; if `true`, discard the model output and fall back to the trimmed original. Log `console.warn("[rule-distill] rejected", { orgId })` — never log the text.
- **Known gap the guardrail cannot close, so the prompt must (found in Task 2):** a number the original contains in one sense can be reused in another — `("we are open 24/7", "Consults cost 24 rupees")` passes, because `24` is in the original's token set. This is unreachable by token comparison; it needs semantics. Mitigate in the system prompt with an explicit, emphatic line: *"Preserve every number, price, URL and email address exactly as written. Never move a number to a different subject, and never introduce one."* Also state that the instruction must not add a claim the owner did not make. The residual risk is a wrong price inside an instruction (not a wrong link — links are caught), and the owner's own wording is what the UI shows.
- **Keyless path** (`!env.ANTHROPIC_API_KEY`): trimmed original, `recordSyntheticUsage`. Invariant #4.
- Tests: happy path; a model reply that invents a URL is rejected and the original used; keyless returns the trimmed original and records usage; over-long model output is rejected.

**Commit** `feat(rules): distil an owner's sentence into one instruction, safely`

---

### Task 6: Server actions

**Files:** Create `src/app/(app)/agent/rules-actions.ts`; Test `tests/agent-rules-actions.test.ts`

Follow the conventions in `src/app/(app)/agent/profile-actions.ts` (read it — it was `setup-actions.ts` when this was written; `11bf7d0` renamed it): `requireOrgContext()` **outside** the try (so Next's redirect isn't swallowed), `requireRole(ctx, "ADMIN")` inside, `recordAudit`, `revalidatePath("/agent")`.

- `createRuleAction(text, scope, condition?)` — validates, enforces the active cap (trial 5 / full 20 — derive trial-ness from `getTrialWorkspace`), distils, saves `status: "active"`, `source: "owner"`. Returns `{ ok, message }`.
- `updateRuleAction(id, text, scope, condition?)` — org-scoped `findFirst`; re-distils.
- `archiveRuleAction(id)` — sets `status: "archived"` (never deletes).
- ~~`reorderRulesAction(ids: string[])` — writes `order`.~~ **Removed** — no UI
  ever reached it (no drag affordance was built), so it was a role-gated server
  action with no caller. `order` is now insertion order only.
- Audit actions: add `"rule.created" | "rule.updated" | "rule.archived"` to `AuditAction` + labels in `src/modules/orgs/audit.ts`.
- Tests: cap refusal message; non-ADMIN refused; cross-org id refused; archive doesn't delete.

**Commit** `feat(rules): create, edit, archive and reorder house rules`

---

### Task 7: The unified Training page — three sections

**Files:** Modify `src/app/(app)/agent/page.tsx`; create `src/app/(app)/agent/rules-section.tsx` and `src/app/(app)/agent/business-section.tsx`; modify `src/components/features/trial/trial-training.tsx`; rewrite `tests/trial-training.test.tsx`; update `tests/agent-page.test.ts` if present

**This is the task that touches the trial. Re-read design doc §5a before starting.**

- Remove the `trial && !converted` fork from `page.tsx`: both paths render the same three sections. The trial keeps its tour/checklist chrome around them and its `factLimit` of 50.
- Section order: **Your business** (collapsible, collapsed when `businessName` is set) → **House rules** → **What it knows**.
- `data-tour="training-source"` goes on the **What it knows** section.
- "Your business" holds `businessName`, `vertical`, `tone` only — reusing the existing form controls from `agent-form.tsx` where possible. **No opening hours** (Task 9 moves them) and **no `businessInfo` box** (Task 8 migrates it; until Task 8 lands, leave the existing box in place on `/agent/setup` so nothing is lost mid-plan).
- Copy must avoid the words clinic, patient, progress, step.
- Rules section: the list (via `describeRule`), an add form, edit/archive per row, and the cap shown as e.g. "3 of 20". **Do not touch the `Facts n/50` counter.**
- **At 10+ active rules, show a quality nudge** under the counter (not a block): "10 of 20 · the more rules you add, the less reliably the AI follows each one." Founder decision 2026-09-22 — the cap is about answer quality, not cost.
- Rewrite `tests/trial-training.test.tsx` to assert the new unified page: the preserved literals it still renders, the new rules section, the `data-tour` anchor, the separate rule counter, and all four negative assertions.

**Browser check:** start the worktree's dev server on a free port (e.g. `PORT=3020 npm run dev`) and confirm `/agent` returns 307 → `/login`; report that you cannot verify signed-in rendering.

**Commit** `feat(rules): one Training page with business, rules and knowledge`

---

### Task 8: Migration — doNots and businessInfo

**Files:** Create `src/modules/agent/migrate-profile.ts`; Test `tests/agent-migrate-profile.test.ts`

- `migrateProfileToRules(orgId): Promise<{ rules: number; facts: number }>` — idempotent:
  - `doNots` → one rule per sentence, `scope: "never"`, `source: "migrated_donots"`. Skip if a rule with that source and text already exists.
  - `businessInfo` → split into lines/sentences; instruction-shaped ones (imperative verbs, "always", "never", "make sure", "push", "tell them") become rules with `source: "migrated_businessinfo"`; the rest become `KnowledgeEntry` rows with **`status: "draft"`** (the existing awaiting-review state) and `source: "manual"`.
  - **Neither legacy column is cleared.** They stay for one release so a rollback loses nothing.
- Run it lazily on first load of the new Training page (guard so it runs once per org — e.g. skip when any rule with a `migrated_*` source exists), and expose it in the founder admin org page so concierge onboarding can trigger it.
- Tests: idempotency (running twice creates nothing new); a `doNots` with two sentences makes two rules; an instruction-shaped line becomes a rule while a fact-shaped one becomes a draft fact; the legacy columns are untouched.

**Commit** `feat(rules): migrate doNots and the business-info box into rules and draft facts`

---

### Task 9: Retire the Setup page

**Files:** Modify `src/app/(app)/agent/setup/page.tsx` → redirect; move hours into Bookings; modify `src/components/features/app-shell/nav.ts` and `src/app/(app)/agent/front-desk-tabs.tsx`; update `tests/app-shell-nav.test.ts` and `tests/settings-nav.test.ts` if they assert the Setup tab

- Move the `HoursEditor` + the `openingHours` half of `saveAgentProfileAction` to the Bookings area (they write `Org.settings` via `settingsWithOpeningHours`; `modules/calendar` reads them — do not change the storage).
- `/agent/setup` → `redirect("/agent")`, matching how `/knowledge` and `/settings/agent` already 301.
- Remove the Setup tab from `front-desk-tabs.tsx`; leave Voice and Actions.
- `saveAgentProfileAction` keeps working for name/vertical/tone from the new section; drop only the hours branch.

**Commit** `feat(rules): retire the Setup page; opening hours move to Bookings`

---

### Task 10: Verification, PROGRESS.md, deploy note

- Real exit codes for `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- Run the seven invariant tests by name and confirm untouched: `tests/consent.test.ts`, `tests/org-scope.test.ts`, `tests/agent.test.ts` (24h window), `tests/roles.test.ts`, `tests/model-guard.test.ts`, `tests/env.test.ts`, `tests/agent-tools.test.ts`.
- Confirm a clean checkout is self-contained (`git archive HEAD | tar -x` into a tmpdir; check every file imported by `agent/page.tsx` exists).
- PROGRESS.md entry: what shipped, the founder decisions (rules outrank facts; silent distillation, made safe by the guardrail rather than an approval step), the trial tour anchor fixed in passing, and **the deploy note: production needs `npm run db:push` + `npm run db:rls` for `AgentRule` — and production is a DIFFERENT Supabase project from local.**
- State plainly what is unverified: nobody has exercised the signed-in UI.

**Commit** `docs: record house rules shipped`

---

## Done when

- An owner types "always push people to the waitlist at <url>" on `/agent`, it saves instantly, and the next AI reply points customers at that URL instead of the stale contact email.
- The trial shows the same three sections, its tour's Training step highlights the knowledge section instead of showing "still loading", and `Facts n/50` is unchanged.
- `/agent/setup` redirects; opening hours still drive booking availability.
- tsc, lint, the full suite and the build are green; the seven invariant tests are untouched.

---

## Deferred — knowingly left undone (2026-09-23)

Everything here was found during the build or its reviews, judged not worth
fixing now, and is written down so the next person does not rediscover it.

**The rule cap**

1. **TOCTOU race on the cap.** `createRuleAction` counts active rules and then
   creates one; two requests interleaving between the count and the write can
   leave an org with 21 active rules (trial: 6). Contained rather than fixed:
   every read path takes `limit`, so the prompt still carries at most 20 — the
   extra row is invisible to the AI and archivable by hand. A transaction or a
   partial unique index would close it properly.
2. **Voice reads `MAX_ACTIVE_RULES.full` unconditionally**, while the WhatsApp
   path derives trial-ness. Correct today only because no acquisition trial
   carries the `voiceAgent` limit — the moment a trial gets voice, a trial org's
   voice calls would carry 20 rules where its chats carry 5. The comments at
   each call site say so; the coupling is not enforced in code.

**The distiller guardrail** (`introducesNewSpecifics`)

3. **It is one-directional.** It catches a specific the distillation *invented*,
   never one it *dropped*. "Consults are ₹500 before 6pm" rewritten to "Tell them
   consults are ₹500" passes cleanly — the constraint is gone and nothing
   objects. The owner's own wording is what the UI shows, which is the only
   mitigation.
4. **Word-priced and worded facts are invisible to it.** It compares digits,
   links and emails; "five hundred rupees", "the consult is free", "next Tuesday"
   carry no token it can compare, so a model that invents one is not caught. The
   system prompt forbids it emphatically; the guardrail cannot enforce it.
5. **`widensScope` is phrasing-bypassable by design.** It matches the shapes a
   scope-widening instruction usually takes ("answer anything", "help with any
   question"), not the meaning. A determined paraphrase gets past it. It is a
   net, not a proof — invariant 7's real enforcement remains the scope line in
   the prompt, which the rules block sits above.

**The migration**

6. **The classifier's error rate on real customer text is unmeasured.** It is a
   regex with a documented, tested error class (a declarative sentence carrying
   "always" or "never" reads as an instruction) and a deliberate bias towards
   "instruction". Nobody has run it over a corpus of real `businessInfo` blobs;
   the only honest claim is the direction of the bias, not a number.
7. ~~**The legacy columns still reach the prompt.**~~ **DONE** — `fe85add`
   (the reply prompt), `ce1629e` (`suggest-reply`) and `360047c` (follow-up
   drafts). No prompt builder renders `businessInfo` or `doNots` any more; each
   carries a "do not reinstate them" comment where the block used to be, and
   `migrateProfileToRules` copies both into house rules and knowledge facts.
   The columns themselves are still written — deliberately, as the operator's
   untouched original (the concierge form reads `doNots` back to populate
   itself, and "Structure my existing info" re-distils `businessInfo`) — so the
   remaining follow-up is only to drop the columns once nothing needs the
   original. **Nothing in this item is outstanding for the prompt.** The
   original claim below is kept because it is what the release was reviewed
   against, not because it is still true:
   > `prompt.ts` still renders both (as `ADDITIONAL BUSINESS INFORMATION` and
   > `- Also avoid: …`), so a migrated org's text is in the prompt twice.

**From Task 9 (retiring Setup)**

8. ~~**`setup-actions.ts` outlived the page it was named for.**~~ **DONE** —
   `11bf7d0` renamed it `src/app/(app)/agent/profile-actions.ts`. It holds the
   Training page's profile writer and the auto-reply switch, and the filename
   now says so.
9. **The new auto-reply switch is admin-only and non-trial.** An AGENT sees
   nothing saying the AI is on (the status quo — the old switch was on a page
   they could not use either), and the trial does not get one, since its AI is
   switched on at activation and its chrome is pinned by `trial-training.test.tsx`.
10. **`/agent/setup` redirects permanently (308).** It matches how `/knowledge`
    and `/settings/agent` already retire, and browsers cache it — bringing a page
    back at that path later would need a different path or a cache bust.
11. **The opening-hours card sits at the foot of `/bookings` on every view**,
    including "Past". Fine at today's page size; if Bookings grows, hours want
    their own settings surface rather than a card under a list.
