# Agent Knowledge Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (founder mandate: inline execution by Fable, NO subagent delegation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Structured, categorized, conditional, self-growing agent knowledge: facts table + learn-on-the-job owner Q&A loop + onboarding questionnaire (form & interview modes).

**Architecture:** New `src/modules/knowledge/` module (pure cores + IO wrappers), two additive Prisma models, agent prompt/tool extensions, one new app area `/knowledge`. No embeddings; digest-in-prompt. Spec: `docs/superpowers/specs/2026-07-10-agent-knowledge-memory-design.md`.

**Tech Stack:** Existing only — Next.js 16, Prisma 6, zod, vitest, `lib/model-router` (Haiku), ui kit. No new deps, no new env vars.

## Global Constraints

- All 7 AGENTS.md invariants hold; sends only via `sendMessage`; free-form only inside `isWithinServiceWindow`.
- Haiku-only via `lib/model-router`; every AI call has a deterministic keyless fallback (simulation demos end-to-end).
- Every query org-scoped; writes role-gated ADMIN+ (`requireRole`); RLS: run `npm run db:push && npm run db:rls` after schema tasks.
- Green at every commit: `npx vitest run`, `npm run lint`, `npx tsc --noEmit` (ignore `.next/dev/types` noise), `npm run build` before final commit.
- Node 20 via nvm (`. "$NVM_DIR/nvm.sh" && nvm use 20`).
- Update `PROGRESS.md` at the end.

---

### Task 1: Prisma models

**Files:** Modify `prisma/schema.prisma` (append after `WaitlistSignup`).

**Produces:** `prisma.knowledgeEntry`, `prisma.ownerQuestion` clients.

- [ ] **Step 1: Append models**

```prisma
// Structured agent knowledge — one fact per row (spec 2026-07-10).
model KnowledgeEntry {
  id        String   @id @default(cuid())
  orgId     String
  org       Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  category  String   // menu_services | pricing | hours | location | policies | payments | faq | other
  fact      String
  condition String?  // plain-language applicability, e.g. "weekends only"
  source    String   // owner_answer | questionnaire | manual | import
  status    String   @default("active") // active | archived
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId, status, category])
}

// A question the agent could not answer, waiting for the owner (learn-on-the-job).
model OwnerQuestion {
  id          String    @id @default(cuid())
  orgId      String
  org        Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  question   String
  questionKey String
  status     String    @default("pending") // pending | answered | dismissed
  waiting    Json      @default("[]") // [{conversationId, contactId, askedAt, followedUpAt?}]
  askCount   Int       @default(1)
  answerText String?
  entryIds   String[]  @default([])
  askedAt    DateTime  @default(now())
  answeredAt DateTime?

  @@index([orgId, status])
  @@index([orgId, questionKey])
}
```

Add back-relations on `Org`: `knowledgeEntries KnowledgeEntry[]` and `ownerQuestions OwnerQuestion[]`.

- [ ] **Step 2:** `npx prisma validate` → "schema is valid"; `npx prisma generate`.
- [ ] **Step 3:** `npm run db:push` then `npm run db:rls` (local DB = the Supabase pooler in `.env`). Expected: two new tables, RLS enabled.
- [ ] **Step 4:** Commit `feat(knowledge): KnowledgeEntry + OwnerQuestion models`.

### Task 2: `normalize.ts` — dedupe key (pure)

**Files:** Create `src/modules/knowledge/normalize.ts`, `tests/knowledge-normalize.test.ts`.

**Produces:** `questionKey(question: string): string`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { questionKey } from "@/modules/knowledge/normalize";

describe("questionKey", () => {
  it("normalizes case, punctuation, whitespace", () => {
    expect(questionKey("Do you have CHICKEN?!")).toBe(questionKey("do you have chicken"));
  });
  it("drops leading filler so phrasings collide", () => {
    expect(questionKey("Is there chicken in the menu")).toBe(questionKey("do you have chicken in the menu"));
  });
  it("keeps distinct questions distinct", () => {
    expect(questionKey("do you have chicken")).not.toBe(questionKey("do you have parking"));
  });
  it("handles empty", () => {
    expect(questionKey("  ")).toBe("");
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/knowledge-normalize.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement**

```ts
/** Normalized dedupe key so 10 phrasings of one question become one OwnerQuestion. */
const FILLER = /^(do you have|do you|is there|are there|what is|what are|whats|what's|can i|could i|does the|do the|is the|how much is|how much)\s+/;

export function questionKey(question: string): string {
  let k = question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  k = k.replace(FILLER, "").trim();
  return k;
}
```

- [ ] **Step 4:** Test passes. **Step 5:** Commit `feat(knowledge): question dedupe key`.

### Task 3: `digest.ts` — categorized prompt digest (pure)

**Files:** Create `src/modules/knowledge/digest.ts`, `tests/knowledge-digest.test.ts`.

**Produces:** `KNOWLEDGE_CATEGORIES` (const array + labels), `buildKnowledgeDigest(entries: DigestEntry[], maxChars?: number): string` where `DigestEntry = { category: string; fact: string; condition: string | null }`. Returns `""` for no entries. Category order fixed: menu_services, pricing, hours, location, policies, payments, faq, other. Conditions render as `— only: <condition>`. Overflow: drop whole trailing entries (never truncate mid-fact), append `(+N more facts not shown)`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";

const e = (category: string, fact: string, condition: string | null = null) => ({ category, fact, condition });

describe("buildKnowledgeDigest", () => {
  it("empty → empty string", () => {
    expect(buildKnowledgeDigest([])).toBe("");
  });
  it("groups by category in fixed order with headers", () => {
    const d = buildKnowledgeDigest([e("hours", "Open 10am-8pm"), e("menu_services", "Serves biryani")]);
    expect(d.indexOf("MENU & SERVICES")).toBeLessThan(d.indexOf("HOURS"));
    expect(d).toContain("- Serves biryani");
  });
  it("renders conditions", () => {
    expect(buildKnowledgeDigest([e("menu_services", "Chicken dishes available", "weekends only")]))
      .toContain("Chicken dishes available — only: weekends only");
  });
  it("caps length by dropping whole facts and counting them", () => {
    const many = Array.from({ length: 200 }, (_, i) => e("other", `Fact number ${i} with some padding text`));
    const d = buildKnowledgeDigest(many, 1000);
    expect(d.length).toBeLessThanOrEqual(1000 + 40);
    expect(d).toMatch(/\(\+\d+ more facts not shown\)/);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```ts
export const KNOWLEDGE_CATEGORIES = [
  "menu_services", "pricing", "hours", "location", "policies", "payments", "faq", "other",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  menu_services: "MENU & SERVICES", pricing: "PRICING", hours: "HOURS",
  location: "LOCATION", policies: "POLICIES", payments: "PAYMENTS", faq: "FAQ", other: "OTHER",
};

export interface DigestEntry { category: string; fact: string; condition: string | null }

const DEFAULT_MAX = 6000;

export function buildKnowledgeDigest(entries: DigestEntry[], maxChars = DEFAULT_MAX): string {
  if (!entries.length) return "";
  const lines: string[] = [];
  for (const cat of KNOWLEDGE_CATEGORIES) {
    const inCat = entries.filter((x) => x.category === cat);
    if (!inCat.length) continue;
    lines.push(CATEGORY_LABELS[cat] + ":");
    for (const x of inCat) {
      lines.push(`- ${x.fact}${x.condition ? ` — only: ${x.condition}` : ""}`);
    }
  }
  let out = "";
  let dropped = 0;
  for (const line of lines) {
    if (out.length + line.length + 1 > maxChars) { if (!line.endsWith(":")) dropped++; continue; }
    out += (out ? "\n" : "") + line;
  }
  if (dropped > 0) out += `\n(+${dropped} more facts not shown)`;
  return out;
}
```

- [ ] **Step 4:** Test passes. **Step 5:** Commit `feat(knowledge): categorized prompt digest`.

### Task 4: `distill.ts` — owner answer → structured facts

**Files:** Create `src/modules/knowledge/distill.ts`, `tests/knowledge-distill.test.ts`.

**Produces:** `distillAnswer(question: string, answer: string): Promise<DistilledFact[]>`; `DistilledFact = { category: KnowledgeCategory; fact: string; condition?: string }`; exported pure `parseDistilled(raw: string, fallbackAnswer: string): DistilledFact[]` (zod-validated JSON parse; on any failure returns `[{ category: "other", fact: fallbackAnswer }]`). `distillAnswer` short-circuits to the fallback when `env.ANTHROPIC_API_KEY` is unset (keyless/simulation path). Uses `chat()` from `@/lib/model-router` with a system prompt demanding a JSON array of `{category, fact, condition?}` restricted to `KNOWLEDGE_CATEGORIES`, no retry loop beyond `extractJson`-style fence stripping (reuse `extractJson` from `@/modules/campaign/guardrails`).

- [ ] **Step 1: Failing test** (tests the pure parser + keyless fallback; model call not tested)

```ts
import { describe, expect, it } from "vitest";
import { parseDistilled } from "@/modules/knowledge/distill";

describe("parseDistilled", () => {
  it("parses a valid facts array", () => {
    const raw = '[{"category":"menu_services","fact":"Chicken dishes are served","condition":"weekends only"}]';
    expect(parseDistilled(raw, "x")).toEqual([
      { category: "menu_services", fact: "Chicken dishes are served", condition: "weekends only" },
    ]);
  });
  it("strips code fences", () => {
    const raw = '```json\n[{"category":"hours","fact":"Open till 8pm"}]\n```';
    expect(parseDistilled(raw, "x")[0].fact).toBe("Open till 8pm");
  });
  it("bad category / malformed JSON → single 'other' fact from the raw answer", () => {
    expect(parseDistilled('[{"category":"nope","fact":"y"}]', "yes only on weekends"))
      .toEqual([{ category: "other", fact: "yes only on weekends" }]);
    expect(parseDistilled("not json", "the answer")).toEqual([{ category: "other", fact: "the answer" }]);
  });
  it("empty array → fallback", () => {
    expect(parseDistilled("[]", "ans")).toEqual([{ category: "other", fact: "ans" }]);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** (`parseDistilled` with `z.array(z.object({category: z.enum(KNOWLEDGE_CATEGORIES), fact: z.string().min(3).max(300), condition: z.string().max(120).optional()})).min(1).max(8)`; `distillAnswer` = keyless-guard → `chat({system: DISTILL_SYSTEM, messages:[{role:"user", text: "CUSTOMER ASKED: …\nOWNER ANSWERED: …"}], maxTokens: 500})` → `parseDistilled(raw ?? "", answer)`.)
- [ ] **Step 4:** Pass. **Step 5:** Commit `feat(knowledge): answer distillation with keyless fallback`.

### Task 5: prompt upgrades — any-business identity, TODAY line, digest section, conditional rule

**Files:** Modify `src/modules/agent/prompt.ts`; Modify `tests/agent.test.ts` (or its prompt test file — locate `buildAgentSystemPrompt` tests; extend there); Create none.

**Interfaces:** `buildAgentSystemPrompt(profile: AgentProfileInput, options?: { withTools?: boolean; knowledgeDigest?: string; now?: Date; timezone?: string })`. New pure exports: `agentIdentity(vertical: string): { noun: string; scope: string }` and `formatNowLine(now: Date, timezone: string): string` (e.g. `Friday, 10 July 2026, 3:12 PM` via `Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })`). Backward compatible: no options → prompt unchanged except identity fix.

Behavior:
- `agentIdentity`: curated `VERTICAL_TEMPLATES[vertical]` if present; else noun = `${vertical.replace(/_/g, " ")} business` (e.g. "jewellery business"), scope = `GENERIC_SCOPE` = "products and services offered, prices, availability, opening hours, location, and orders or bookings"; empty/unknown vertical → noun "business".
- When `knowledgeDigest` non-empty: insert section `BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):\n<digest>` ABOVE the legacy blob section, and rename blob header to `ADDITIONAL BUSINESS INFORMATION:` (blob omitted entirely when empty).
- When `now`+`timezone` given: line 2 of prompt = `TODAY: <formatNowLine>.` plus RULE: `- Some facts have a condition after "— only:". Apply them against TODAY — e.g. a weekends-only item is unavailable on a Tuesday, and say so naturally.`
- `TOOL_GUIDANCE` gains: `- If the customer asks something the business knowledge does not answer, call \`ask_owner\` with the question — then tell them you're checking with the team and will get back to them. Never guess, never invent.`

- [ ] **Step 1: Failing tests** — jewellery org introduces itself as "a jewellery business" and prompt contains GENERIC_SCOPE; restaurant still uses curated scope; `formatNowLine(new Date("2026-07-14T09:42:00Z"), "Asia/Kolkata")` contains "Tuesday" and "3:12 PM"; digest section appears above blob; conditional rule present only when now/timezone passed; `ask_owner` mentioned in tools guidance.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All agent tests pass (`npx vitest run tests/agent.test.ts tests/agent-tools.test.ts tests/suggest-reply.test.ts`). **Step 5:** Commit `feat(agent): time-aware, any-vertical, knowledge-digest prompt`.

### Task 6: `questions.ts` — ask / answer / dismiss (+ audit actions)

**Files:** Create `src/modules/knowledge/questions.ts`, `tests/knowledge-questions.test.ts`; Modify `src/modules/orgs/audit.ts` (add `"knowledge.answered" | "knowledge.dismissed" | "knowledge.entry_archived"` to `AuditAction` + labels "Owner answered agent question" / "Agent question dismissed" / "Knowledge fact archived").

**Interfaces:**
- `type Waiter = { conversationId: string; contactId: string; askedAt: string; followedUpAt?: string }`
- Pure, tested: `appendWaiter(waiting: Waiter[], w: Waiter): Waiter[]` (no duplicate conversationId), `parseWaiting(json: unknown): Waiter[]` (defensive).
- `askOwner(ctx: { orgId: string; conversationId: string; contactId: string }, question: string): Promise<{ status: "queued" | "already_queued" }>` — dedupe on `(orgId, questionKey(question), status: "pending")`; existing → appendWaiter + `askCount+1`; else create.
- `answerOwnerQuestion(orgCtx: OrgContext, questionId: string, answerText: string): Promise<{ facts: number; followUpsSent: number }>` — `requireRole(orgCtx, "ADMIN")`; loads question org-scoped (throws if not pending); `distillAnswer` → `createMany` KnowledgeEntry (source `owner_answer`) → `sendKnowledgeFollowUps` (Task 7) → update question (status answered, answerText, entryIds, answeredAt) → `recordAudit(orgCtx, "knowledge.answered", question.question)`.
- `dismissOwnerQuestion(orgCtx, questionId)` — ADMIN+, sets dismissed, audits.

- [ ] **Step 1: Failing tests** for `appendWaiter` (dedupes by conversationId, preserves order) and `parseWaiting` (array passthrough, garbage → `[]`), plus `askOwner` dedupe using the established `vi.mock("@/lib/db", ...)` pattern from `tests/agent-tools.test.ts` (findFirst returns existing pending → update called with askCount increment, no create; returns "already_queued").
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Pass. **Step 5:** Commit `feat(knowledge): owner question lifecycle + audit`.

### Task 7: `followups.ts` — answer the waiting customers (24h-gated)

**Files:** Create `src/modules/knowledge/followups.ts`, `tests/knowledge-followups.test.ts`.

**Interfaces:**
- Pure, tested: `buildFollowUpText(question: string, facts: DistilledFact[]): string` → `Good news — I checked with the team. <fact sentences (with "(only: condition)" when set)> Anything else I can help with?` capped to facts[0..2].
- Pure, tested: `eligibleWaiters(waiting: Waiter[], lastInboundByConversation: Map<string, Date | null>, now: Date): Waiter[]` — not yet followed up AND `isWithinServiceWindow(lastInbound, now)`.
- `sendKnowledgeFollowUps(orgId: string, question: { id: string; question: string; waiting: Waiter[] }, facts: DistilledFact[]): Promise<number>` — loads the waiting conversations + contacts org-scoped, filters via `eligibleWaiters`, for each: `sendMessage("whatsapp", {address, optedIn, optedOutAt}, {kind: "text", text}, {orgId})`, threads a `conversationMessage` (direction outbound) + updates conversation preview/lastMessageAt (same shape as `inbound.ts:155-169`), stamps `followedUpAt` on the waiter, persists updated `waiting` Json. Send failures: skip that waiter, continue (never throw).

- [ ] **Step 1: Failing tests** for the two pure functions (window edge: 23h59m in-window sends, 24h01m skipped; already-`followedUpAt` skipped; condition rendered).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Pass. **Step 5:** Commit `feat(knowledge): auto follow-up inside the 24h window`.

### Task 8: `ask_owner` agent tool

**Files:** Create `src/modules/agent/tools/ask-owner.ts`; Modify `src/modules/agent/tools/index.ts` (add to `TOOLS`); Create `tests/agent-ask-owner.test.ts`.

**Interfaces:** tool name `ask_owner`; zod schema `{ question: z.string().min(5).max(300) }`; `write: true`. Handler:
1. Search active entries org-scoped: match if `questionKey(question)` tokens all appear in `fact.toLowerCase()` OR fact/condition substring hit — implemented as pure exported `findKnownFact(entries: DigestEntry[], question: string): DigestEntry | null` (every non-trivial key token ≥4 chars present in fact).
2. Known → return `KNOWN: <fact><condition suffix>. Answer the customer with this — do not say you are checking.`
3. Unknown → `askOwner(...)` → return `QUEUED: The owner has been asked. Tell the customer you are checking with the team and will get back to them shortly.`

- [ ] **Step 1: Failing tests** — `findKnownFact` (hit: "do you have chicken?" vs fact "Chicken dishes are served on weekends"; miss: "is there parking"); tool short-circuit (prisma mocked: entries contain the fact → handler returns KNOWN and `askOwner` create not called); dedupe path returns QUEUED; invalid input → isError result (via `parseAndRun`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement + register in `TOOLS`. **Step 4:** Pass, plus `npx vitest run tests/agent-tools.test.ts`. **Step 5:** Commit `feat(agent): ask_owner tool — the agent learns on the job`.

### Task 9: wire digest + time into the live reply path

**Files:** Modify `src/modules/agent/inbound.ts` (load org timezone + active entries alongside profile; build digest; pass `{ knowledgeDigest, now: new Date(), timezone: org.timezone }` through), `src/modules/agent/reply.ts` (accept and forward `promptOptions` param on both generate functions: `generateAgentReply(profile, history, promptOptions?)`, `generateAgentActionReply(profile, history, ctx, promptOptions?)`), `src/modules/ai/suggest-reply.ts` (same digest section in its system prompt, optional param, keeps canned fallback).

- [ ] **Step 1:** Extend existing prompt/suggest tests: passing promptOptions reaches `buildAgentSystemPrompt` (assert digest text lands in system string via exported builder, not via mocking internals).
- [ ] **Step 2:** FAIL → **Step 3:** Implement (one `prisma.knowledgeEntry.findMany({ where: { orgId, status: "active" }, select: { category: true, fact: true, condition: true }, orderBy: { createdAt: "asc" }, take: 400 })` + `prisma.org.findUnique({ where: { id: orgId }, select: { timezone: true } })` in `inbound.ts`). **Step 4:** Full suite green. **Step 5:** Commit `feat(agent): live replies read structured knowledge + today's date`.

### Task 10: `/knowledge` page — answer queue + fact library (+ nav + dashboard card)

**Files:** Create `src/app/(app)/knowledge/page.tsx`, `src/app/(app)/knowledge/actions.ts`, `src/app/(app)/knowledge/queue.tsx` (client), `src/app/(app)/knowledge/library.tsx` (client), `src/app/(app)/knowledge/loading.tsx`; Modify `src/components/features/app-shell/nav.ts` (insert `{ label: "Knowledge", href: "/knowledge", icon: BookOpen }` after Automations), `src/app/(app)/dashboard/page.tsx` (pending-questions banner/stat linking to `/knowledge` when count > 0).

**Server actions (all `requireOrgContext()`; writes `requireRole(ctx, "ADMIN")`; return `{ ok: boolean; error?: string }` matching the repo's actions pattern):** `answerQuestionAction(questionId, answerText)` → `answerOwnerQuestion`; `dismissQuestionAction(questionId)`; `addFactAction({category, fact, condition?})` (validate category via `KNOWLEDGE_CATEGORIES`, source `manual`); `updateFactAction(id, {category, fact, condition})`; `archiveFactAction(id)` (+ audit); `structureExistingInfoAction()` → distills `AgentProfile.businessInfo` paragraphs (split on blank lines, each through `distillAnswer("General business information", chunk)`), source `import`, max 40 chunks.

**Page:** server component; loads pending questions (askCount, waiting length) + active entries grouped by category; `<PageHeader>` + queue (question card: text, "N customers waiting", textarea + Answer/Dismiss buttons, `useTransition` pattern used by other client panels) + library (category sections, per-fact edit-in-place form + archive; add-fact form; "Structure my existing info" button shown only when `businessInfo` non-empty AND zero `import`-source entries). Viewer-safe: AGENT role sees read-only (writes are server-gated anyway; hide buttons via `role` prop).

- [ ] **Step 1:** Build the actions + page + components (UI task — verification is runtime, not unit tests).
- [ ] **Step 2:** `npx tsc --noEmit` + `npm run lint` green; dev-server click-through: queue answer flow updates library; dashboard card appears with a seeded pending question.
- [ ] **Step 3:** Commit `feat(knowledge): owner answer queue + fact library UI`.

### Task 11: questionnaire — one script, form + interview modes

**Files:** Create `src/modules/knowledge/questionnaire.ts` (pure script), `tests/knowledge-questionnaire.test.ts`, `src/app/(app)/knowledge/questionnaire/page.tsx`, `.../questionnaire/form-mode.tsx`, `.../questionnaire/interview-mode.tsx`, `.../questionnaire/actions.ts`; Modify `src/modules/concierge/index.ts` (`getConciergeStatus` counts `knowledgeEntry` rows as KB signal alongside `businessInfo`), onboarding checklist (locate the dashboard onboarding wizard checklist and add "Teach your AI the business" → `/knowledge/questionnaire`).

**Script (pure):** `questionnaireScript(vertical: string): QItem[]` where `QItem = { id: string; category: KnowledgeCategory; prompt: string; placeholder: string }` — ~20 items across basics/services+prices/hours/location/policies/payments/FAQs; when `VERTICAL_TEMPLATES` has the vertical, services wording adapts (clinic → "treatments", salon → "services", restaurant → "menu"); IDs stable (`services_list`, `hours_weekly`, …). Test: 18–24 items, all categories covered, stable ids, clinic wording contains "treatment".

**Actions:** `submitQuestionnaireAction(answers: { id: string; answer: string }[])` — ADMIN+; for each non-empty answer: `distillAnswer(scriptPromptById, answer)` → entries source `questionnaire`; returns `{ ok, facts }`. Both modes call the same action (interview submits incrementally, one answer at a time via `submitQuestionnaireAnswerAction(id, answer)` — same distill path).

- [ ] **Step 1:** Script test failing → implement → pass.
- [ ] **Step 2:** Build actions + both UIs (form: all sections one page; interview: chat-style stepper with Skip, progress "7/20", same script). tsc + lint green; click-through both modes in dev.
- [ ] **Step 3:** Commit `feat(knowledge): onboarding questionnaire — form + interview modes`.

### Task 12: demo seed + docs + final green

**Files:** Modify `src/modules/demo/seed.ts` (≈10 categorized entries for the boutique demo org incl. one conditional fact `("menu_services", "Silk saree pre-pleating service available", "weekends only")`-style, 1 pending OwnerQuestion whose `waiting` references a seeded conversation), `PROGRESS.md` (new top entry), `docs/superpowers/specs/...` (mark Status: built).

- [ ] **Step 1:** Seed additions idempotent (same upsert/create-if-missing style as the rest of seed.ts); run `npx tsx scripts/seed-demo.ts` (or the documented seed entry) against local DB → verify rows.
- [ ] **Step 2:** Full gate: `npx vitest run` (all green), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 3:** Manual E2E in dev (simulation): inbox sim tester → ask unknown question → agent says checking + OwnerQuestion appears → answer it on /knowledge → follow-up lands in the conversation → re-ask → agent answers from memory, honoring the condition against today.
- [ ] **Step 4:** Commit `feat(knowledge): demo seed + progress — the agent that trains itself`.

## Self-review

Spec coverage: model ✔(T1) digest ✔(T3) normalize ✔(T2) distill ✔(T4) prompt/identity/time ✔(T5) ask/answer/dismiss+audit ✔(T6) follow-ups ✔(T7) tool ✔(T8) live wiring + suggest-reply ✔(T9) UI+nav+dashboard ✔(T10) questionnaire+concierge+onboarding ✔(T11) seed+ops+PROGRESS ✔(T12). Types cross-checked: `DigestEntry`/`DistilledFact`/`Waiter` defined once, consumed by name. No placeholders remain.
