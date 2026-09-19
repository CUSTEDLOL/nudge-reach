# AI Follow-ups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the builder-first Follow-ups page with AI-drafted follow-ups the owner creates from a sentence (or a one-click starter set), running on the existing automation engine with two missing pieces added — cancel-on-reply and a "conversation goes quiet" trigger.

**Architecture:** A pure `FollowUpSpec` (situation → messages → stop rule) is what the AI writes and the owner edits; a pure compiler turns it into an `Automation` + library `Template` rows exactly as the Revenue-Recovery pack installer does today. The engine gains `cancelWaitingRuns` (called at the four signal sites) and a `conversation_quiet` trigger evaluated on the cron tick. Drafting goes through `lib/model-router` with a deterministic keyless fallback so simulation mode works with zero keys. Design: `docs/plans/2026-09-19-ai-followups-design.md`.

**Tech Stack:** Next.js App Router + TypeScript, Prisma/Postgres (Supabase), zod, vitest, `lib/model-router` (Anthropic via `RUNTIME_MODEL`), Tailwind + `src/components/ui/*`.

---

## Before you start

- Read `AGENTS.md` (the seven invariants) and the design doc above.
- The working tree already holds **uncommitted** changes from the 2026-09-17/18 follow-ups + CRM work (`git status`). They are not yours to commit or discard. **Stage only the files named in each task's commit step.**
- Commands: `npx tsc --noEmit` (types), `npm run lint`, `npx vitest run <file>` (one file), `npm test` (all), `npm run build`. All four must be green at every commit.
- Tests mock Prisma with `vi.mock("@/lib/db", …)` + `vi.hoisted`; see `tests/followup-reminders.test.ts` for the pattern. Page tests assert on source text; see `tests/followups-page.test.ts`.
- Trigger vocabulary lives in `src/modules/automation/definitions.ts` (pure, no server imports — keep it that way). Step execution is `src/modules/automation/engine.ts`. Pack recipes are `src/modules/followup/pack.ts`; the installer is `src/modules/followup/install.ts`.

---

### Task 1: Schema — spec/source on Automation, CANCELLED run status

**Files:**
- Modify: `prisma/schema.prisma` (model `Automation` ~line 265, enum `AutomationRunStatus` ~line 296)

**Step 1: Edit the schema**

In `model Automation`, after `triggerConfig Json @default("{}")` add:

```prisma
  // The owner-facing follow-up spec this automation was compiled from (null for
  // hand-built ones). source: ai | pack | builder — a builder edit clears spec.
  spec          Json?
  source        String           @default("builder")
```

In `enum AutomationRunStatus` add `CANCELLED` after `FAILED`:

```prisma
enum AutomationRunStatus {
  RUNNING
  WAITING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Step 2: Regenerate the client and typecheck**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: no output (types still pass — the new fields are optional/defaulted).

**Step 3: Push the schema (founder step)**

Run: `npm run db:push && npm run db:rls`
Expected: `Your database is now in sync with your Prisma schema` then `Done: RLS enabled on 46 table(s)`.
This writes to the shared Supabase project; the founder authorised the previous push on 2026-09-18 — confirm with them before running if they are not the one executing this plan.

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(followups): store follow-up spec on automations, add CANCELLED run status"
```

---

### Task 2: The FollowUpSpec — pure schema, repairs, plain-English descriptions

**Files:**
- Create: `src/modules/followup/spec.ts`
- Test: `tests/followup-spec.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/followup-spec.test.ts
import { describe, expect, it } from "vitest";
import {
  describeMessageTiming,
  describeSituation,
  parseFollowUpSpec,
  shouldCancelOnSignal,
  STOP_SIGNALS,
} from "@/modules/followup/spec";

const quiet = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, happy to answer any questions.", footer: "" },
    { afterDays: 5, category: "MARKETING", header: "One last note", body: "Hi {{1}}, we're here whenever you're ready.", footer: "Reply STOP to unsubscribe" },
  ],
};

describe("parseFollowUpSpec", () => {
  it("accepts a valid spec and defaults stopOn to every signal", () => {
    const r = parseFollowUpSpec(quiet);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.stopOn).toEqual([...STOP_SIGNALS]);
  });

  it("repairs a marketing message: adds {{1}} and the STOP footer", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ afterDays: 0, category: "MARKETING", header: "Hello", body: "Thinking it over?", footer: "" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.messages[0].body.match(/\{\{1\}\}/g)).toHaveLength(1);
    expect(r.spec.messages[0].footer.toLowerCase()).toContain("stop");
  });

  it("leaves a UTILITY footer alone", () => {
    const r = parseFollowUpSpec({
      name: "Booking thanks",
      situation: { kind: "booked" },
      messages: [{ afterDays: 0, category: "UTILITY", header: "Booked", body: "Hi {{1}}, you're booked.", footer: "" }],
    });
    expect(r.ok && r.spec.messages[0].footer).toBe("");
  });

  it("rejects an unknown situation or a gap over 14 days", () => {
    expect(parseFollowUpSpec({ ...quiet, situation: { kind: "birthday" } }).ok).toBe(false);
    expect(
      parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], afterDays: 15 }] }).ok
    ).toBe(false);
  });

  it("forces the first message of a went_quiet spec to send immediately", () => {
    const r = parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], afterDays: 3 }] });
    expect(r.ok && r.spec.messages[0].afterDays).toBe(0);
  });

  it("rejects an over-long body instead of truncating it after the {{1}} repair", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], body: `Hi {{1}}, ${"x".repeat(600)}` }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.startsWith("messages.0.body")).toBe(true);
  });

  it("drops unknown stopOn entries instead of rejecting the spec", () => {
    const r = parseFollowUpSpec({ ...quiet, stopOn: ["reply", "opt_out", "nonsense"] });
    expect(r.ok && r.spec.stopOn).toEqual(["reply"]);
  });

  it("cuts a 70-character header to 60", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], header: "h".repeat(70) }],
    });
    expect(r.ok && r.spec.messages[0].header).toHaveLength(60);
  });

  it("never strands a surrogate when cutting a header on an emoji", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], header: `${"A".repeat(59)}😀 tail` }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.messages[0].header.isWellFormed()).toBe(true);
    expect(r.spec.messages[0].header.length).toBeLessThanOrEqual(60);
  });
});

describe("plain-English descriptions", () => {
  it("describes each situation for the card", () => {
    expect(describeSituation({ kind: "went_quiet", afterDays: 2 })).toBe(
      "When someone shows interest, then goes quiet for 2 days"
    );
    expect(describeSituation({ kind: "went_quiet", afterDays: 1, stage: "QUALIFIED" })).toBe(
      "When a qualified lead goes quiet for 1 day"
    );
    expect(describeSituation({ kind: "booked" })).toBe("When someone books an appointment");
    expect(describeSituation({ kind: "keyword", keywords: ["price", "cost"] })).toBe(
      'When a message contains "price" or "cost"'
    );
    expect(describeSituation({ kind: "new_lead" })).toBe("When someone messages for the first time");
    expect(describeSituation({ kind: "campaign_reply" })).toBe("When someone replies to a campaign");
  });

  it("describes message timing relative to the previous message", () => {
    expect(describeMessageTiming(0, 0)).toBe("Right away");
    expect(describeMessageTiming(0, 2)).toBe("2 days later");
    expect(describeMessageTiming(1, 1)).toBe("Then 1 day later");
    expect(describeMessageTiming(1, 0)).toBe("Then right away");
  });
});

describe("shouldCancelOnSignal", () => {
  it("always cancels on a reply or an opt-out, whatever the spec says", () => {
    expect(shouldCancelOnSignal({ stopOn: ["booking"] }, "reply")).toBe(true);
    expect(shouldCancelOnSignal({ stopOn: [] }, "opt_out")).toBe(true);
  });
  it("honours stopOn for booking and payment, defaulting to cancel when there is no spec", () => {
    expect(shouldCancelOnSignal({ stopOn: ["reply"] }, "booking")).toBe(false);
    expect(shouldCancelOnSignal({ stopOn: ["reply", "payment"] }, "payment")).toBe(true);
    expect(shouldCancelOnSignal(null, "booking")).toBe(true);
    expect(shouldCancelOnSignal("garbage", "payment")).toBe(true);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-spec.test.ts`
Expected: FAIL — `Cannot find module '@/modules/followup/spec'`.

**Step 3: Implement**

```ts
// src/modules/followup/spec.ts
import { z } from "zod";
import { LEAD_STAGES } from "@/modules/automation/definitions";
import { campaignButtonSchema } from "@/modules/campaign/schema";
import { repairOptOutFooter, repairPersonalization } from "@/modules/campaign/guardrails";

/**
 * The owner-facing shape of a follow-up: what situation starts it, which
 * messages go out and when, and what makes it stop. The AI writes this, the
 * owner edits it, and `compile.ts` turns it into an automation + templates.
 * Pure (zod + string helpers) so it is shared by server, client and tests.
 */

export const MAX_MESSAGES = 3;
/** Longest gap between two messages; longer schedules belong to the booking
 *  reminder tick, not chained waits. */
export const MAX_GAP_DAYS = 14;

export const STOP_SIGNALS = ["reply", "booking", "payment"] as const;
export type StopSignal = (typeof STOP_SIGNALS)[number];
/** Everything that can end a pending chase; opt_out is never optional. */
export type CancelSignal = StopSignal | "opt_out";

export const situationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("went_quiet"),
    afterDays: z.number().int().min(1).max(MAX_GAP_DAYS),
    stage: z.enum(LEAD_STAGES).optional(),
  }),
  z.object({ kind: z.literal("booked") }),
  z.object({ kind: z.literal("campaign_reply") }),
  z.object({
    kind: z.literal("keyword"),
    keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  }),
  z.object({ kind: z.literal("new_lead") }),
]);

export const specMessageSchema = z.object({
  /** Days after the previous message (or after the situation, for the first). */
  afterDays: z.number().int().min(0).max(MAX_GAP_DAYS),
  category: z.enum(["MARKETING", "UTILITY"]),
  header: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(600),
  footer: z.string().trim().max(60).default(""),
  buttons: z.array(campaignButtonSchema).max(3).default([]),
});

export const followUpSpecSchema = z.object({
  name: z.string().trim().min(1).max(80),
  situation: situationSchema,
  messages: z.array(specMessageSchema).min(1).max(MAX_MESSAGES),
  stopOn: z.array(z.enum(STOP_SIGNALS)).default([...STOP_SIGNALS]),
});

export type FollowUpSpec = z.infer<typeof followUpSpecSchema>;
export type FollowUpSituation = FollowUpSpec["situation"];
export type SpecMessage = FollowUpSpec["messages"][number];

export type SpecParseResult =
  | { ok: true; spec: FollowUpSpec }
  | { ok: false; error: string };

/**
 * Validate + repair a raw spec (from the model or the edit form). Repairs:
 * `{{1}}` exactly once in each body, a STOP footer on MARKETING messages,
 * headers cut to 60 chars, unknown `stopOn` entries dropped. Bodies are never
 * truncated — a cut after the `{{1}}` repair could strip the variable — so an
 * over-long body is rejected with a clear error instead.
 * A went_quiet spec's first message always sends the moment the trigger
 * fires — the delay already lives in `afterDays` on the situation.
 */
export function parseFollowUpSpec(raw: unknown): SpecParseResult {
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (Array.isArray(candidate.messages)) {
    candidate.messages = candidate.messages.map((m) => {
      const msg = m && typeof m === "object" ? { ...(m as Record<string, unknown>) } : {};
      if (typeof msg.body === "string") msg.body = repairPersonalization(msg.body);
      if (msg.category === "MARKETING") {
        msg.footer = repairOptOutFooter(typeof msg.footer === "string" ? msg.footer : "");
      }
      if (typeof msg.header === "string") {
        // Never strand a high surrogate: an emoji split at 59/60 serialises
        // as a lone \uD83D, which Postgres jsonb refuses to store.
        msg.header = msg.header.slice(0, 60).replace(/[\uD800-\uDBFF]$/, "");
      }
      return msg;
    });
  }
  if (Array.isArray(candidate.stopOn)) {
    candidate.stopOn = candidate.stopOn.filter((s) => (STOP_SIGNALS as readonly unknown[]).includes(s));
  }
  const parsed = followUpSpecSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".") || "spec"}: ${issue.message}` : "That follow-up isn't valid.",
    };
  }
  const spec = parsed.data;
  if (spec.situation.kind === "went_quiet" && spec.messages[0].afterDays !== 0) {
    spec.messages[0] = { ...spec.messages[0], afterDays: 0 };
  }
  return { ok: true, spec };
}

function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** One sentence the card leads with. */
export function describeSituation(s: FollowUpSituation): string {
  switch (s.kind) {
    case "went_quiet":
      return s.stage
        ? `When a ${s.stage.toLowerCase()} lead goes quiet for ${days(s.afterDays)}`
        : `When someone shows interest, then goes quiet for ${days(s.afterDays)}`;
    case "booked":
      return "When someone books an appointment";
    case "campaign_reply":
      return "When someone replies to a campaign";
    case "keyword":
      return `When a message contains ${s.keywords.map((k) => `"${k}"`).join(" or ")}`;
    case "new_lead":
      return "When someone messages for the first time";
  }
}

/** "Right away" / "2 days later" / "Then 1 day later" for message `index`. */
export function describeMessageTiming(index: number, afterDays: number): string {
  if (index === 0) return afterDays === 0 ? "Right away" : `${days(afterDays)} later`;
  return afterDays === 0 ? "Then right away" : `Then ${days(afterDays)} later`;
}

/** Built once: the engine checks this per waiting run on every inbound. */
const stopOnSchema = followUpSpecSchema.pick({ stopOn: true });

/**
 * Does this signal end a pending chase? A reply or an opt-out always does —
 * the customer is talking to us, or told us to stop. Booking and payment are
 * the owner's choice via stopOn; an automation with no spec (hand-built)
 * takes the safe default and cancels on everything.
 */
export function shouldCancelOnSignal(rawSpec: unknown, signal: CancelSignal): boolean {
  if (signal === "reply" || signal === "opt_out") return true;
  const parsed = stopOnSchema.safeParse(rawSpec);
  if (!parsed.success) return true;
  return parsed.data.stopOn.includes(signal);
}
```

**Step 4: Run to verify it passes**

Run: `npx vitest run tests/followup-spec.test.ts`
Expected: PASS, 13 tests.

**Step 5: Commit**

```bash
git add src/modules/followup/spec.ts tests/followup-spec.test.ts
git commit -m "feat(followups): owner-facing FollowUpSpec with repairs and plain-English descriptions"
```

---

### Task 3: The `conversation_quiet` trigger vocabulary

**Files:**
- Modify: `src/modules/automation/definitions.ts:7-46`
- Modify: `src/app/(app)/automations/meta.ts` (TRIGGER_DETAILS, ~line 42-73)
- Test: `tests/automation.test.ts` (append)

**Step 1: Write the failing test** — append to `tests/automation.test.ts`:

```ts
import { AUTOMATION_TRIGGERS, MAX_QUIET_HOURS, parseQuietConfig } from "@/modules/automation/definitions";
import { MAX_GAP_DAYS } from "@/modules/followup/spec";

describe("conversation_quiet trigger", () => {
  it("is part of the vocabulary", () => {
    expect(AUTOMATION_TRIGGERS).toContain("conversation_quiet");
  });

  it("parses hours + optional stage, defaulting to 72h and clamping to a fortnight", () => {
    expect(parseQuietConfig({ hours: 48, stage: "QUALIFIED" })).toEqual({ hours: 48, stage: "QUALIFIED" });
    expect(parseQuietConfig({})).toEqual({ hours: 72, stage: undefined });
    expect(parseQuietConfig({ hours: 0 })).toEqual({ hours: 72, stage: undefined });
    expect(parseQuietConfig({ hours: 1.4 })).toEqual({ hours: 1, stage: undefined });
    expect(parseQuietConfig({ hours: 9999, stage: "nonsense" })).toEqual({ hours: 14 * 24, stage: undefined });
    expect(parseQuietConfig(null)).toEqual({ hours: 72, stage: undefined });
  });

  it("holds the 1h floor and the fortnight cap at the boundaries", () => {
    expect(parseQuietConfig({ hours: 1 }).hours).toBe(1);
    expect(parseQuietConfig({ hours: 336 }).hours).toBe(336);
    expect(parseQuietConfig({ hours: 337 }).hours).toBe(336);
    expect(parseQuietConfig({ hours: "abc" }).hours).toBe(72);
    expect(parseQuietConfig({ hours: -5 }).hours).toBe(72);
  });

  it("only accepts a stage that is a string from LEAD_STAGES", () => {
    expect(parseQuietConfig({ stage: ["QUALIFIED"] }).stage).toBeUndefined();
  });

  it("keeps the follow-up spec's day cap equal to the trigger's hour cap", () => {
    expect(MAX_GAP_DAYS * 24).toBe(MAX_QUIET_HOURS);
  });
});
```

(`describe`/`it`/`expect` are already imported at the top of that file; add `parseQuietConfig` and `AUTOMATION_TRIGGERS` to the existing import from definitions instead of a second import line.)

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/automation.test.ts`
Expected: FAIL — `parseQuietConfig` is not exported.

**Step 3: Implement**

In `definitions.ts`, add `"conversation_quiet"` to `AUTOMATION_TRIGGERS` (after `"booking_created"`), add to `TRIGGER_LABELS`:

```ts
  conversation_quiet: "Conversation goes quiet",
```

and append after `readWaitMinutes`:

```ts
// ---------------------------------------------------------------------------
// Quiet-conversation trigger config (pure)
// ---------------------------------------------------------------------------

export const DEFAULT_QUIET_HOURS = 72;
export const MAX_QUIET_HOURS = 14 * 24;

export interface QuietConfig {
  /** Hours since the customer's last message. */
  hours: number;
  /** Only chase contacts at this lead stage, when set. */
  stage?: (typeof LEAD_STAGES)[number];
}

/**
 * Coerce a triggerConfig blob into a safe QuietConfig. An unrecognised stage
 * is ignored (chases every stage); sub-1 or non-numeric hours fall back to the
 * 72h default rather than a 1h floor.
 */
export function parseQuietConfig(raw: unknown): QuietConfig {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const hours = Number(obj.hours);
  const stage =
    typeof obj.stage === "string" && (LEAD_STAGES as readonly string[]).includes(obj.stage)
      ? (obj.stage as QuietConfig["stage"])
      : undefined;
  return {
    hours: Number.isFinite(hours) && hours >= 1 ? Math.min(Math.round(hours), MAX_QUIET_HOURS) : DEFAULT_QUIET_HOURS,
    stage,
  };
}
```

In `meta.ts`, import `Hourglass` from `lucide-react` and add to `TRIGGER_DETAILS`:

```ts
  conversation_quiet: {
    description: "A customer who messaged you has gone quiet for a while.",
    icon: Hourglass,
    tone: "warning",
  },
```

**Step 4: Verify**

Run: `npx vitest run tests/automation.test.ts && npx tsc --noEmit`
Expected: PASS; tsc silent. (`TRIGGER_DETAILS` is a `Record<AutomationTrigger, …>`, so tsc is what catches a missing meta entry.)

**Step 5: Commit**

```bash
git add src/modules/automation/definitions.ts "src/app/(app)/automations/meta.ts" tests/automation.test.ts
git commit -m "feat(automations): conversation_quiet trigger vocabulary"
```

**Follow-up (review of the vocabulary commit).** Three things ride in a second commit on this task. (1) `parseQuietConfig` type-checks `stage` (`typeof obj.stage === "string"`) before the `LEAD_STAGES` lookup — the first cut compared `String(obj.stage)` but returned the raw value, so an array like `["QUALIFIED"]` came back typed as a stage literal and would have rejected the whole cron step once it reached a Prisma `where`. (2) The edit page `src/app/(app)/automations/[id]/page.tsx` resolved the stored trigger against a hard-coded five-item list that pre-dated `booking_created`; any newer trigger fell back to `message_received` and a save persisted that — a quiet-lead chase silently became an every-inbound-message send. It now resolves against `AUTOMATION_TRIGGERS` and passes `preservedQuiet` (the parsed `{ hours, stage }`) into the builder, which shows it as a read-only hint next to the trigger picker, mirroring `preservedTagName`; the timing itself is edited from the follow-up card (Task 8), not here. (3) `MAX_GAP_DAYS` in `spec.ts` is derived as `MAX_QUIET_HOURS / 24` (still 14) so the spec's day cap and the trigger's hour cap cannot drift; a test pins the identity.

---

### Task 4: The compiler — spec → trigger + steps + templates

**Files:**
- Create: `src/modules/followup/compile.ts`
- Test: `tests/followup-compile.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/followup-compile.test.ts
import { describe, expect, it } from "vitest";
import { compileFollowUp, slugify, waitChunksMinutes, type CompiledStep } from "@/modules/followup/compile";
import { repairOptOutFooter } from "@/modules/campaign/guardrails";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { MAX_WAIT_MINUTES } from "@/modules/automation/definitions";
import type { FollowUpSpec } from "@/modules/followup/spec";

const spec: FollowUpSpec = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2, stage: "QUALIFIED" },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [] },
    { afterDays: 10, category: "MARKETING", header: "One last note", body: "Hi {{1}}, here when you're ready.", footer: "Reply STOP to unsubscribe", buttons: [] },
  ],
  stopOn: ["reply", "booking", "payment"],
};

const isWait = (s: CompiledStep): s is Extract<CompiledStep, { kind: "wait" }> => s.kind === "wait";
const isSend = (s: CompiledStep): s is Extract<CompiledStep, { kind: "send_template" }> =>
  s.kind === "send_template";

describe("compileFollowUp", () => {
  const out = compileFollowUp(spec);

  it("maps the situation onto an engine trigger", () => {
    expect(out.trigger).toBe("conversation_quiet");
    expect(out.triggerConfig).toEqual({ hours: 48, stage: "QUALIFIED" });
    expect(compileFollowUp({ ...spec, situation: { kind: "booked" } }).trigger).toBe("booking_created");
    expect(compileFollowUp({ ...spec, situation: { kind: "campaign_reply" } }).trigger).toBe("campaign_reply");
    expect(compileFollowUp({ ...spec, situation: { kind: "new_lead" } }).trigger).toBe("contact_created");
    expect(compileFollowUp({ ...spec, situation: { kind: "keyword", keywords: ["Price"] } })).toMatchObject({
      trigger: "keyword",
      triggerConfig: { keywords: ["Price"], match: "contains" },
    });
  });

  it("emits only wait and send_template steps, in order, chunking waits at the engine clamp", () => {
    expect(out.steps.map((s) => s.kind)).toEqual(["send_template", "wait", "wait", "send_template"]);
    const waits = out.steps.filter(isWait).map((s) => s.config.minutes);
    expect(waits).toEqual([7 * 1440, 3 * 1440]);
    for (const w of waits) expect(w).toBeLessThanOrEqual(MAX_WAIT_MINUTES);
    expect(out.steps.some((s) => (s.kind as string) === "send_message")).toBe(false);
  });

  it("produces one valid, Meta-safe library template per message", () => {
    expect(out.templates.map((t) => t.name)).toEqual(["fu_pricing_chase_1", "fu_pricing_chase_2"]);
    for (const t of out.templates) {
      // Meta template names: lowercase letters, digits, underscores, ≤512 chars.
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      expect(t.name.length).toBeLessThanOrEqual(512);
      expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
      expect(t.content.body.match(/\{\{1\}\}/g)).toHaveLength(1);
    }
    expect(out.steps.filter(isSend).map((s) => s.config.templateName)).toEqual(["fu_pricing_chase_1", "fu_pricing_chase_2"]);
  });

  it("names templates per automation when a key is given", () => {
    const a = compileFollowUp(spec, { key: "abc123" }).templates.map((t) => t.name);
    const b = compileFollowUp(spec, { key: "def456" }).templates.map((t) => t.name);
    expect(a).toEqual(["fu_pricing_chase_abc123_1", "fu_pricing_chase_abc123_2"]);
    expect(a.filter((n) => b.includes(n))).toEqual([]);
  });

  it("lets the caller pin template names (the pack keeps its historical names)", () => {
    const pinned = compileFollowUp(spec, { templateNames: ["lead_nudge_1", "lead_nudge_2"] });
    expect(pinned.templates.map((t) => t.name)).toEqual(["lead_nudge_1", "lead_nudge_2"]);
  });

  it("pins per index: unpinned positions and empty pins fall through to the derived name", () => {
    const three: FollowUpSpec = {
      ...spec,
      messages: [
        ...spec.messages,
        { afterDays: 3, category: "MARKETING", header: "Last call", body: "Hi {{1}}, closing the loop.", footer: "Reply STOP to unsubscribe", buttons: [] },
      ],
    };
    const partial = compileFollowUp(three, { templateNames: ["lead_nudge_1", "lead_nudge_2"], key: "k1" });
    expect(partial.templates.map((t) => t.name)).toEqual(["lead_nudge_1", "lead_nudge_2", "fu_pricing_chase_k1_3"]);
    const empty = compileFollowUp(spec, { templateNames: [""] });
    expect(empty.templates.map((t) => t.name)).toEqual(["fu_pricing_chase_1", "fu_pricing_chase_2"]);
  });

  it("distinguishes messages by productName only when there is more than one", () => {
    expect(out.templates.map((t) => t.content.productName)).toEqual([
      "Pricing chase — message 1",
      "Pricing chase — message 2",
    ]);
    const single = compileFollowUp({ ...spec, messages: [spec.messages[0]] });
    expect(single.templates[0].content.productName).toBe("Pricing chase");
    for (const t of compileFollowUp({ ...spec, name: "x".repeat(80) }).templates) {
      expect(t.content.productName.length).toBeLessThanOrEqual(120);
      expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
    }
  });

  it("applies the one STOP-footer rule to MARKETING messages", () => {
    const [noStop, blank] = compileFollowUp({
      ...spec,
      messages: [
        { ...spec.messages[0], footer: "Open 9-6" },
        { ...spec.messages[1], footer: "" },
      ],
    }).templates;
    expect(noStop.content.footer).toBe(repairOptOutFooter("Open 9-6"));
    expect(noStop.content.footer).toMatch(/\bSTOP\b/);
    expect(blank.content.footer).toBe(repairOptOutFooter(""));
    expect(blank.content.footer).toMatch(/\bSTOP\b/);
  });

  it("gives a UTILITY message with no footer a non-empty one (campaignContentSchema requires it)", () => {
    const utility = compileFollowUp({
      ...spec,
      situation: { kind: "booked" },
      messages: [
        { afterDays: 1, category: "UTILITY", header: "See you tomorrow", body: "Hi {{1}}, your appointment is tomorrow.", footer: "", buttons: [] },
      ],
    });
    expect(utility.templates).toHaveLength(1);
    const [t] = utility.templates;
    expect(t.category).toBe("UTILITY");
    expect(t.content.footer.length).toBeGreaterThan(0);
    expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
  });

  it("passes buttons through unchanged", () => {
    const button = { type: "QUICK_REPLY" as const, text: "Book now" };
    const withButton = compileFollowUp({ ...spec, messages: [{ ...spec.messages[0], buttons: [button] }] });
    expect(withButton.templates[0].content.buttons).toEqual([button]);
  });

  it("falls back to the follow_up slug when the name slugifies to nothing", () => {
    const punct = compileFollowUp({ ...spec, name: "!!!" });
    expect(punct.templates.map((t) => t.name)).toEqual(["fu_follow_up_1", "fu_follow_up_2"]);
  });
});

describe("helpers", () => {
  it("slugify is lowercase, underscore-joined and capped", () => {
    expect(slugify("Post-consult check in!")).toBe("post_consult_check_in");
    expect(slugify("x".repeat(80))).toHaveLength(40);
  });
  it("waitChunksMinutes splits days into ≤7-day waits", () => {
    expect(waitChunksMinutes(0)).toEqual([]);
    expect(waitChunksMinutes(7)).toEqual([7 * 1440]);
    expect(waitChunksMinutes(14)).toEqual([7 * 1440, 7 * 1440]);
  });
  it("waitChunksMinutes derives its chunk size from the engine's wait clamp", () => {
    expect(waitChunksMinutes(8)).toEqual([MAX_WAIT_MINUTES, 1440]);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-compile.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement**

```ts
// src/modules/followup/compile.ts
import { MAX_WAIT_MINUTES, type AutomationTrigger } from "@/modules/automation/definitions";
import { repairOptOutFooter } from "@/modules/campaign/guardrails";
import type { CampaignContent } from "@/modules/campaign/schema";
import type { FollowUpSpec } from "@/modules/followup/spec";

/**
 * Spec → the pieces the automation engine already runs. Pure and total: the
 * only step kinds it can emit are `wait` and `send_template`, so a follow-up
 * can never send free-form text outside the 24-hour window (invariant #6) —
 * the guarantee is in the type of this function, not in a review.
 */

const MINUTES_PER_DAY = 24 * 60;
/** One wait step per chunk, sized by the engine's clamp so a longer gap is
 *  chained rather than silently truncated. */
const MAX_WAIT_DAYS = MAX_WAIT_MINUTES / MINUTES_PER_DAY;

export type CompiledStep =
  | { kind: "wait"; config: { minutes: number } }
  | { kind: "send_template"; config: { templateName: string } };

export interface CompiledTemplate {
  name: string;
  category: "MARKETING" | "UTILITY";
  content: CampaignContent;
}

export interface CompiledFollowUp {
  trigger: AutomationTrigger;
  triggerConfig: Record<string, unknown>;
  templates: CompiledTemplate[];
  /** send_template steps carry `templateName`; the installer swaps in the id. */
  steps: CompiledStep[];
}

/** Like `slugifyTemplateName` (whatsapp/template.ts) but capped at 40 so a
 *  key and index still fit after it; the empty-slug fallback is the caller's. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function waitChunksMinutes(days: number): number[] {
  const out: number[] = [];
  let remaining = days;
  while (remaining > 0) {
    const chunk = Math.min(remaining, MAX_WAIT_DAYS);
    out.push(chunk * MINUTES_PER_DAY);
    remaining -= chunk;
  }
  return out;
}

function triggerFor(situation: FollowUpSpec["situation"]): Pick<CompiledFollowUp, "trigger" | "triggerConfig"> {
  switch (situation.kind) {
    case "went_quiet":
      return {
        trigger: "conversation_quiet",
        triggerConfig: { hours: situation.afterDays * 24, ...(situation.stage ? { stage: situation.stage } : {}) },
      };
    case "booked":
      return { trigger: "booking_created", triggerConfig: {} };
    case "campaign_reply":
      return { trigger: "campaign_reply", triggerConfig: {} };
    case "keyword":
      return { trigger: "keyword", triggerConfig: { keywords: situation.keywords, match: "contains" } };
    case "new_lead":
      return { trigger: "contact_created", triggerConfig: {} };
  }
}

/**
 * Template names are deterministic for a spec, and per-automation when `key`
 * is given (`fu_<slug>_<key>_<n>`; the installer passes the automation id's
 * last 8 chars) so two follow-ups with the same name never share templates.
 * `templateNames` pins a name per index and wins over the derived one; an
 * empty pin falls through.
 */
export function compileFollowUp(
  spec: FollowUpSpec,
  opts: { templateNames?: string[]; key?: string } = {}
): CompiledFollowUp {
  const slug = slugify(spec.name) || "follow_up";
  const keySlug = opts.key ? slugify(opts.key) : "";
  const templates: CompiledTemplate[] = [];
  const steps: CompiledStep[] = [];

  spec.messages.forEach((m, i) => {
    const derived = keySlug ? `fu_${slug}_${keySlug}_${i + 1}` : `fu_${slug}_${i + 1}`;
    const name = opts.templateNames?.[i] || derived;
    templates.push({
      name,
      category: m.category,
      content: {
        productName: spec.messages.length > 1 ? `${spec.name} — message ${i + 1}` : spec.name,
        campaignAngle: "Follow-up.",
        header: m.header,
        body: m.body,
        // buildTemplatePayload always emits a FOOTER component, so it must be non-empty.
        footer: m.category === "MARKETING" ? repairOptOutFooter(m.footer) : m.footer || "See you soon",
        buttons: m.buttons,
        sampleName: "Priya",
        imageTreatment: "",
        notes: "Created from a follow-up.",
      },
    });
    for (const minutes of waitChunksMinutes(m.afterDays)) steps.push({ kind: "wait", config: { minutes } });
    steps.push({ kind: "send_template", config: { templateName: name } });
  });

  return { ...triggerFor(spec.situation), templates, steps };
}
```

Note: `campaignContentSchema` requires a non-empty footer, hence the fallback footer for UTILITY messages.

**Step 4: Verify**

Run: `npx vitest run tests/followup-compile.test.ts`
Expected: PASS, 14 tests.

**Step 5: Commit**

```bash
git add src/modules/followup/compile.ts tests/followup-compile.test.ts docs/plans/2026-09-19-ai-followups.md
git commit -m "feat(followups): compile a FollowUpSpec into engine steps and library templates"
```

---

### Task 5: Installer — save a compiled spec; the pack goes through it

**Files:**
- Modify: `src/modules/followup/install.ts` (whole file — see below)
- Modify: `src/modules/followup/pack.ts` (replace `leadNudgeAutomation` with `PACK_LEAD_NUDGE_SPEC`; drop `leadNudge` from `FOLLOW_UP_FLAGS`/`FOLLOW_UP_KINDS`)
- Modify: `tests/followup-pack.test.ts`

**Step 1: Update the pack tests**

Replace the `describe("lead-nudge automation …")` block with:

```ts
describe("pack quiet-lead nudge (a spec, like every other follow-up)", () => {
  it("chases once after 3 quiet days, then once more 3 days later, and stops on any signal", () => {
    expect(PACK_LEAD_NUDGE_SPEC.situation).toEqual({ kind: "went_quiet", afterDays: 3 });
    expect(PACK_LEAD_NUDGE_SPEC.messages.map((m) => m.afterDays)).toEqual([0, 3]);
    expect(PACK_LEAD_NUDGE_SPEC.stopOn).toEqual(["reply", "booking", "payment"]);
    expect(parseFollowUpSpec(PACK_LEAD_NUDGE_SPEC).ok).toBe(true);
  });

  it("compiles onto the historical lead_nudge template names", () => {
    const out = compileFollowUp(PACK_LEAD_NUDGE_SPEC, { templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES });
    expect(out.trigger).toBe("conversation_quiet");
    expect(out.templates.map((t) => t.name)).toEqual(["lead_nudge_1", "lead_nudge_2"]);
  });
});
```

Change the "owner-facing follow-up rows" test so the quiet nudge is no longer expected as a row:

```ts
  it("surfaces every tick-driven pack template; the nudge lives on its own card", () => {
    const listed = FOLLOW_UP_KINDS.flatMap((k) => k.templateNames).sort();
    const nudge = PACK_LEAD_NUDGE_TEMPLATE_NAMES;
    expect([...listed, ...nudge].sort()).toEqual(PACK_TEMPLATES.map((t) => t.name).sort());
  });
```

Update the import at the top: remove `leadNudgeAutomation`; add `PACK_LEAD_NUDGE_SPEC, PACK_LEAD_NUDGE_TEMPLATE_NAMES` from pack, `parseFollowUpSpec` from `@/modules/followup/spec`, `compileFollowUp` from `@/modules/followup/compile`.

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-pack.test.ts`
Expected: FAIL — `PACK_LEAD_NUDGE_SPEC` not exported.

**Step 3: Implement — pack.ts**

Remove the `leadNudgeAutomation` function, `PackAutomation` interface and `THREE_DAYS_MIN`. Remove `"leadNudge"` from `FOLLOW_UP_FLAGS` and delete the `leadNudge` entry from `FOLLOW_UP_KINDS` (and the `editableInBuilder` field from the interface — nothing uses it now). Append:

```ts
import type { FollowUpSpec } from "@/modules/followup/spec";

export const PACK_LEAD_NUDGE_TEMPLATE_NAMES = ["lead_nudge_1", "lead_nudge_2"];

/** The quiet-lead chase, as a spec: same object an AI draft or the owner's
 *  own follow-up is, so it gets cancel-on-reply and the card UI for free. */
export const PACK_LEAD_NUDGE_SPEC: FollowUpSpec = {
  name: "Quiet-lead nudge",
  situation: { kind: "went_quiet", afterDays: 3 },
  messages: PACK_TEMPLATES.filter((t) => PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name)).map((t, i) => ({
    afterDays: i === 0 ? 0 : 3,
    category: t.category,
    header: t.content.header,
    body: t.content.body,
    footer: t.content.footer,
    buttons: t.content.buttons,
  })),
  stopOn: ["reply", "booking", "payment"],
};
```

(Put the `import type` at the top of the file with the other imports.)

**Step 4: Implement — install.ts**

Rewrite the file:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import {
  PACK_TEMPLATES,
  PACK_LEAD_NUDGE_SPEC,
  PACK_LEAD_NUDGE_TEMPLATE_NAMES,
  normalizeTiming,
  type FollowUpFlag,
  type FollowUpTiming,
} from "@/modules/followup/pack";
import { compileFollowUp, type CompiledTemplate } from "@/modules/followup/compile";
import type { FollowUpSpec } from "@/modules/followup/spec";

/** The installed automation's name is its identity — matching on it keeps the
 *  install idempotent, so renaming it would orphan every existing install. */
export const LEAD_NUDGE_NAME = "Revenue Recovery — quiet-lead nudge";

export type FollowUpSource = "ai" | "pack" | "builder";

/** Create/refresh library templates by name. Test mode approves them
 *  immediately (so the demo works); live submits each to Meta for review and
 *  records a refusal on the row so the owner can fix and resubmit. Edited
 *  copy on an existing row goes back through approval. */
export async function ensureLibraryTemplates(
  orgId: string,
  templates: CompiledTemplate[]
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of templates) {
    const componentsJson = buildTemplatePayload(t.content, { name: t.name }) as Prisma.InputJsonValue;
    const content = t.content as unknown as Prisma.InputJsonValue;
    const existing = await prisma.template.findFirst({ where: { orgId, name: t.name, campaignId: null } });
    const unchanged = existing && JSON.stringify(existing.content) === JSON.stringify(t.content);
    const data = {
      language: "en",
      category: t.category,
      content,
      componentsJson,
      metaStatus: approve ? ("APPROVED" as const) : unchanged ? existing.metaStatus : ("PENDING" as const),
      metaTemplateId: approve ? `sim-tpl-${t.name}` : unchanged ? existing.metaTemplateId : null,
    };
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({ data: { orgId, campaignId: null, name: t.name, ...data } });
    if (!approve && row.metaStatus !== "APPROVED") {
      await submitRowToMeta(orgId, row).catch((err: unknown) =>
        prisma.template.update({
          where: { id: row.id },
          data: {
            metaStatus: "REJECTED",
            rejectionReason: err instanceof Error ? err.message : "Couldn't submit to Meta.",
          },
        })
      );
    }
    byName.set(t.name, row.id);
  }
  return byName;
}

/**
 * Persist a spec as an automation + its templates. Creates when `automationId`
 * is absent (always OFF — a human switches it on), otherwise replaces the
 * steps and re-stores the spec, keeping the current enabled state.
 */
export async function saveFollowUpFromSpec(opts: {
  orgId: string;
  spec: FollowUpSpec;
  source: FollowUpSource;
  automationId?: string;
  name?: string;
  templateNames?: string[];
}): Promise<{ id: string }> {
  const compiled = compileFollowUp(opts.spec, { templateNames: opts.templateNames });
  const ids = await ensureLibraryTemplates(opts.orgId, compiled.templates);
  const stepsCreate = compiled.steps.map((s, i) => ({
    order: i + 1,
    kind: s.kind,
    config: (s.kind === "send_template"
      ? { templateId: ids.get(String(s.config.templateName)) }
      : s.config) as Prisma.InputJsonValue,
  }));
  const data = {
    name: opts.name ?? opts.spec.name,
    description: opts.spec.messages.length > 1 ? `${opts.spec.messages.length} messages` : "1 message",
    trigger: compiled.trigger,
    triggerConfig: compiled.triggerConfig as Prisma.InputJsonValue,
    spec: opts.spec as unknown as Prisma.InputJsonValue,
    source: opts.source,
  };

  if (opts.automationId) {
    await prisma.$transaction([
      prisma.automationStep.deleteMany({ where: { automationId: opts.automationId } }),
      prisma.automation.update({
        where: { id: opts.automationId },
        data: { ...data, steps: { create: stepsCreate } },
      }),
    ]);
    return { id: opts.automationId };
  }
  const created = await prisma.automation.create({
    data: { orgId: opts.orgId, enabled: false, ...data, steps: { create: stepsCreate } },
    select: { id: true },
  });
  return created;
}

/**
 * One-toggle install of the Revenue-Recovery pack for an org: the tick-driven
 * templates + the quiet-lead nudge (as a spec) + an enabled FollowUpConfig.
 * Idempotent (upsert by name), so re-running is safe.
 */
export async function installRevenueRecoveryPack(orgId: string): Promise<void> {
  const tickTemplates = PACK_TEMPLATES.filter((t) => !PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name));
  await ensureLibraryTemplates(orgId, tickTemplates);

  const existing = await prisma.automation.findFirst({ where: { orgId, name: LEAD_NUDGE_NAME } });
  await saveFollowUpFromSpec({
    orgId,
    spec: PACK_LEAD_NUDGE_SPEC,
    source: "pack",
    name: LEAD_NUDGE_NAME,
    automationId: existing?.id,
    templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES,
  });
  // The pack's nudge is the one follow-up that starts ON: it is the moat the
  // plan is sold on, and its copy was written and reviewed by us.
  await prisma.automation.updateMany({ where: { orgId, name: LEAD_NUDGE_NAME }, data: { enabled: true } });

  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true },
    update: { enabled: true },
  });
}

/** Flip the whole pack on/off (config + the lead-nudge automation together). */
export async function setFollowUpEnabled(orgId: string, enabled: boolean): Promise<void> {
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled },
    update: { enabled },
  });
  await prisma.automation.updateMany({ where: { orgId, name: LEAD_NUDGE_NAME }, data: { enabled } });
}

/** Flip ONE tick-driven follow-up on/off, leaving the rest running. */
export async function setFollowUpFlag(orgId: string, flag: FollowUpFlag, enabled: boolean): Promise<void> {
  const patch = { [flag]: enabled } as Prisma.FollowUpConfigUncheckedUpdateInput;
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true, [flag]: enabled },
    update: patch,
  });
}

/** Save when the time-absolute follow-ups fire, normalized so the tick's
 *  windows stay valid. */
export async function setFollowUpTiming(orgId: string, raw: Partial<FollowUpTiming>): Promise<FollowUpTiming> {
  const timing = normalizeTiming(raw);
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true, ...timing },
    update: timing,
  });
  return timing;
}

export async function getFollowUpConfig(orgId: string) {
  return prisma.followUpConfig.findUnique({ where: { orgId } });
}

/** The pack's tick-driven templates for this org, by name — for the "edit the
 *  wording" links on the follow-ups page. */
export async function getPackTemplateIds(orgId: string): Promise<Map<string, { id: string; metaStatus: string }>> {
  const rows = await prisma.template.findMany({
    where: { orgId, campaignId: null, name: { in: PACK_TEMPLATES.map((t) => t.name) } },
    select: { id: true, name: true, metaStatus: true },
  });
  return new Map(rows.map((r) => [r.name, { id: r.id, metaStatus: r.metaStatus }]));
}
```

**Step 5: Verify**

Run: `npx vitest run tests/followup-pack.test.ts && npx tsc --noEmit`
Expected: PASS; tsc may report `followup-actions.ts` / `page.tsx` referencing the removed `leadNudge`/`editableInBuilder` — fix those two references now (delete the `builderHref` computation in `page.tsx` and the `builderHref` field in `follow-up-rows.tsx`; they are replaced in Task 11). Then tsc silent.

**Step 6: Commit**

```bash
git add src/modules/followup/install.ts src/modules/followup/pack.ts tests/followup-pack.test.ts "src/app/(app)/automations/page.tsx" "src/app/(app)/automations/follow-up-rows.tsx"
git commit -m "feat(followups): install follow-ups from specs; the pack nudge becomes a went_quiet spec"
```

---

### Task 6: Cancel-on-reply in the engine, wired at the four signal sites

**Files:**
- Modify: `src/modules/automation/engine.ts` (append near `tickAutomationRuns`)
- Modify: `src/modules/agent/inbound.ts` (~line 72 opt-out; ~line 126 before `runInboundAutomations`)
- Modify: `src/modules/agent/tools/capture-booking.ts:109`
- Modify: `src/modules/payments/index.ts:158`
- Modify: `src/app/(app)/automations/automations-list.tsx:34` (`RUN_TONES`)
- Test: `tests/followup-cancel.test.ts`

**Step 1: Write the failing test**

```ts
// tests/followup-cancel.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findRuns, updateRun } = vi.hoisted(() => ({
  findRuns: vi.fn(),
  updateRun: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/db", () => ({
  prisma: { automationRun: { findMany: findRuns, update: updateRun } },
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage: vi.fn() }));

import { cancelWaitingRuns } from "@/modules/automation/engine";

const runs = [
  { id: "r1", status: "WAITING", log: [], automation: { spec: { stopOn: ["reply"] } } },
  { id: "r2", status: "WAITING", log: [{ step: 1, kind: "wait", ok: true, detail: "", at: "" }], automation: { spec: null } },
];

beforeEach(() => {
  updateRun.mockClear();
  findRuns.mockResolvedValue(runs);
});

describe("cancelWaitingRuns", () => {
  it("only looks at this org + contact's WAITING runs", async () => {
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(findRuns.mock.calls[0][0].where).toMatchObject({ orgId: "o1", contactId: "c1", status: "WAITING" });
  });

  it("a reply cancels every waiting run, appending a log line", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "reply");
    expect(n).toBe(2);
    expect(updateRun).toHaveBeenCalledTimes(2);
    const second = updateRun.mock.calls[1][0];
    expect(second.where).toEqual({ id: "r2" });
    expect(second.data.status).toBe("CANCELLED");
    expect(second.data.log).toHaveLength(2);
    expect(second.data.log[1].detail).toMatch(/replied/i);
  });

  it("a booking honours stopOn: skips the spec that excludes it, cancels the spec-less run", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "booking");
    expect(n).toBe(1);
    expect(updateRun.mock.calls[0][0].where).toEqual({ id: "r2" });
  });

  it("never throws — a database error is logged and returns 0", async () => {
    findRuns.mockRejectedValueOnce(new Error("db down"));
    await expect(cancelWaitingRuns("o1", "c1", "payment")).resolves.toBe(0);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-cancel.test.ts`
Expected: FAIL — `cancelWaitingRuns` is not exported.

**Step 3: Implement** — in `engine.ts`, add the import at the top:

```ts
import { shouldCancelOnSignal, type CancelSignal } from "@/modules/followup/spec";
```

and append after `tickAutomationRuns`:

```ts
const CANCEL_DETAIL: Record<CancelSignal, string> = {
  reply: "Cancelled — the customer replied.",
  booking: "Cancelled — the customer booked.",
  payment: "Cancelled — the customer paid.",
  opt_out: "Cancelled — the customer opted out.",
};

/**
 * The customer did something that makes chasing them wrong: end every run
 * that is waiting to message them. A reply or opt-out always cancels; booking
 * and payment respect the follow-up's stopOn. Never throws — cancellation
 * rides on inbound/booking/payment paths that must not break because of it.
 * Returns how many runs were cancelled.
 */
export async function cancelWaitingRuns(
  orgId: string,
  contactId: string,
  signal: CancelSignal
): Promise<number> {
  try {
    const waiting = await prisma.automationRun.findMany({
      where: { orgId, contactId, status: "WAITING" },
      select: { id: true, log: true, automation: { select: { spec: true } } },
    });
    let cancelled = 0;
    for (const run of waiting) {
      if (!shouldCancelOnSignal(run.automation.spec, signal)) continue;
      const log = [...normalizeLogEntries(run.log), logEntry(0, "cancel", true, CANCEL_DETAIL[signal])];
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "CANCELLED", resumeAt: null, log: toJson(log) },
      });
      cancelled++;
    }
    return cancelled;
  } catch (error) {
    console.error("[automations] cancelWaitingRuns failed", error);
    return 0;
  }
}
```

(`normalizeLogEntries` is already exported from `definitions.ts`; add it to the existing import from there if it isn't imported in the engine yet.)

**Step 4: Wire the four signal sites**

`src/modules/agent/inbound.ts` — add `cancelWaitingRuns` to the existing import from `@/modules/automation/engine` (the file already imports `runInboundAutomations` from it), then:

- Directly **after** the `recordContactEvent(orgId, "opted_out", { … })` call (~line 72):
  ```ts
    await cancelWaitingRuns(orgId, contact.id, "opt_out");
  ```
- Directly **before** `const automations = await runInboundAutomations(orgId, {` (~line 126), so a reply can never cancel the run it is about to start:
  ```ts
  // The customer is talking to us again — nothing should keep chasing them.
  await cancelWaitingRuns(orgId, contact.id, "reply");
  ```
  (If the variable holding the contact at that point is not `contact`, use whatever the surrounding code passes as `contactId: …` into `runInboundAutomations`.)

`src/modules/agent/tools/capture-booking.ts` — import `cancelWaitingRuns` from `@/modules/automation/engine`; directly before `await fireBookingCreated(ctx.orgId, ctx.contactId, booking.id);` add:
```ts
      await cancelWaitingRuns(ctx.orgId, ctx.contactId, "booking");
```

`src/modules/payments/index.ts` — import `cancelWaitingRuns`; directly after the `recordContactEvent(row.orgId, "payment_paid", { … });` statement add:
```ts
    await cancelWaitingRuns(row.orgId, row.contactId, "payment");
```

`src/app/(app)/automations/automations-list.tsx` — add `CANCELLED: "neutral",` to `RUN_TONES`. Run `grep -n "COMPLETED" "src/app/(app)/automations/run-log.tsx" "src/app/(app)/automations/[id]/runs/"*.tsx` — if any of those maps statuses to tones/labels, add a `CANCELLED` entry the same way.

**Step 5: Verify**

Run: `npx vitest run tests/followup-cancel.test.ts && npx tsc --noEmit && npm test`
Expected: PASS; tsc silent; full suite green (the inbound/booking/payment tests mock prisma — if one now fails because `automationRun.findMany` is undefined in its mock, `cancelWaitingRuns` already swallows that as a logged error and returns 0, so the test should still pass; if a test asserts on console.error being silent, add `automationRun: { findMany: vi.fn().mockResolvedValue([]) }` to that test's prisma mock).

**Step 6: Commit**

```bash
git add src/modules/automation/engine.ts src/modules/agent/inbound.ts src/modules/agent/tools/capture-booking.ts src/modules/payments/index.ts "src/app/(app)/automations/automations-list.tsx" tests/followup-cancel.test.ts
git commit -m "feat(automations): cancel waiting runs when the customer replies, books, pays or opts out"
```

---

### Task 7: Evaluate `conversation_quiet` on the cron tick

**Files:**
- Modify: `src/modules/automation/triggers.ts` (append)
- Modify: `src/app/api/cron/process-queue/route.ts` (after `resume-automations`)
- Test: `tests/followup-quiet.test.ts`

**Step 1: Write the failing test**

```ts
// tests/followup-quiet.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findAutomations, findRuns, findConversations, runAutomation } = vi.hoisted(() => ({
  findAutomations: vi.fn(),
  findRuns: vi.fn().mockResolvedValue([]),
  findConversations: vi.fn().mockResolvedValue([]),
  runAutomation: vi.fn().mockResolvedValue({ status: "WAITING" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    automation: { findMany: findAutomations },
    automationRun: { findMany: findRuns },
    conversation: { findMany: findConversations },
  },
}));
vi.mock("@/modules/automation/engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/automation/engine")>()),
  runAutomation,
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));

import { fireQuietConversations } from "@/modules/automation/triggers";

const automation = {
  id: "a1",
  orgId: "o1",
  name: "Quiet chase",
  trigger: "conversation_quiet",
  triggerConfig: { hours: 48, stage: "QUALIFIED" },
  steps: [{ id: "s1", automationId: "a1", order: 1, kind: "send_template", config: { templateId: "t1" } }],
};

beforeEach(() => {
  runAutomation.mockClear();
  findConversations.mockClear();
  findRuns.mockResolvedValue([{ contactId: "c-done" }]);
  findAutomations.mockResolvedValue([automation]);
});

describe("fireQuietConversations", () => {
  const now = new Date("2026-09-20T03:00:00Z");

  it("selects open/pending WhatsApp conversations quiet past the cutoff, opted-in, at the stage, never chased before", async () => {
    await fireQuietConversations(now);
    const where = findConversations.mock.calls[0][0].where;
    expect(where.orgId).toBe("o1");
    expect(where.status).toEqual({ in: ["open", "pending"] });
    expect(where.lastInboundAt.lte.getTime()).toBe(now.getTime() - 48 * 3_600_000);
    expect(where.lastInboundAt.not).toBeNull();
    expect(where.contact).toMatchObject({ optedOutAt: null, leadStage: "QUALIFIED" });
    expect(where.contactId).toEqual({ notIn: ["c-done"] });
  });

  it("starts one run per quiet conversation and reports the count", async () => {
    findConversations.mockResolvedValue([
      { id: "v1", contactId: "c1" },
      { id: "v2", contactId: "c2" },
    ]);
    const started = await fireQuietConversations(now);
    expect(started).toBe(2);
    expect(runAutomation).toHaveBeenCalledWith(automation, { orgId: "o1", contactId: "c1", conversationId: "v1" });
  });

  it("skips an automation with no steps and survives a failing run", async () => {
    findAutomations.mockResolvedValue([{ ...automation, steps: [] }, automation]);
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }]);
    runAutomation.mockRejectedValueOnce(new Error("boom"));
    await expect(fireQuietConversations(now)).resolves.toBe(0);
    expect(findConversations).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-quiet.test.ts`
Expected: FAIL — `fireQuietConversations` is not exported.

**Step 3: Implement** — append to `triggers.ts` (add `prisma` and `parseQuietConfig` imports):

```ts
import { prisma } from "@/lib/db";
import { parseQuietConfig } from "@/modules/automation/definitions";

const QUIET_BATCH = 200;

/**
 * The outbound moat's trigger: a customer who messaged us (so they showed
 * interest) has not written back for the configured hours. Runs on the cron
 * tick. One chase per contact per automation, ever — enforced by excluding
 * anyone with an existing run — so a nightly tick can never double-send.
 * Returns how many runs were started.
 */
export async function fireQuietConversations(now: Date = new Date()): Promise<number> {
  const automations = await prisma.automation.findMany({
    where: { enabled: true, trigger: "conversation_quiet" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  let started = 0;
  for (const automation of automations) {
    if (!automation.steps.length) continue;
    const { hours, stage } = parseQuietConfig(automation.triggerConfig);
    const chased = await prisma.automationRun.findMany({
      where: { automationId: automation.id, contactId: { not: null } },
      select: { contactId: true },
    });
    const conversations = await prisma.conversation.findMany({
      where: {
        orgId: automation.orgId,
        channel: "whatsapp",
        status: { in: ["open", "pending"] },
        lastInboundAt: { not: null, lte: new Date(now.getTime() - hours * 3_600_000) },
        contactId: { notIn: chased.map((r) => r.contactId as string) },
        contact: { optedOutAt: null, ...(stage ? { leadStage: stage } : {}) },
      },
      select: { id: true, contactId: true },
      orderBy: { lastInboundAt: "asc" },
      take: QUIET_BATCH,
    });
    for (const c of conversations) {
      try {
        await runAutomation(automation, { orgId: automation.orgId, contactId: c.contactId, conversationId: c.id });
        started++;
      } catch (error) {
        console.error(`[automations] quiet chase "${automation.name}" (${automation.id}) failed`, error);
      }
    }
  }
  return started;
}
```

In the cron route, import `fireQuietConversations` from `@/modules/automation/triggers` and, right after the `resume-automations` block, add:

```ts
    step = "chase-quiet";
    const chased = await fireQuietConversations();
```

Then find the JSON the route returns at the end (it includes `resumedRuns`) and add `chased` beside it.

**Step 4: Verify**

Run: `npx vitest run tests/followup-quiet.test.ts && npx tsc --noEmit`
Expected: PASS; tsc silent.

**Step 5: Commit**

```bash
git add src/modules/automation/triggers.ts src/app/api/cron/process-queue/route.ts tests/followup-quiet.test.ts
git commit -m "feat(automations): chase quiet conversations on the cron tick"
```

---

### Task 8: AI drafting with a deterministic keyless fallback

**Files:**
- Modify: `src/lib/model-router/usage.ts:13-19` (add `"followup_draft"` to `UsagePurpose`)
- Create: `src/modules/followup/draft.ts`
- Test: `tests/followup-draft.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/followup-draft.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: { ANTHROPIC_API_KEY: undefined } }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage: vi.fn() }));

import { draftOffline, parseDraftOutput, starterSetOffline } from "@/modules/followup/draft";
import { compileFollowUp } from "@/modules/followup/compile";

describe("draftOffline (zero-key simulation path)", () => {
  it("reads the situation and the days out of a sentence", () => {
    const r = draftOffline("chase anyone who goes quiet after 2 days, then again a week later");
    expect(r.situation).toEqual({ kind: "went_quiet", afterDays: 2 });
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1].afterDays).toBe(7);
  });
  it("maps bookings, reviews, new leads and keywords", () => {
    expect(draftOffline("thank people after they book").situation.kind).toBe("booked");
    expect(draftOffline("ask for a review the day after the appointment").messages[0].afterDays).toBe(1);
    expect(draftOffline("welcome every new lead").situation.kind).toBe("new_lead");
    expect(draftOffline('when someone says "price" send our price list').situation).toEqual({
      kind: "keyword",
      keywords: ["price"],
    });
  });
  it("falls back to a 2-day quiet chase for anything else", () => {
    expect(draftOffline("something").situation).toEqual({ kind: "went_quiet", afterDays: 2 });
  });
});

describe("starterSetOffline", () => {
  it("yields four valid, compilable follow-ups", () => {
    const set = starterSetOffline("clinic");
    expect(set).toHaveLength(4);
    for (const s of set) expect(() => compileFollowUp(s)).not.toThrow();
  });
});

describe("parseDraftOutput", () => {
  it("accepts a fenced single follow-up and repairs it", () => {
    const r = parseDraftOutput(
      '```json\n{"followUp":{"name":"Chase","situation":{"kind":"went_quiet","afterDays":3},"messages":[{"afterDays":0,"category":"MARKETING","header":"Hi","body":"Still there?","footer":""}]}}\n```',
      "single"
    );
    expect(r.ok && r.specs[0].messages[0].body).toContain("{{1}}");
  });
  it("accepts a starter set and drops the invalid entries", () => {
    const r = parseDraftOutput(
      '{"followUps":[{"name":"ok","situation":{"kind":"booked"},"messages":[{"afterDays":1,"category":"UTILITY","header":"See you","body":"Hi {{1}}","footer":""}]},{"name":"bad","situation":{"kind":"nope"},"messages":[]}]}',
      "set"
    );
    expect(r.ok && r.specs.map((s) => s.name)).toEqual(["ok"]);
  });
  it("fails cleanly on non-JSON", () => {
    expect(parseDraftOutput("sorry, I can't", "single").ok).toBe(false);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-draft.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement**

In `usage.ts` add `| "followup_draft"` to `UsagePurpose` (after `"campaign_copy"`). It is metered like campaign copy (it is not in `isAbsorbedPurpose`).

```ts
// src/modules/followup/draft.ts
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generate } from "@/lib/model-router";
import { recordSyntheticUsage } from "@/lib/model-router/usage";
import { extractJson } from "@/modules/campaign/guardrails";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { PACK_TEMPLATES } from "@/modules/followup/pack";
import {
  MAX_GAP_DAYS,
  MAX_MESSAGES,
  parseFollowUpSpec,
  type FollowUpSpec,
} from "@/modules/followup/spec";

/**
 * Turn a sentence (or a business profile) into FollowUpSpecs. Runs on the
 * router (RUNTIME_MODEL, BYOK-aware, credit-metered as followup_draft). The
 * keyless path is deterministic so the whole flow demos with no API key
 * (invariant #4). Never load-bearing: every failure is a readable error and
 * nothing is saved until a spec validates.
 */

interface BusinessContext {
  businessName: string;
  vertical: string;
  businessInfo: string;
  tone: string;
  doNots: string;
  knowledge: string;
}

async function loadBusinessContext(orgId: string): Promise<BusinessContext> {
  const [profile, org, entries] = await Promise.all([
    prisma.agentProfile.findUnique({ where: { orgId } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { name: true, vertical: true } }),
    prisma.knowledgeEntry.findMany({
      where: { orgId },
      select: { category: true, fact: true, condition: true },
      take: 60,
    }),
  ]);
  return {
    businessName: profile?.businessName || org?.name || "the business",
    vertical: profile?.vertical || org?.vertical || "services",
    businessInfo: profile?.businessInfo ?? "",
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
    knowledge: buildKnowledgeDigest(entries, 2500),
  };
}

function systemPrompt(b: BusinessContext): string {
  return [
    `You design WhatsApp follow-ups for ${b.businessName}, a ${b.vertical} business. A follow-up is a message (or up to ${MAX_MESSAGES}) sent automatically after a situation, to bring a customer back.`,
    "",
    "Situations (use exactly these kinds):",
    '- went_quiet {afterDays 1-14, stage?}: a customer who messaged us has not replied for N days. Use for chasing leads. stage is one of NEW, CONTACTED, QUALIFIED, WON, LOST — omit unless the owner named one.',
    "- booked {}: right after an appointment is booked (confirmations, prep, thank-you).",
    "- campaign_reply {}: the customer replied to a marketing campaign.",
    "- keyword {keywords[]}: a message contains one of these words.",
    "- new_lead {}: the customer's first ever message.",
    "",
    "Message rules (Meta WhatsApp templates):",
    "- body: warm, concrete, under 500 characters, uses {{1}} exactly once near the start for the first name. No ALL-CAPS, no pressure, no medical or financial claims, nothing the business did not state.",
    "- header: under 50 characters. footer: leave empty (we add the opt-out).",
    "- category: MARKETING for anything promotional or a chase; UTILITY only for a transactional message about a booking the customer made.",
    `- afterDays: days after the previous message (0 = immediately), max ${MAX_GAP_DAYS}. For went_quiet the first message is always 0 — the waiting is in the situation.`,
    `- Tone: ${b.tone}.`,
    b.doNots ? `- Never: ${b.doNots}` : "",
    b.businessInfo ? `\nAbout the business:\n${b.businessInfo}` : "",
    b.knowledge ? `\nWhat the business has told us (only use facts from here):\n${b.knowledge}` : "",
    "",
    "Return ONLY a JSON object, no markdown, no commentary.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

const SINGLE_SHAPE =
  'Shape: {"followUp": {"name": "short name", "situation": {...}, "messages": [{"afterDays": 0, "category": "MARKETING", "header": "...", "body": "...", "footer": ""}], "stopOn": ["reply","booking","payment"]}}';
const SET_SHAPE =
  'Shape: {"followUps": [ ...4 to 6 follow-up objects as above... ]}. Cover: a quiet-lead chase, something right after a booking, a post-visit review ask, and a welcome for new leads; add one or two specific to this kind of business.';

export type DraftParse =
  | { ok: true; specs: FollowUpSpec[] }
  | { ok: false; error: string };

/** Pure: model text → validated specs. A set keeps the valid entries. */
export function parseDraftOutput(text: string, mode: "single" | "set"): DraftParse {
  const json = extractJson(text);
  if (!json.ok) return { ok: false, error: json.error };
  const obj = json.value && typeof json.value === "object" ? (json.value as Record<string, unknown>) : {};
  const raws = mode === "single" ? [obj.followUp ?? obj] : Array.isArray(obj.followUps) ? obj.followUps : [];
  const specs: FollowUpSpec[] = [];
  for (const raw of raws) {
    const parsed = parseFollowUpSpec(raw);
    if (parsed.ok) specs.push(parsed.spec);
    else if (mode === "single") return { ok: false, error: parsed.error };
  }
  if (!specs.length) return { ok: false, error: "The draft had no usable follow-up in it." };
  return { ok: true, specs };
}

async function draftWithModel(orgId: string, mode: "single" | "set", userPrompt: string): Promise<FollowUpSpec[]> {
  const b = await loadBusinessContext(orgId);
  const system = systemPrompt(b);
  const shape = mode === "single" ? SINGLE_SHAPE : SET_SHAPE;
  const attribution = { orgId, purpose: "followup_draft" } as const;
  let text = await generate({ system, prompt: `${userPrompt}\n\n${shape}`, maxTokens: 1800, attribution });
  let parsed = parseDraftOutput(text, mode);
  if (!parsed.ok) {
    text = await generate({
      system,
      prompt: `${userPrompt}\n\n${shape}\n\nIMPORTANT: your previous reply was not valid (${parsed.error}). Respond with ONLY the JSON object — first character "{", last character "}".`,
      maxTokens: 1800,
      attribution,
    });
    parsed = parseDraftOutput(text, mode);
  }
  if (!parsed.ok) throw new Error("We couldn't write that follow-up just now — try rephrasing, or try again in a moment.");
  return parsed.specs;
}

export async function draftFollowUp(opts: { orgId: string; request: string }): Promise<FollowUpSpec> {
  const request = opts.request.trim();
  if (!request) throw new Error("Describe the follow-up in a sentence first.");
  if (!env.ANTHROPIC_API_KEY) {
    const spec = draftOffline(request);
    recordSyntheticUsage({ orgId: opts.orgId, purpose: "followup_draft" }, request, JSON.stringify(spec));
    return spec;
  }
  const [spec] = await draftWithModel(opts.orgId, "single", `The owner asked for this follow-up: "${request}"`);
  return spec;
}

export async function draftStarterSet(opts: { orgId: string }): Promise<FollowUpSpec[]> {
  if (!env.ANTHROPIC_API_KEY) {
    const b = await loadBusinessContext(opts.orgId).catch(() => null);
    const set = starterSetOffline(b?.vertical ?? "services");
    recordSyntheticUsage({ orgId: opts.orgId, purpose: "followup_draft" }, "starter set", JSON.stringify(set));
    return set;
  }
  return draftWithModel(opts.orgId, "set", "Write the starter set of follow-ups for this business.");
}

// ---------------------------------------------------------------------------
// Keyless path — deterministic, uses the pack's reviewed copy
// ---------------------------------------------------------------------------

const packCopy = (name: string) => {
  const t = PACK_TEMPLATES.find((x) => x.name === name)!;
  return { category: t.category, header: t.content.header, body: t.content.body, footer: t.content.footer, buttons: t.content.buttons };
};

function daysIn(text: string, fallback: number): number {
  const m = text.match(/(\d+)\s*(day|days|d)\b/i);
  const weeks = text.match(/(\d+)\s*(week|weeks|w)\b/i) ?? (/\ba week\b/i.test(text) ? ["", "1"] : null);
  const n = m ? Number(m[1]) : weeks ? Number(weeks[1]) * 7 : fallback;
  return Math.min(Math.max(n, 1), MAX_GAP_DAYS);
}

/** Sentence → spec without a model. Good enough to demo every situation. */
export function draftOffline(request: string): FollowUpSpec {
  const r = request.toLowerCase();
  const keyword = r.match(/"([^"]{1,40})"/);
  const spec = ((): FollowUpSpec => {
    if (keyword) {
      return {
        name: `Reply to "${keyword[1]}"`,
        situation: { kind: "keyword", keywords: [keyword[1]] },
        messages: [{ afterDays: 0, ...packCopy("lead_nudge_1") }],
        stopOn: ["reply", "booking", "payment"],
      };
    }
    if (/review|feedback|how did we do/.test(r)) {
      return {
        name: "Review ask",
        situation: { kind: "booked" },
        messages: [{ afterDays: daysIn(r, 1), ...packCopy("review_ask") }],
        stopOn: ["reply", "booking", "payment"],
      };
    }
    if (/book|appointment|confirm/.test(r)) {
      return {
        name: "After booking",
        situation: { kind: "booked" },
        messages: [{ afterDays: 0, ...packCopy("appt_reminder_24h") }],
        stopOn: ["reply", "booking", "payment"],
      };
    }
    if (/new lead|first message|welcome/.test(r)) {
      return {
        name: "Welcome",
        situation: { kind: "new_lead" },
        messages: [{ afterDays: 0, ...packCopy("lead_nudge_1") }],
        stopOn: ["reply", "booking", "payment"],
      };
    }
    const messages: FollowUpSpec["messages"] = [{ afterDays: 0, ...packCopy("lead_nudge_1") }];
    if (/again|then|once more|second/.test(r)) {
      const tail = r.split(/again|then|once more|second/).pop() ?? "";
      messages.push({ afterDays: daysIn(tail, 3), ...packCopy("lead_nudge_2") });
    }
    return {
      name: "Quiet-lead chase",
      situation: { kind: "went_quiet", afterDays: daysIn(r.split(/again|then|once more|second/)[0], 2) },
      messages,
      stopOn: ["reply", "booking", "payment"],
    };
  })();
  const parsed = parseFollowUpSpec(spec);
  return parsed.ok ? parsed.spec : spec;
}

/** The starter set with no model: the pack's copy across the four situations. */
export function starterSetOffline(vertical: string): FollowUpSpec[] {
  const visit = vertical === "clinic" ? "consultation" : "visit";
  const set: FollowUpSpec[] = [
    {
      name: "Quiet-lead chase",
      situation: { kind: "went_quiet", afterDays: 2 },
      messages: [
        { afterDays: 0, ...packCopy("lead_nudge_1") },
        { afterDays: 3, ...packCopy("lead_nudge_2") },
      ],
      stopOn: ["reply", "booking", "payment"],
    },
    {
      name: `Before your ${visit}`,
      situation: { kind: "booked" },
      messages: [{ afterDays: 0, ...packCopy("appt_reminder_24h") }],
      stopOn: ["reply", "booking", "payment"],
    },
    {
      name: "Review ask",
      situation: { kind: "booked" },
      messages: [{ afterDays: 1, ...packCopy("review_ask") }],
      stopOn: ["reply", "booking", "payment"],
    },
    {
      name: "Welcome new leads",
      situation: { kind: "new_lead" },
      messages: [{ afterDays: 0, ...packCopy("lead_nudge_1") }],
      stopOn: ["reply", "booking", "payment"],
    },
  ];
  return set.map((s) => {
    const p = parseFollowUpSpec(s);
    return p.ok ? p.spec : s;
  });
}
```

If `tsc` complains that `knowledgeEntry` has no `fact`/`condition`/`category` field, open `prisma/schema.prisma` → `model KnowledgeEntry` and use its actual column names in the `select` and in the `buildKnowledgeDigest` call (it expects `{ category, fact, condition }`).

**Step 4: Verify**

Run: `npx vitest run tests/followup-draft.test.ts && npx tsc --noEmit`
Expected: PASS, 8 tests; tsc silent.

**Step 5: Commit**

```bash
git add src/lib/model-router/usage.ts src/modules/followup/draft.ts tests/followup-draft.test.ts
git commit -m "feat(followups): draft follow-ups from a sentence or the business profile, with a keyless fallback"
```

---

### Task 9: Server actions — draft, create, update, delete, starter set

**Files:**
- Modify: `src/app/(app)/automations/followup-actions.ts` (append)
- Modify: `src/modules/orgs/audit.ts` (`AuditAction` union ~line 26 and `AUDIT_ACTION_LABELS` ~line 89)
- Modify: `src/app/(app)/automations/actions.ts:71-84` (builder edit clears the spec)

**Step 1: Audit vocabulary** — in `audit.ts` add after `"followup.timing"`:

```ts
  | "followup.drafted"
  | "followup.created"
  | "followup.updated"
  | "followup.deleted"
```

and labels:

```ts
  "followup.drafted": "AI drafted follow-ups",
  "followup.created": "Follow-up created",
  "followup.updated": "Follow-up edited",
  "followup.deleted": "Follow-up deleted",
```

**Step 2: Actions** — append to `followup-actions.ts` (extend the imports: `checkAutomationLimit` from `@/modules/billing/limits`; `prisma` from `@/lib/db`; `draftFollowUp, draftStarterSet` from `@/modules/followup/draft`; `saveFollowUpFromSpec` from `@/modules/followup/install`; `parseFollowUpSpec, type FollowUpSpec` from `@/modules/followup/spec`):

```ts
export interface DraftResult extends ActionResult {
  spec?: FollowUpSpec;
}

/** Sentence → reviewable spec. Nothing is saved. ADMIN + AI Front Desk. */
export async function draftFollowUpAction(request: string): Promise<DraftResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    const spec = await draftFollowUp({ orgId: ctx.org.id, request: String(request ?? "").slice(0, 500) });
    return { ok: true, message: "Here's a draft — edit anything, then create it.", spec };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't draft that follow-up." };
  }
}

export interface CreateResult extends ActionResult {
  id?: string;
}

/** Save a reviewed spec as a new follow-up. Lands OFF. */
export async function createFollowUpAction(raw: unknown): Promise<CreateResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    const limit = await checkAutomationLimit(ctx.org.id);
    if (!limit.allowed) return { ok: false, message: limit.message };
    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const { id } = await saveFollowUpFromSpec({ orgId: ctx.org.id, spec: parsed.spec, source: "ai" });
    recordAudit(ctx, "followup.created", parsed.spec.name);
    revalidatePath("/automations");
    return { ok: true, message: "Created — it's off until you switch it on.", id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't create that follow-up." };
  }
}

/** Re-save an edited spec over an existing follow-up (org-scoped). */
export async function updateFollowUpAction(id: string, raw: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({ where: { id, orgId: ctx.org.id }, select: { id: true, source: true } });
    if (!existing) return { ok: false, message: "Follow-up not found." };
    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    await saveFollowUpFromSpec({
      orgId: ctx.org.id,
      spec: parsed.spec,
      source: existing.source === "pack" ? "pack" : "ai",
      automationId: id,
    });
    recordAudit(ctx, "followup.updated", parsed.spec.name);
    revalidatePath("/automations");
    return { ok: true, message: "Saved. Changed wording goes back to Meta for approval." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save that follow-up." };
  }
}

export async function deleteFollowUpAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({ where: { id, orgId: ctx.org.id }, select: { name: true } });
    if (!existing) return { ok: false, message: "Follow-up not found." };
    await prisma.automation.delete({ where: { id } });
    recordAudit(ctx, "followup.deleted", existing.name);
    revalidatePath("/automations");
    return { ok: true, message: "Deleted. Its templates stay in your library." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't delete that follow-up." };
  }
}

/** First-open: install the tick-driven pack AND draft a tailored set, all OFF. */
export async function writeStarterSetAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    await installRevenueRecoveryPack(ctx.org.id);
    const specs = await draftStarterSet({ orgId: ctx.org.id });
    const existing = new Set(
      (await prisma.automation.findMany({ where: { orgId: ctx.org.id }, select: { name: true } })).map((a) => a.name)
    );
    let created = 0;
    for (const spec of specs) {
      if (existing.has(spec.name)) continue;
      await saveFollowUpFromSpec({ orgId: ctx.org.id, spec, source: "ai" });
      created++;
    }
    recordAudit(ctx, "followup.drafted", `${created} drafted`);
    revalidatePath("/automations");
    return {
      ok: true,
      message: created
        ? `Drafted ${created} follow-up${created === 1 ? "" : "s"} for you — read them, then switch on the ones you want.`
        : "Your starter set is already here.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't write your starter set." };
  }
}
```

Remove the now-unused `toggleRevenueRecoveryAction`'s "enabling" install path? **No** — keep it; the page still uses pause/resume. But note `writeStarterSetAction` calls `installRevenueRecoveryPack` directly.

**Step 3: A builder edit clears the spec** — in `automations/actions.ts`, change `import type { Prisma } from "@prisma/client"` to `import { Prisma } from "@prisma/client"` and in the update branch's `data:` add:

```ts
            spec: Prisma.DbNull,
            source: "builder",
```

**Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both silent.

**Step 5: Commit**

```bash
git add "src/app/(app)/automations/followup-actions.ts" "src/app/(app)/automations/actions.ts" src/modules/orgs/audit.ts
git commit -m "feat(followups): draft/create/update/delete actions and the starter set"
```

---

### Task 10: The page — one list of follow-up cards, the bar, the starter CTA

**Files:**
- Create: `src/app/(app)/automations/follow-up-bar.tsx`
- Create: `src/app/(app)/automations/follow-up-card.tsx`
- Create: `src/app/(app)/automations/spec-editor.tsx`
- Rewrite: `src/app/(app)/automations/page.tsx`
- Delete: `src/app/(app)/automations/revenue-recovery-card.tsx`
- Modify: `tests/followups-page.test.ts`

**Step 1: Update the page tests** (replace the file):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/automations/page.tsx", "utf8");
const bar = readFileSync("src/app/(app)/automations/follow-up-bar.tsx", "utf8");
const card = readFileSync("src/app/(app)/automations/follow-up-card.tsx", "utf8");

describe("follow-ups page", () => {
  it("leads with the natural-language bar and the starter-set CTA", () => {
    expect(page).toContain("<FollowUpBar");
    expect(bar).toContain("draftFollowUpAction");
    expect(bar).toContain("createFollowUpAction");
    expect(bar).toContain("writeStarterSetAction");
  });

  it("shows every follow-up as one card list — no pack/builder split", () => {
    expect(page).toContain("<FollowUpCard");
    expect(page).not.toContain("AutomationsList");
    expect(page).not.toContain("Follow-ups you build yourself");
  });

  it("each card explains the situation in plain English and links to the builder", () => {
    expect(card).toContain("describeSituation");
    expect(card).toContain("describeMessageTiming");
    expect(card).toContain("/automations/${");
  });

  it("keeps the builder reachable and is honest about the nightly run", () => {
    expect(page).toContain('href="/automations/new"');
    expect(page).toMatch(/nightly run/i);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followups-page.test.ts`
Expected: FAIL — `follow-up-bar.tsx` does not exist.

**Step 3: The spec editor (shared by the preview and the card's inline edit)**

```tsx
// src/app/(app)/automations/spec-editor.tsx
"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  describeMessageTiming,
  describeSituation,
  MAX_GAP_DAYS,
  type FollowUpSpec,
} from "@/modules/followup/spec";

/** Edits the parts an owner cares about: name, days, wording. The situation is
 *  shown, not edited — change it by describing a new follow-up. */
export function SpecEditor({
  spec,
  onChange,
  disabled,
}: {
  spec: FollowUpSpec;
  onChange: (next: FollowUpSpec) => void;
  disabled?: boolean;
}) {
  const setMessage = (i: number, patch: Partial<FollowUpSpec["messages"][number]>) =>
    onChange({ ...spec, messages: spec.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-neutral-600">Name</span>
        <Input
          value={spec.name}
          disabled={disabled}
          maxLength={80}
          onChange={(e) => onChange({ ...spec, name: e.target.value })}
          className="mt-1"
        />
      </label>
      <p className="text-sm text-neutral-700">{describeSituation(spec.situation)}</p>
      {spec.messages.map((m, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{describeMessageTiming(i, m.afterDays)}</Badge>
            <Badge tone={m.category === "MARKETING" ? "brand" : "info"}>{m.category.toLowerCase()}</Badge>
            {(i > 0 || spec.situation.kind !== "went_quiet") && (
              <label className="ml-auto flex items-center gap-1.5 text-xs text-neutral-600">
                after
                <Input
                  type="number"
                  min={0}
                  max={MAX_GAP_DAYS}
                  value={m.afterDays}
                  disabled={disabled}
                  onChange={(e) => setMessage(i, { afterDays: Math.max(0, Math.min(MAX_GAP_DAYS, Number(e.target.value) || 0)) })}
                  className="w-16"
                />
                days
              </label>
            )}
          </div>
          <Input
            value={m.header}
            disabled={disabled}
            maxLength={60}
            onChange={(e) => setMessage(i, { header: e.target.value })}
            className="mt-2"
            aria-label="Header"
          />
          <Textarea
            value={m.body}
            disabled={disabled}
            maxLength={600}
            onChange={(e) => setMessage(i, { body: e.target.value })}
            className="mt-2"
            aria-label="Message"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {"{{1}}"} becomes the customer&rsquo;s first name.
            {m.category === "MARKETING" && " Marketing messages carry the STOP footer."}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: The bar**

```tsx
// src/app/(app)/automations/follow-up-bar.tsx
"use client";

import { useState, useTransition } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { FollowUpSpec } from "@/modules/followup/spec";
import { createFollowUpAction, draftFollowUpAction, writeStarterSetAction } from "./followup-actions";
import { SpecEditor } from "./spec-editor";

const EXAMPLES: Record<string, string[]> = {
  clinic: [
    "Chase anyone who asked about pricing but didn't book, after 2 days, then once more a week later",
    "The day after a consultation, ask how it went and invite questions",
    "Welcome every new lead and tell them our consultation hours",
  ],
  salon: [
    "Nudge clients who went quiet after asking for a slot, after 2 days",
    "Ask for a review the day after an appointment",
    "Remind everyone who booked that we're open on Sundays",
  ],
  default: [
    "Chase anyone who went quiet after showing interest, after 2 days, then once more 5 days later",
    "Thank people the day after their appointment and ask how it went",
    "Welcome every new lead with what we do and how to book",
  ],
};

export function FollowUpBar({
  vertical,
  canManage,
  hasAny,
}: {
  vertical: string;
  canManage: boolean;
  hasAny: boolean;
}) {
  const { toast } = useToast();
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<FollowUpSpec | null>(null);
  const [pending, start] = useTransition();
  const examples = EXAMPLES[vertical] ?? EXAMPLES.default;

  function draftIt() {
    start(async () => {
      const r = await draftFollowUpAction(request);
      if (r.ok && r.spec) setDraft(r.spec);
      else toast({ description: r.message, tone: "error" });
    });
  }

  function createIt() {
    if (!draft) return;
    start(async () => {
      const r = await createFollowUpAction(draft);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) {
        setDraft(null);
        setRequest("");
      }
    });
  }

  function starter() {
    start(async () => {
      const r = await writeStarterSetAction();
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  if (!canManage) return null;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-900">Describe a follow-up</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Say who, when and what — the AI writes the message and the timing. You review it before anything is created.
          </p>
          <Textarea
            value={request}
            disabled={pending}
            maxLength={500}
            placeholder={examples[0]}
            onChange={(e) => setRequest(e.target.value)}
            className="mt-3"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={pending}
                onClick={() => setRequest(ex)}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={draftIt} loading={pending} disabled={!request.trim()}>
              <Wand2 className="h-4 w-4" aria-hidden />
              Draft it
            </Button>
            {!hasAny && (
              <Button variant="secondary" onClick={starter} loading={pending}>
                Write my starter set
              </Button>
            )}
          </div>
          {draft && (
            <div className="mt-4 rounded-xl bg-neutral-50 p-4">
              <SpecEditor spec={draft} onChange={setDraft} disabled={pending} />
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={createIt} loading={pending}>
                  Create follow-up
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                  Discard
                </Button>
                <span className="text-xs text-neutral-500">It starts off. Its message goes to Meta for approval.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
```

**Step 5: The card**

```tsx
// src/app/(app)/automations/follow-up-card.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Trash2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { describeMessageTiming, describeSituation, type FollowUpSpec } from "@/modules/followup/spec";
import { toggleAutomation } from "./actions";
import { deleteFollowUpAction, updateFollowUpAction } from "./followup-actions";
import { SpecEditor } from "./spec-editor";

export interface FollowUpCardModel {
  id: string;
  name: string;
  spec: FollowUpSpec | null;
  source: string;
  enabled: boolean;
  triggerLabel: string;
  stepsCount: number;
  /** Meta status of every template this follow-up sends. */
  templateStatuses: string[];
  lastRunAt: string | null;
}

function statusOf(m: FollowUpCardModel): { label: string; tone: "success" | "warning" | "neutral" | "danger" } {
  if (m.templateStatuses.includes("REJECTED")) return { label: "Rejected by Meta", tone: "danger" };
  if (m.templateStatuses.some((s) => s !== "APPROVED")) return { label: "Waiting for Meta", tone: "warning" };
  return m.enabled ? { label: "On", tone: "success" } : { label: "Off", tone: "neutral" };
}

export function FollowUpCard({ model, canManage }: { model: FollowUpCardModel; canManage: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FollowUpSpec | null>(model.spec);
  const status = statusOf(model);

  function toggle(next: boolean) {
    start(async () => {
      const fd = new FormData();
      fd.set("automationId", model.id);
      fd.set("enabled", String(next));
      const r = await toggleAutomation(fd);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await updateFollowUpAction(model.id, draft);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${model.name}"? Its templates stay in your library.`)) return;
    start(async () => {
      const r = await deleteFollowUpAction(model.id);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">{model.name}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
            {model.source === "pack" && <Badge tone="brand">Included</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            {model.spec ? describeSituation(model.spec.situation) : `When: ${model.triggerLabel}`}
          </p>
          {model.spec && !editing && (
            <ol className="mt-2 space-y-1.5">
              {model.spec.messages.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-xs text-neutral-500">{describeMessageTiming(i, m.afterDays)}</span>
                  <span className="min-w-0 truncate text-neutral-600">{m.body}</span>
                </li>
              ))}
            </ol>
          )}
          {!model.spec && (
            <p className="mt-1 text-xs text-neutral-500">
              {model.stepsCount} step{model.stepsCount === 1 ? "" : "s"} · built in the editor
            </p>
          )}
          {editing && draft && (
            <div className="mt-3">
              <SpecEditor spec={draft} onChange={setDraft} disabled={pending} />
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={save} loading={pending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(model.spec); }} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {canManage && !editing && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {model.spec && (
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </button>
              )}
              <Link href={`/automations/${model.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                <Workflow className="h-3 w-3" aria-hidden /> Open in builder
              </Link>
              <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-red-600">
                <Trash2 className="h-3 w-3" aria-hidden /> Delete
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="text-xs text-neutral-500">{model.enabled ? "On" : "Off"}</span>
          <Switch
            checked={model.enabled}
            onCheckedChange={toggle}
            disabled={!canManage || pending}
            aria-label={`${model.enabled ? "Pause" : "Enable"} ${model.name}`}
          />
        </div>
      </div>
    </Card>
  );
}
```

**Step 6: The page** — rewrite `page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { TRIGGER_LABELS, type AutomationTrigger } from "@/modules/automation/definitions";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { getFollowUpConfig, getPackTemplateIds } from "@/modules/followup/install";
import { FOLLOW_UP_KINDS, normalizeTiming } from "@/modules/followup/pack";
import { followUpSpecSchema } from "@/modules/followup/spec";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FollowUpBar } from "./follow-up-bar";
import { FollowUpCard, type FollowUpCardModel } from "./follow-up-card";
import { FollowUpRows, type FollowUpRow } from "./follow-up-rows";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const { org, role } = await requireOrgContext();
  const canManage = hasRole(role, "ADMIN") && planHasAiFrontDesk(org.plan);

  const [config, packTemplates, automations, profile] = await Promise.all([
    getFollowUpConfig(org.id),
    getPackTemplateIds(org.id),
    prisma.automation.findMany({
      where: { orgId: org.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
      include: {
        steps: { orderBy: { order: "asc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.agentProfile.findUnique({ where: { orgId: org.id }, select: { vertical: true } }),
  ]);

  const templateIds = automations.flatMap((a) =>
    a.steps.filter((s) => s.kind === "send_template").map((s) => String((s.config as { templateId?: string }).templateId ?? ""))
  );
  const templates = templateIds.length
    ? await prisma.template.findMany({ where: { orgId: org.id, id: { in: templateIds } }, select: { id: true, metaStatus: true } })
    : [];
  const statusById = new Map(templates.map((t) => [t.id, t.metaStatus]));

  const cards: FollowUpCardModel[] = automations.map((a) => {
    const spec = followUpSpecSchema.safeParse(a.spec);
    return {
      id: a.id,
      name: a.name,
      spec: spec.success ? spec.data : null,
      source: a.source,
      enabled: a.enabled,
      triggerLabel: TRIGGER_LABELS[a.trigger as AutomationTrigger] ?? a.trigger,
      stepsCount: a.steps.length,
      templateStatuses: a.steps
        .filter((s) => s.kind === "send_template")
        .map((s) => statusById.get(String((s.config as { templateId?: string }).templateId ?? "")) ?? "PENDING"),
      lastRunAt: a.runs[0]?.createdAt.toISOString() ?? null,
    };
  });

  const timing = normalizeTiming(config ?? {});
  const tickRows: FollowUpRow[] = config
    ? FOLLOW_UP_KINDS.map((kind) => ({
        flag: kind.flag,
        label: kind.label,
        timing: kind.timing,
        description: kind.description,
        enabled: config[kind.flag],
        timingFields: [...kind.timingFields],
        templates: kind.templateNames.flatMap((name) => {
          const row = packTemplates.get(name);
          return row ? [{ id: row.id, name, status: row.metaStatus }] : [];
        }),
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Nudge chases every quiet lead, reminds every booking and asks for every review — you describe it, the AI writes it, you switch it on."
        actions={
          canManage && (
            <Link href="/automations/new" className={buttonVariants({ variant: "secondary" })}>
              <Plus className="h-4 w-4" aria-hidden />
              Build one by hand
            </Link>
          )
        }
      />

      <FollowUpBar vertical={profile?.vertical ?? org.vertical ?? "default"} canManage={canManage} hasAny={cards.length > 0} />

      <p className="mt-3 text-xs text-neutral-500">
        Follow-ups go out during the nightly run, so a &ldquo;2 days later&rdquo; message lands the next night after that.
      </p>

      <section className="mt-6 space-y-3">
        {tickRows.length > 0 && (
          <FollowUpRows rows={tickRows} timing={timing} canManage={canManage} paused={!config?.enabled} />
        )}
        {cards.map((c) => (
          <FollowUpCard key={c.id} model={c} canManage={canManage} />
        ))}
        {cards.length === 0 && tickRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Nothing yet. Describe one above, or let the AI write your starter set.
          </p>
        )}
      </section>
    </>
  );
}
```

If `org.vertical` does not exist on the org context, drop that fallback and use `profile?.vertical ?? "default"`.

Delete `revenue-recovery-card.tsx` and remove `toggleRevenueRecoveryAction` from `followup-actions.ts` only if nothing else imports it (`grep -rn toggleRevenueRecoveryAction src/`). In `follow-up-rows.tsx`, remove the `builderHref` prop/link if Task 5 did not already.

**Step 7: Verify**

Run: `npx vitest run tests/followups-page.test.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

**Step 8: Check it in the browser** — the dev server is usually running on `:3000`; the founder is signed in there. Ask them to reload `/automations`, click **Write my starter set** (in test mode this is instant and keyless), confirm four AI cards + the pack nudge + three reminder rows appear, all Off except the pack nudge; type a sentence, **Draft it**, edit a word, **Create follow-up**; switch one on; open one in the builder and back. Fix anything they report before committing.

**Step 9: Commit**

```bash
git add "src/app/(app)/automations/" tests/followups-page.test.ts
git commit -m "feat(followups): one list of follow-up cards with a natural-language bar and AI starter set"
```

---

### Task 11: Founder admin — the same bar and starter set per org

**Files:**
- Modify: `src/modules/admin/concierge.ts` (append)
- Modify: `src/modules/orgs/audit.ts` (`admin.followups_drafted`)
- Modify: `src/app/admin/orgs/[id]/actions.ts` (append)
- Modify: `src/app/admin/orgs/[id]/agent/page.tsx` (add a Card)

**Step 1: Audit** — add `| "admin.followups_drafted"` next to `"admin.followups_toggled"` and the label `"admin.followups_drafted": "Nudge support drafted follow-ups"`.

**Step 2: Module** — append to `concierge.ts` (imports: `draftFollowUp, draftStarterSet` from `@/modules/followup/draft`; `installRevenueRecoveryPack, saveFollowUpFromSpec` from `@/modules/followup/install`):

```ts
/** Founder-side: draft one follow-up from a sentence, or the starter set when
 *  `request` is empty. Same drafting path the client uses; lands OFF. */
export async function founderDraftFollowUps(
  orgId: string,
  request: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { ok: false, error: "Org not found." };
  let created = 0;
  if (request.trim()) {
    const spec = await draftFollowUp({ orgId, request });
    await saveFollowUpFromSpec({ orgId, spec, source: "ai" });
    created = 1;
  } else {
    await installRevenueRecoveryPack(orgId);
    const existing = new Set(
      (await prisma.automation.findMany({ where: { orgId }, select: { name: true } })).map((a) => a.name)
    );
    for (const spec of await draftStarterSet({ orgId })) {
      if (existing.has(spec.name)) continue;
      await saveFollowUpFromSpec({ orgId, spec, source: "ai" });
      created++;
    }
  }
  await founderAudit(orgId, founderEmail, "admin.followups_drafted", null, withReason(`${created} drafted`, reason));
  return { ok: true, message: `${created} follow-up${created === 1 ? "" : "s"} drafted (off until switched on).` };
}
```

**Step 3: Action** — append to `admin/orgs/[id]/actions.ts` (import `founderDraftFollowUps` from `@/modules/admin/concierge`):

```ts
export async function draftFollowUpsAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    return withRequiredReason(formData, async (reason) => {
      const orgId = str(formData, "orgId");
      return done(orgId, await founderDraftFollowUps(orgId, str(formData, "request"), founder.email, reason));
    });
  });
}
```

**Step 4: Page** — in `admin/orgs/[id]/agent/page.tsx`, load the org's automations alongside the existing queries:

```ts
    prisma.automation.findMany({ where: { orgId: id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, enabled: true, source: true, trigger: true } }),
```

and add a Card in the grid (import `draftFollowUpsAction` from `../actions`):

```tsx
      <Card>
        <CardHeader>
          <CardTitle>Follow-ups</CardTitle>
          <CardDescription>Same drafting path the client sees. Everything lands off; switch on from the client&rsquo;s Follow-ups page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y divide-neutral-100 text-sm">
            {followUps.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-1.5">
                <span>{a.name}</span>
                <span className="flex gap-1.5">
                  <Badge tone="neutral">{a.source}</Badge>
                  <Badge tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "on" : "off"}</Badge>
                </span>
              </li>
            ))}
            {followUps.length === 0 && <li className="py-1.5 text-neutral-500">None yet.</li>}
          </ul>
          <ActionForm action={draftFollowUpsAction} hidden={H} submitLabel="Write starter set" askReason />
          <ActionForm action={draftFollowUpsAction} hidden={H} submitLabel="Draft from a sentence" askReason>
            <Field label="Describe it" name="request" rows={2} placeholder="Chase anyone who asked about pricing but didn't book, after 2 days" />
          </ActionForm>
        </CardContent>
      </Card>
```

(`followUps` is the destructured result of the new query — add it to the `Promise.all` destructuring.)

**Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: green. Check `tests/admin-*.test.ts` still pass (some assert on that page's source).

**Step 6: Commit**

```bash
git add src/modules/admin/concierge.ts src/modules/orgs/audit.ts "src/app/admin/orgs/[id]/actions.ts" "src/app/admin/orgs/[id]/agent/page.tsx"
git commit -m "feat(admin): draft a client's follow-ups from the founder org page"
```

---

### Task 12: Final verification, PROGRESS.md, build

**Files:**
- Modify: `PROGRESS.md` (new top entry)

**Step 1: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc silent, lint silent, `Tests … passed`, `✓ Compiled successfully`.

**Step 2: Invariant spot-check** — run the invariant tests by name and confirm they are untouched by this work:

Run: `git diff --stat HEAD~12 -- tests/consent.test.ts tests/org-scope.test.ts tests/agent-window*.test.ts`
Expected: no output (no changes).

**Step 3: PROGRESS.md** — add at the top, above the 2026-09-18 entry:

```markdown
## AI follow-ups on the automation engine (2026-09-20) ✅

- Follow-ups are now a plain spec (situation → messages → stop rule) the AI
  drafts from a sentence or the business profile; a pure compiler turns it into
  the existing automation + library templates. Design:
  `docs/plans/2026-09-19-ai-followups-design.md`.
- Engine: `cancelWaitingRuns` ends a contact's pending chases on reply, booking,
  payment or opt-out (the pack's nudge used to fire after the lead had already
  replied); new `conversation_quiet` trigger evaluated on the cron tick, one
  chase per contact per follow-up.
- Page: one list of follow-up cards + a natural-language bar + "Write my starter
  set"; the founder org page has the same. Every draft lands OFF.
- Keyless simulation path is deterministic (pack copy), so the whole flow demos
  with zero keys. Drafting is metered as `followup_draft`.
- Still true: the cron is nightly, so waits fire at the next 03:00 run; the
  page says so. Restore `*/5 * * * *` once Vercel Pro is confirmed.
```

**Step 4: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: record AI follow-ups shipped"
```

---

## Done when

- `/automations` shows the bar, a starter-set button on first open, and one card per follow-up with a plain-English situation, its messages, a Meta-aware status chip, a switch, inline edit, builder link and delete.
- Typing a sentence and clicking **Draft it** yields an editable preview; **Create** saves it off, with its templates in `/templates` (approved instantly in test mode).
- Replying in the inbox simulator to a contact with a waiting chase marks that run `CANCELLED` in its run log.
- The nightly cron starts chases for quiet conversations and never starts a second one for the same contact.
- tsc, lint, 1,300-ish tests and the build are green; the seven invariant tests are unchanged.
