# House rules — design (2026-09-22)

Status: approved by founder 2026-09-22.

## Why

The Setup page has a box labelled "What should the assistant know?". The
founder typed an **instruction** into it — *"Action item to push everyone
coming to inbox to join the waitlist at https://getgutfeeling.in/"* — and the
agent ignored it, answering from a stale knowledge fact
(*"Contact email: admin.gutfeeling@gmail.com"*) instead.

It was not a save bug. `AgentProfile.businessInfo` held the text exactly. The
prompt is the problem — `buildAgentSystemPrompt` renders:

```
BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):
  …21 facts…

ADDITIONAL BUSINESS INFORMATION:
  …the owner's text…
```

The facts are declared the *only* source of truth; the owner's text is demoted
to "additional information". The model did what it was told.

Two distinct failures underneath:

1. **There is no slot for behaviour.** The product models *what is true*
   (`KnowledgeEntry`) and a negative-only scrap of behaviour
   (`AgentProfile.doNots`), but nothing for *how to act* — "always push the
   waitlist", "never quote a price, book a consult instead".
2. **Two pages for one job.** Setup and Training both claim to configure the
   AI, so an owner cannot tell which box changes behaviour. Founder verdict:
   Setup "is just building up useless friction" and should go.

## Decisions (founder, 2026-09-22)

| Question | Decision |
| --- | --- |
| Rules vs facts when they disagree | **Rules override.** Rules are orders; facts are reference |
| Authoring | Owner types plain English; the AI distils it silently |
| Visibility of the distilled text | **Not surfaced.** The list shows the owner's original; the distilled line is internal |
| Where it lives | The **Training page**, identical in the free trial and the full app |
| Setup page | Goes away — its fields are re-homed, not deleted |
| Trial collision | Coordinate with the session owning trial onboarding before touching shared files |

The silent-distillation choice was challenged twice and held. The risk it
creates — an AI-written instruction, unreviewed, outranking verified facts — is
mitigated by engineering rather than by a confirmation step: see *Distiller
guardrail*.

## 1. One Training page, three sections

`/agent` currently forks: `trial && !converted` renders `TrialTraining`,
everyone else gets `Queue` + `Library` + `ImportPanel`. Both already consume the
same `LibraryFact` shape, so the fork is chrome, not substance. Unify on three
sections, same order in both:

1. **Your business** — `businessName`, `vertical`, `tone`. Collapses to a
   one-line summary once filled, so it is not friction after the first visit.
2. **House rules** — new (§2).
3. **What it knows** — the existing queue, library and import, unchanged.

The trial renders the same three with fewer facts and its tour above them.

**Opening hours move to Bookings/Calendar.** They are booking configuration,
not AI persona; they live in `Org.settings` and are consumed by
`modules/calendar`. Moving them removes the last reason for `/agent/setup` to
exist. `/agent/setup` then 301s to `/agent`, as `/knowledge` and
`/settings/agent` already do.

## 2. What a rule is

```prisma
model AgentRule {
  id          String   @id @default(cuid())
  orgId       String
  org         Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  /** The owner's own sentence — this is what the UI shows. */
  text        String
  /** The distilled line the prompt actually carries. Never surfaced. */
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

Mirrors `KnowledgeEntry`'s shape deliberately: `status` instead of deletion,
`source` for provenance, `condition` for applicability.

**Caps, because rules ride in every reply:** at most 20 active rules per org,
each `instruction` ≤ 200 characters. An unbounded list would make every
message slower, dearer and vaguer.

## 3. The prompt

`buildAgentSystemPrompt` gains a rules block **above** the knowledge, and the
knowledge heading softens:

```
HOUSE RULES — follow these in every reply, even when the knowledge below
points elsewhere:
- Always point people to the waitlist at https://getgutfeeling.in/
- Never quote a price; offer a consultation instead

BUSINESS KNOWLEDGE — your source of truth for facts:
  …
```

`"your only source of truth"` → `"your source of truth for facts"` is
load-bearing: left as-is it contradicts the rules directly above it and rules
keep losing. Invariant #7 (agent scoped to one business) is unaffected — the
scope guardrail and the never-invent instruction both stay.

Rules apply to WhatsApp and voice alike, and to `suggest-reply`.

## 4. Authoring and the distiller

Owner types a sentence → saved immediately, no modal → the AI distils it into
one short imperative stored as `instruction`. The list shows `text`.

Reuses the `distillAnswer` pattern (`modules/knowledge/distill.ts`): cheap model
through `lib/model-router`, metered, with a **deterministic keyless fallback**
that stores a trimmed version of the original as the instruction, so the flow
works with no API key (invariant #4).

### Distiller guardrail

The distilled instruction may **rephrase but not introduce**. Before it is
stored, a pure check extracts every URL, email address, price and number from
both `text` and `instruction`; if the instruction contains one the original did
not, the distillation is rejected and the trimmed original is stored instead.
This is what makes silent distillation safe: the AI can compress the founder's
wording, but it cannot invent a different URL to send customers to.

## 5. Migration

Nothing is deleted. Both legacy fields stay in the database, unread, for one
release, so a rollback loses no data.

- **`doNots`** → one `AgentRule` per sentence, `scope: "never"`,
  `source: "migrated_donots"`. Idempotent (skip if a rule with that `source`
  and text exists).
- **`businessInfo`** → the ambiguous one: it holds facts *and* instructions
  mixed. A one-time pass splits it — fact-shaped lines become `KnowledgeEntry`
  rows with `status: "draft"` (the existing awaiting-review state), and
  instruction-shaped lines become rules. It reports what it did so the owner
  can correct it.
- Runs per-org on first load of the new Training page, and is exposed in the
  founder admin panel so concierge onboarding can trigger it deliberately.

## 5a. Trial specifics (from a code read by whatsappcrm-a3, 2026-09-22)

- **The trial's tour step for Training is already broken.** `modules/trial/tour.ts`
  anchors its "train" step to `[data-tour="training-source"]`, which is rendered
  nowhere in `src/` — so the step silently falls back to the amber "This area is
  still loading" notice in `trial-tour.tsx`. This rework fixes it for free: put
  `data-tour="training-source"` on the **What it knows** section, matching the
  step's own copy ("These approved business facts are all your AI can use"). No
  change to `tour.ts` needed.
- **Rules get their own cap and must not touch the fact counter.** The trial caps
  facts at 50 (`factCount` = approved + draft) and
  `tests/trial-training.test.tsx` asserts the literal string `"Facts 0/50"`.
  Rules are counted separately: **5 active in the trial, 20 in the full app**.
- **Trial gating is unaffected by removing `/agent/setup`.** `setupComplete` is
  `Org.onboardedAt`, set by `modules/trial/activation.ts`; the trial's own
  `/trial/setup` already redirects to `/agent`. The checklist marks "teach" done
  from `workspace.knowledgeReady` (data-driven, no DOM coupling).
- **`tests/trial-training.test.tsx` pins the current trial UI** and will need
  rewriting when the fork is removed. It asserts literal copy ("Train AI",
  "Drafts to review", "Approved facts", "Add fact", "Facts 0/50", the
  `"e.g. Standard setup costs $120"` placeholder, "Test in Inbox" only when
  `approvedFactCount > 0`) and reads `agent/page.tsx` as text expecting
  `status: "active"`, `status: "draft"`, `workspace={trial}`, `drafts={`.
  Negative assertions to preserve: no `data-source-card`, nothing matching
  `/step 1|progress/i`, nothing matching `/clinic|patient/i`, no `/trial/setup`.
  **The new "Your business" section copy must therefore avoid the words
  clinic, patient, progress and step.**
- The same `buildAgentSystemPrompt` serves the trial (`modules/agent/reply.ts`)
  and voice (`modules/voice/initiation.ts`), so the founder's original bug
  reproduces identically in the trial — which is why the trial gets rules.

## 6. Out of scope

Rule priority conflicts beyond `order`; per-channel rules (WhatsApp vs voice);
scheduled rules ("only during Diwali"); dropping the legacy columns (a later,
separate migration); rewriting the questionnaire.

## 7. Risks

- `buildAgentSystemPrompt` answers live customers. Same blast radius as the
  follow-ups work; same review discipline.
- The Training page hosts the trial onboarding another session is building —
  coordinate before touching shared components.
- Rules outranking facts is powerful and deliberate: a badly worded rule can
  make the agent contradict its own knowledge. The cap, the length limit and
  the guardrail bound the damage; the owner can archive a rule instantly.
