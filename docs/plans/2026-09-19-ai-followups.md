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
  specErrorMessage,
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

const booked = {
  name: "Booking thanks",
  situation: { kind: "booked" },
  messages: [{ afterDays: 0, category: "UTILITY", header: "Booked", body: "Hi {{1}}, you're booked.", footer: "" }],
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
    const r = parseFollowUpSpec(booked);
    expect(r.ok && r.spec.messages[0].footer).toBe("");
  });

  it("a booked spec with no stopOn defaults to booking only — neither a reply nor a payment ends it", () => {
    const r = parseFollowUpSpec(booked);
    expect(r.ok && r.spec.stopOn).toEqual(["booking"]);
  });

  it("a booked spec that names stopOn keeps it", () => {
    const r = parseFollowUpSpec({ ...booked, stopOn: ["reply"] });
    expect(r.ok && r.spec.stopOn).toEqual(["reply"]);
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

describe("specErrorMessage", () => {
  it("turns each field's zod complaint into a sentence the owner can act on", () => {
    expect(specErrorMessage("messages.0.body: Too big: expected string to have <=600 characters")).toBe(
      "Each message needs a body of 1–600 characters."
    );
    expect(specErrorMessage("messages.1.header: Too small: expected string to have >=1 characters")).toBe(
      "Each message needs a headline of 1–60 characters."
    );
    expect(specErrorMessage("messages.0.footer: Too big: expected string to have <=60 characters")).toBe(
      "Keep the footer under 60 characters."
    );
    expect(specErrorMessage("situation.afterDays: Expected int, received number")).toBe(
      "The timing has to be a whole number of days, up to 14."
    );
    expect(specErrorMessage("situation: Invalid discriminator value")).toBe(
      "We couldn't tell what should start that follow-up — try rewording it."
    );
    expect(specErrorMessage("messages: Too small: expected array to have >=1 items")).toBe(
      "A follow-up needs between one and 3 messages."
    );
    expect(specErrorMessage("name: Too big: expected string to have <=80 characters")).toBe(
      "Give the follow-up a short name (1–80 characters)."
    );
  });

  it("reads the leaf of the path, not a substring of it", () => {
    // "keywords" contains "word", "headerless" would contain "header": only the
    // last segment decides, and a nested situation field keeps its own sentence.
    expect(specErrorMessage("situation.keywords.0: Too small")).toBe(
      "We couldn't tell what should start that follow-up — try rewording it."
    );
    expect(specErrorMessage("messages.0.buttons.1.text: Too big")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
  });

  it("falls back to a plain sentence for anything else", () => {
    expect(specErrorMessage("spec: That follow-up isn't valid.")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
    expect(specErrorMessage("stopOn.0: Invalid option")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
    expect(specErrorMessage("")).toBe("That follow-up isn't valid — try rewording it.");
  });

  it("never leaks a raw zod string from a real parse failure", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], body: `Hi {{1}}, ${"x".repeat(700)}` }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const owner = specErrorMessage(r.error);
    expect(owner).toBe("Each message needs a body of 1–600 characters.");
    expect(owner).not.toContain("expected");
  });

  it("says what the field needs, not which way it is wrong — a cleared headline reads right too", () => {
    const r = parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], header: "   " }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(specErrorMessage(r.error)).toBe("Each message needs a headline of 1–60 characters.");
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
  const chase = { situation: { kind: "went_quiet", afterDays: 2 } };
  const afterBooking = { situation: { kind: "booked" }, stopOn: ["booking"] };

  it("a payment cancels a chase on its default stopOn, but not a booked follow-up on its default", () => {
    const b = parseFollowUpSpec(booked);
    const q = parseFollowUpSpec(quiet);
    expect(b.ok && q.ok).toBe(true);
    if (!b.ok || !q.ok) return;
    expect(shouldCancelOnSignal(b.spec, "payment")).toBe(false);
    expect(shouldCancelOnSignal(q.spec, "payment")).toBe(true);
  });
  it("an opt-out always cancels, whatever the spec says", () => {
    expect(shouldCancelOnSignal({ stopOn: [] }, "opt_out")).toBe(true);
    expect(shouldCancelOnSignal(afterBooking, "opt_out")).toBe(true);
  });
  it("a reply cancels a chase even when stopOn is empty", () => {
    expect(shouldCancelOnSignal({ ...chase, stopOn: [] }, "reply")).toBe(true);
    expect(shouldCancelOnSignal({ stopOn: ["booking"] }, "reply")).toBe(true);
  });
  it("a reply does not cancel a booked-situation follow-up unless its stopOn says so", () => {
    expect(shouldCancelOnSignal(afterBooking, "reply")).toBe(false);
    expect(shouldCancelOnSignal({ ...afterBooking, stopOn: ["reply", "booking"] }, "reply")).toBe(true);
  });
  it("honours stopOn for booking and payment, defaulting to cancel when there is no spec", () => {
    expect(shouldCancelOnSignal({ ...chase, stopOn: ["reply"] }, "booking")).toBe(false);
    expect(shouldCancelOnSignal({ ...chase, stopOn: ["reply", "payment"] }, "payment")).toBe(true);
    expect(shouldCancelOnSignal({ stopOn: ["reply"] }, "booking")).toBe(true);
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
import { LEAD_STAGES, MAX_QUIET_HOURS } from "@/modules/automation/definitions";
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
 *  reminder tick, not chained waits. Derived from the quiet trigger's cap so
 *  the two can never drift apart. */
export const MAX_GAP_DAYS = MAX_QUIET_HOURS / 24;

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
 * A booked spec that arrives without `stopOn` defaults to `["booking"]`, not
 * the schema's all-three: a booked customer is expected to reply and to pay a
 * deposit, and neither may end the reminder or review ask that follows — only
 * a new booking supersedes the old one's follow-up.
 */
export function parseFollowUpSpec(raw: unknown): SpecParseResult {
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const stopOnGiven = Array.isArray(candidate.stopOn);
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
  if (!stopOnGiven && spec.situation.kind === "booked") spec.stopOn = ["booking"];
  return { ok: true, spec };
}

/**
 * Owner-facing sentence for a spec that failed validation. The raw zod message
 * is precise but unreadable; the field is what the owner can fix. Matched on
 * the leaf segment of the path, not a substring of it, and worded as what the
 * field needs — a cleared field and an over-long one fail the same rule.
 */
export function specErrorMessage(error: string): string {
  const path = error.split(":")[0] ?? "";
  const leaf = path.split(".").pop() ?? "";
  if (leaf === "body") return "Each message needs a body of 1–600 characters.";
  if (leaf === "header") return "Each message needs a headline of 1–60 characters.";
  if (leaf === "footer") return "Keep the footer under 60 characters.";
  if (leaf === "afterDays") return `The timing has to be a whole number of days, up to ${MAX_GAP_DAYS}.`;
  if (path === "messages") return `A follow-up needs between one and ${MAX_MESSAGES} messages.`;
  if (path.startsWith("situation")) return "We couldn't tell what should start that follow-up — try rewording it.";
  if (leaf === "name") return "Give the follow-up a short name (1–80 characters).";
  return "That follow-up isn't valid — try rewording it.";
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
const cancelPolicySchema = followUpSpecSchema.pick({ situation: true, stopOn: true });

/**
 * Does this signal end a pending chase? An opt-out always does — the customer
 * told us to stop. A reply ends every chase (the customer is talking to us),
 * with one exception: a follow-up built on the `booked` situation keeps going
 * unless its stopOn names `reply` — a booked customer is expected to reply,
 * and that must not cancel the reminder or review ask. Booking and payment
 * are the owner's choice via stopOn; a booked spec's default stopOn is
 * `["booking"]` alone, so paying a deposit does not end it either. An
 * automation with no spec (hand-built) takes the safe default and cancels on
 * everything.
 */
export function shouldCancelOnSignal(rawSpec: unknown, signal: CancelSignal): boolean {
  if (signal === "opt_out") return true;
  const parsed = cancelPolicySchema.safeParse(rawSpec);
  if (!parsed.success) return true; // hand-built automation: cancel on everything
  const { situation, stopOn } = parsed.data;
  // A booked customer is expected to reply ("thanks, see you then"); that must
  // not cancel the reminder or review ask that follows the booking.
  if (signal === "reply") return situation.kind !== "booked" || stopOn.includes("reply");
  return stopOn.includes(signal);
}
```

Cancel policy (founder decision 2026-09-20, after Task 6 shipped): a reply cancels every chase situation whatever `stopOn` says, but NOT a follow-up on the `booked` situation unless its `stopOn` names `reply` — "thanks, see you then" after booking was cancelling the reminder and the review ask. `shouldCancelOnSignal` therefore parses `situation` as well as `stopOn` (`cancelPolicySchema`), and `parseFollowUpSpec` defaults a booked spec that arrives without `stopOn` to `["booking"]` rather than the schema's all-three — a payment must not end a booked follow-up either (a deposit paid right after booking was killing the review ask; same founder decision), so only a new booking supersedes the old one's follow-up. A spec with no parseable situation (a hand-built automation) still cancels on everything. Task 8's drafter must follow suit: its booked starters carry `stopOn: ["booking"]` and the AI prompt tells the model to omit `stopOn` for booked situations.

**Step 4: Run to verify it passes**

Run: `npx vitest run tests/followup-spec.test.ts`
Expected: PASS, 18 tests.

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

Four contract decisions, found in review and baked into the code below:

1. **Template identity is per automation, not per name.** The automation row is created FIRST (off, step-less — `matchAutomations` skips step-less automations, so it is inert), template names are keyed on the automation id's last 8 chars, and an update pins names from the templates the automation's existing `send_template` steps already point at — only when the automation has a `spec` (a builder-made automation's steps may reference shared library templates that must not be overwritten). Otherwise a wording edit or a rename would upsert new templates and orphan the approved ones, and two same-named follow-ups would silently overwrite each other's copy.
2. **`componentsJson` stores Meta's components ARRAY.** `buildTemplatePayload(...)` returns `{ name, language, category, components }`; the old installer stored the whole object and `submitRowToMeta` sends it as `components:` — every live submission would have been rejected (simulation hid it by auto-approving). Fixed here and in the identical line in `src/modules/concierge/index.ts`; `src/modules/demo/seed.ts` is simulation-only and left alone.
3. **The pack nudge is create-only.** Owners can edit its wording, so re-running the installer (which the starter-set action will do) must not overwrite their edits. A legacy campaign-reply install (`spec === null` — there was no UI to edit it) is upgraded in place, keeping its id and switch.
4. **No single transaction across Meta.** Template creation calls Meta, so the ordering is: automation row (off, empty) → templates → steps (one transaction). A Meta failure leaves an off, empty automation rather than orphaned templates. The design doc's "one transaction" sentence is replaced accordingly.

**Files:**
- Rewrite: `src/modules/followup/install.ts`
- Modify: `src/modules/followup/pack.ts` (replace `leadNudgeAutomation` with `PACK_LEAD_NUDGE_SPEC`; drop `leadNudge` from `FOLLOW_UP_FLAGS`/`FOLLOW_UP_KINDS`)
- Modify: `src/modules/concierge/index.ts` (one line, the `componentsJson` shape)
- Modify: `tests/followup-pack.test.ts`
- Create: `tests/followup-install.test.ts`
- Modify (minimal, to keep tsc green): `src/app/(app)/automations/page.tsx`, `src/app/(app)/automations/follow-up-rows.tsx`
- Modify: `docs/plans/2026-09-19-ai-followups-design.md` (the transaction sentence in §3; the per-automation naming sentence in §1)

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

Change the first "owner-facing follow-up rows" test so the quiet nudge is no longer expected as a row:

```ts
  it("surfaces every tick-driven pack template; the nudge lives on its own card", () => {
    const listed = FOLLOW_UP_KINDS.flatMap((k) => k.templateNames).sort();
    expect([...listed, ...PACK_LEAD_NUDGE_TEMPLATE_NAMES].sort()).toEqual(
      PACK_TEMPLATES.map((t) => t.name).sort()
    );
  });
```

Update the import at the top: remove `leadNudgeAutomation`; add `PACK_LEAD_NUDGE_SPEC, PACK_LEAD_NUDGE_TEMPLATE_NAMES` from pack, `parseFollowUpSpec` from `@/modules/followup/spec`, `compileFollowUp` from `@/modules/followup/compile`.

**Step 2: Write the installer tests**

Create `tests/followup-install.test.ts` (prisma, `orgSendMode` and `submitRowToMeta` mocked; `m.calls` records call order):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  automationFindFirst: vi.fn(),
  automationCreate: vi.fn(),
  automationUpdate: vi.fn(),
  stepDeleteMany: vi.fn(),
  stepCreateMany: vi.fn(),
  runUpdateMany: vi.fn(),
  configUpsert: vi.fn(),
  tx: vi.fn(),
  sendMode: vi.fn(),
  submit: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    template: { findFirst: m.templateFindFirst, findMany: m.templateFindMany, create: m.templateCreate, update: m.templateUpdate },
    automation: { findFirst: m.automationFindFirst, create: m.automationCreate, update: m.automationUpdate },
    automationStep: { deleteMany: m.stepDeleteMany, createMany: m.stepCreateMany },
    automationRun: { updateMany: m.runUpdateMany },
    followUpConfig: { upsert: m.configUpsert },
    $transaction: m.tx,
  },
}));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode: m.sendMode }));
vi.mock("@/modules/whatsapp/library", () => ({ submitRowToMeta: m.submit }));

import { installRevenueRecoveryPack, saveFollowUpFromSpec } from "@/modules/followup/install";
import type { FollowUpSpec } from "@/modules/followup/spec";

const spec: FollowUpSpec = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [] },
    { afterDays: 3, category: "MARKETING", header: "One last note", body: "Hi {{1}}, here when ready.", footer: "Reply STOP to unsubscribe", buttons: [] },
  ],
  stopOn: ["reply", "booking", "payment"],
};

let seq = 0;
beforeEach(() => {
  for (const fn of Object.values(m)) if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  m.calls.length = 0;
  seq = 0;
  m.sendMode.mockResolvedValue("simulation");
  m.tx.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  m.templateFindFirst.mockImplementation(async () => { m.calls.push("template.findFirst"); return null; });
  m.templateCreate.mockImplementation(async ({ data }) => { m.calls.push("template.create"); return { id: `t${++seq}`, ...data }; });
  m.templateUpdate.mockImplementation(async ({ where, data }) => { m.calls.push("template.update"); return { id: where.id, ...data }; });
  m.automationCreate.mockImplementation(async () => { m.calls.push("automation.create"); return { id: "cmauto0000000abcdefgh" }; });
  m.automationUpdate.mockImplementation(async () => { m.calls.push("automation.update"); return {}; });
  m.stepDeleteMany.mockResolvedValue({ count: 0 });
  m.stepCreateMany.mockImplementation(async () => { m.calls.push("step.createMany"); return { count: 0 }; });
  m.runUpdateMany.mockResolvedValue({ count: 0 });
  m.configUpsert.mockResolvedValue({});
  m.templateFindMany.mockResolvedValue([]);
});

describe("saveFollowUpFromSpec — create", () => {
  it("writes the automation first (off, no steps), keys template names on its id, then steps", async () => {
    const { id } = await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    expect(id).toBe("cmauto0000000abcdefgh");
    expect(m.calls.indexOf("automation.create")).toBeLessThan(m.calls.indexOf("template.findFirst"));
    expect(m.calls.indexOf("template.create")).toBeLessThan(m.calls.indexOf("step.createMany"));
    const created = m.automationCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ orgId: "o1", enabled: false, source: "ai", trigger: "conversation_quiet" });
    expect(created.spec).toEqual(spec);
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name);
    expect(names).toEqual(["fu_pricing_chase_abcdefgh_1", "fu_pricing_chase_abcdefgh_2"]);
    // Nothing can be waiting on a brand-new automation.
    expect(m.runUpdateMany).not.toHaveBeenCalled();
  });

  it("stores the Meta components ARRAY, not the whole payload, and resolves templateId into the steps", async () => {
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    for (const c of m.templateCreate.mock.calls) expect(Array.isArray(c[0].data.componentsJson)).toBe(true);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(["send_template", "wait", "send_template"]);
    expect(steps[0].config).toEqual({ templateId: "t1" });
    expect(steps[2].config).toEqual({ templateId: "t2" });
    expect(steps.every((s: { automationId: string }) => s.automationId === "cmauto0000000abcdefgh")).toBe(true);
  });

  it("can create it switched on when the caller says so (the pack)", async () => {
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "pack", enabled: true, name: "Custom name" });
    expect(m.automationCreate.mock.calls[0][0].data).toMatchObject({ enabled: true, name: "Custom name" });
  });
});

describe("saveFollowUpFromSpec — update", () => {
  const existing = {
    id: "cmauto0000000abcdefgh",
    orgId: "o1",
    spec: { ...spec },
    steps: [
      { order: 1, kind: "send_template", config: { templateId: "old1" } },
      { order: 2, kind: "wait", config: { minutes: 4320 } },
      { order: 3, kind: "send_template", config: { templateId: "old2" } },
    ],
  };

  it("keeps the templates a spec-backed automation already sends, even after a rename", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    m.templateFindMany.mockResolvedValue([{ id: "old1", name: "lead_nudge_1" }, { id: "old2", name: "lead_nudge_2" }]);
    m.templateFindFirst.mockImplementation(async ({ where }) => ({ id: where.name === "lead_nudge_1" ? "old1" : "old2", name: where.name, content: {}, metaStatus: "APPROVED", metaTemplateId: "x" }));
    await saveFollowUpFromSpec({ orgId: "o1", spec: { ...spec, name: "Renamed chase" }, source: "ai", automationId: existing.id });
    expect(m.templateCreate).not.toHaveBeenCalled();
    expect(m.templateUpdate.mock.calls.map((c) => c[0].where.id)).toEqual(["old1", "old2"]);
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.stepDeleteMany).toHaveBeenCalledWith({ where: { automationId: existing.id } });
    expect(m.automationUpdate.mock.calls[0][0].data).toMatchObject({ name: "Renamed chase", source: "ai" });
    // A run waiting on the old steps would otherwise resume against the new list.
    expect(m.runUpdateMany).toHaveBeenCalledWith({
      where: { automationId: existing.id, status: "WAITING" },
      data: { status: "CANCELLED", resumeAt: null },
    });
    expect(m.calls.indexOf("template.update")).toBeLessThan(m.calls.indexOf("step.createMany"));
  });

  it("pins only what it can: a shorter templateNames list derives the rest from the key", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    const three = { ...spec, messages: [...spec.messages, { ...spec.messages[1], header: "Last call" }] };
    await saveFollowUpFromSpec({ orgId: "o1", spec: three, source: "ai", automationId: existing.id, templateNames: ["lead_nudge_1", "lead_nudge_2"] });
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["lead_nudge_1", "lead_nudge_2", "fu_pricing_chase_abcdefgh_3"]);
  });

  it("falls back to the derived name for a pinned step whose template row is gone", async () => {
    m.automationFindFirst.mockResolvedValue(existing);
    m.templateFindMany.mockResolvedValue([{ id: "old1", name: "lead_nudge_1" }]);
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai", automationId: existing.id });
    expect(m.templateFindMany.mock.calls[0][0].where).toMatchObject({ orgId: "o1", id: { in: ["old1", "old2"] } });
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["lead_nudge_1", "fu_pricing_chase_abcdefgh_2"]);
  });

  it("never pins onto a builder-made automation's steps (they may be shared library templates)", async () => {
    m.automationFindFirst.mockResolvedValue({ ...existing, spec: null });
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai", automationId: existing.id });
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name)).toEqual(["fu_pricing_chase_abcdefgh_1", "fu_pricing_chase_abcdefgh_2"]);
  });

  it("refuses an automation outside the org", async () => {
    m.automationFindFirst.mockResolvedValue(null);
    await expect(saveFollowUpFromSpec({ orgId: "o2", spec, source: "ai", automationId: "nope" })).rejects.toThrow(/not found/i);
  });
});

describe("live mode template handling", () => {
  it("keeps an unchanged row's approval and resubmits changed copy", async () => {
    m.sendMode.mockResolvedValue("live");
    const unchangedContent = { productName: "Pricing chase — message 1", campaignAngle: "Follow-up.", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "Reply STOP to unsubscribe", buttons: [], sampleName: "Priya", imageTreatment: "", notes: "Created from a follow-up." };
    m.templateFindFirst.mockImplementation(async ({ where }) =>
      where.name.endsWith("_1")
        ? { id: "k1", name: where.name, category: "MARKETING", content: unchangedContent, metaStatus: "APPROVED", metaTemplateId: "meta-1" }
        : { id: "k2", name: where.name, category: "MARKETING", content: { stale: true }, metaStatus: "APPROVED", metaTemplateId: "meta-2" }
    );
    m.submit.mockResolvedValue({});
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    const [first, second] = m.templateUpdate.mock.calls.map((c) => c[0].data);
    expect(first).toMatchObject({ metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    // The Meta id survives a copy change: the edit endpoint will need it.
    expect(second).toMatchObject({ metaStatus: "PENDING", metaTemplateId: "meta-2" });
    expect(m.submit).toHaveBeenCalledTimes(1);
  });

  it("treats a jsonb-reordered row with the same copy as unchanged (metadata differences ignored)", async () => {
    m.sendMode.mockResolvedValue("live");
    // Keys as Postgres jsonb stores them (by length, then bytes), with different
    // productName/notes — what Meta reviews is identical.
    const stored = {
      body: "Hi {{1}}, any questions?",
      notes: "Edited in the library.",
      footer: "Reply STOP to unsubscribe",
      header: "Still deciding?",
      buttons: [],
      sampleName: "Priya",
      productName: "Old name",
      campaignAngle: "Follow-up.",
      imageTreatment: "",
    };
    m.templateFindFirst.mockResolvedValue({ id: "k1", name: "fu_pricing_chase_abcdefgh_1", category: "MARKETING", content: stored, metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    await saveFollowUpFromSpec({ orgId: "o1", spec: { ...spec, messages: [spec.messages[0]] }, source: "ai" });
    expect(m.templateUpdate).toHaveBeenCalledTimes(1);
    expect(m.templateUpdate.mock.calls[0][0].data).toMatchObject({ metaStatus: "APPROVED", metaTemplateId: "meta-1" });
    expect(m.submit).not.toHaveBeenCalled();
  });

  it("records a Meta refusal on the row, keeps going, and still wires the step", async () => {
    m.sendMode.mockResolvedValue("live");
    m.submit.mockRejectedValue(new Error("Meta said no"));
    await saveFollowUpFromSpec({ orgId: "o1", spec, source: "ai" });
    expect(m.submit).toHaveBeenCalledTimes(2);
    expect(m.templateUpdate.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "t1" }, data: { metaStatus: "REJECTED", rejectionReason: "Meta said no" } },
      { where: { id: "t2" }, data: { metaStatus: "REJECTED", rejectionReason: "Meta said no" } },
    ]);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps[0].config).toEqual({ templateId: "t1" });
    expect(steps[2].config).toEqual({ templateId: "t2" });
  });
});

describe("installRevenueRecoveryPack", () => {
  it("creates the nudge once, switched on, with its historical template names — and never overwrites it", async () => {
    m.automationFindFirst.mockResolvedValueOnce(null);
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).toHaveBeenCalledTimes(1);
    expect(m.automationCreate.mock.calls[0][0].data).toMatchObject({ enabled: true, source: "pack", name: "Revenue Recovery — quiet-lead nudge" });
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name).sort();
    expect(names).toEqual(["appt_reminder_24h", "appt_reminder_2h", "lead_nudge_1", "lead_nudge_2", "no_show_rebook", "review_ask"]);
    expect(m.configUpsert).toHaveBeenCalled();

    vi.clearAllMocks();
    m.sendMode.mockResolvedValue("simulation");
    m.automationFindFirst.mockResolvedValueOnce({ id: "existing", spec });
    m.templateFindFirst.mockResolvedValue(null);
    m.templateCreate.mockImplementation(async ({ data }) => ({ id: "t", ...data }));
    m.configUpsert.mockResolvedValue({});
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.automationUpdate).not.toHaveBeenCalled();
    expect(m.templateCreate.mock.calls.map((c) => c[0].data.name).some((n: string) => n.startsWith("lead_nudge"))).toBe(false);
  });

  it("upgrades a legacy campaign-reply install (no spec) in place, keeping its id and switch", async () => {
    const legacy = {
      id: "legacy",
      orgId: "o1",
      spec: null,
      steps: [
        { order: 1, kind: "wait", config: { minutes: 4320 } },
        { order: 2, kind: "send_template", config: { templateId: "old1" } },
        { order: 3, kind: "wait", config: { minutes: 4320 } },
        { order: 4, kind: "send_template", config: { templateId: "old2" } },
      ],
    };
    // Looked up twice: the installer's own check, then saveFollowUpFromSpec's update path.
    m.automationFindFirst.mockResolvedValueOnce({ id: "legacy", spec: null }).mockResolvedValueOnce(legacy);
    await installRevenueRecoveryPack("o1");
    expect(m.automationCreate).not.toHaveBeenCalled();
    expect(m.templateFindMany).not.toHaveBeenCalled();
    expect(m.runUpdateMany).toHaveBeenCalledWith({
      where: { automationId: "legacy", status: "WAITING" },
      data: { status: "CANCELLED", resumeAt: null },
    });
    expect(m.stepDeleteMany).toHaveBeenCalledWith({ where: { automationId: "legacy" } });
    const update = m.automationUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: "legacy" });
    expect(update.data).toMatchObject({ trigger: "conversation_quiet", source: "pack", name: "Revenue Recovery — quiet-lead nudge" });
    expect(update.data).not.toHaveProperty("enabled");
    const names = m.templateCreate.mock.calls.map((c) => c[0].data.name);
    expect(names.filter((n: string) => n.startsWith("lead_nudge"))).toEqual(["lead_nudge_1", "lead_nudge_2"]);
    expect(names.some((n: string) => n.startsWith("fu_"))).toBe(false);
    const steps = m.stepCreateMany.mock.calls[0][0].data;
    expect(steps.map((s: { kind: string }) => s.kind)).toEqual(["send_template", "wait", "send_template"]);
    expect(steps.every((s: { automationId: string }) => s.automationId === "legacy")).toBe(true);
  });
});
```

**Step 3: Run to verify it fails**

Run: `npx vitest run tests/followup-pack.test.ts tests/followup-install.test.ts`
Expected: FAIL — `PACK_LEAD_NUDGE_SPEC` not exported; `saveFollowUpFromSpec` not exported.

**Step 4: Implement — pack.ts**

Remove the `leadNudgeAutomation` function, `PackAutomation` interface and `THREE_DAYS_MIN`. Remove `"leadNudge"` from `FOLLOW_UP_FLAGS` and delete the `leadNudge` entry from `FOLLOW_UP_KINDS` (and the `editableInBuilder` field from the interface — nothing uses it now). Add `import type { FollowUpSpec } from "@/modules/followup/spec";` beside the other imports and append:

```ts
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

(`PACK_TEMPLATES` lists `lead_nudge_1` before `lead_nudge_2`, so the `map` index is the message order.)

**Step 5: Implement — install.ts**

Rewrite the file:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import type { CampaignContent } from "@/modules/campaign/schema";
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

/** Template names are keyed on the automation so two follow-ups with the same
 *  name never share (and overwrite) a template. cuids are lowercase base36,
 *  so the tail is already Meta-safe. */
const templateKey = (automationId: string) => automationId.slice(-8);

/** What Meta reviews, independent of key order — jsonb reorders object keys,
 *  so a raw JSON.stringify of the stored row never equals a fresh one. */
function templateFingerprint(category: string, content: unknown): string {
  const c = (content ?? {}) as Partial<CampaignContent>;
  return JSON.stringify([
    category,
    c.header ?? "",
    c.body ?? "",
    c.footer ?? "",
    (c.buttons ?? []).map((b) => [b.type, b.text, "url" in b ? b.url : ""]),
  ]);
}

/**
 * Create/refresh library templates by name. Test mode approves them
 * immediately (so the demo works). Live: an unchanged row keeps its approval;
 * changed copy is marked PENDING and resubmitted — note submitRowToMeta
 * currently only creates, so for an existing name Meta re-syncs the OLD
 * template's status and the new copy does not reach Meta until edit-in-place
 * lands (see plan: Deferred). A refusal is recorded on the row so the owner
 * can fix and resubmit.
 */
export async function ensureLibraryTemplates(
  orgId: string,
  templates: CompiledTemplate[]
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of templates) {
    // Meta takes the components array; name/language/category travel beside it.
    const componentsJson = buildTemplatePayload(t.content, { name: t.name })
      .components as Prisma.InputJsonValue;
    const content = t.content as unknown as Prisma.InputJsonValue;
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    const unchanged =
      existing !== null &&
      templateFingerprint(existing.category, existing.content) ===
        templateFingerprint(t.category, t.content);
    const data = {
      language: "en",
      category: t.category,
      content,
      componentsJson,
      metaStatus: approve
        ? ("APPROVED" as const)
        : unchanged
          ? existing.metaStatus
          : ("PENDING" as const),
      // Kept across a copy change: Meta's edit endpoint will need it.
      metaTemplateId: approve ? `sim-tpl-${t.name}` : (existing?.metaTemplateId ?? null),
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

/** The template names a spec-backed automation already sends, in step order,
 *  so an edit re-uses (and re-approves) those rows instead of orphaning them. */
async function pinnedTemplateNames(
  orgId: string,
  steps: Array<{ kind: string; config: unknown }>
): Promise<string[]> {
  const ids = steps
    .filter((s) => s.kind === "send_template")
    .map((s) => String((s.config as { templateId?: unknown })?.templateId ?? ""))
    .filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.template.findMany({
    where: { orgId, id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => nameById.get(id) ?? "");
}

/**
 * Persist a spec as an automation + its templates. The automation row is
 * written first — off and step-less, which the engine ignores — so its id can
 * key the template names and a Meta failure leaves nothing half-wired. Then
 * the templates, then the steps. Creates land OFF unless `enabled` says
 * otherwise; updates keep the current switch.
 */
export async function saveFollowUpFromSpec(opts: {
  orgId: string;
  spec: FollowUpSpec;
  source: FollowUpSource;
  automationId?: string;
  name?: string;
  templateNames?: string[];
  enabled?: boolean;
}): Promise<{ id: string }> {
  const n = opts.spec.messages.length;
  const automationFields = {
    name: opts.name ?? opts.spec.name,
    description: `${n} message${n === 1 ? "" : "s"}`,
    spec: opts.spec as unknown as Prisma.InputJsonValue,
    source: opts.source,
  };

  let id = opts.automationId;
  let pinned = opts.templateNames ?? [];
  if (id) {
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: opts.orgId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!existing) throw new Error("Follow-up not found.");
    if (!pinned.length && existing.spec !== null) {
      pinned = await pinnedTemplateNames(opts.orgId, existing.steps);
    }
  } else {
    const { trigger, triggerConfig } = compileFollowUp(opts.spec);
    const created = await prisma.automation.create({
      data: {
        orgId: opts.orgId,
        enabled: opts.enabled ?? false,
        trigger,
        triggerConfig: triggerConfig as Prisma.InputJsonValue,
        ...automationFields,
      },
      select: { id: true },
    });
    id = created.id;
  }

  const compiled = compileFollowUp(opts.spec, { templateNames: pinned, key: templateKey(id) });
  const ids = await ensureLibraryTemplates(opts.orgId, compiled.templates);
  const automationId = id;
  const steps = compiled.steps.map((s, i) => ({
    automationId,
    order: i + 1,
    kind: s.kind,
    config: (s.kind === "send_template"
      ? { templateId: ids.get(s.config.templateName) }
      : s.config) as Prisma.InputJsonValue,
  }));
  // A run waiting on the old steps would resume against the new list.
  const cancelWaiting = opts.automationId
    ? [
        prisma.automationRun.updateMany({
          where: { automationId, status: "WAITING" },
          data: { status: "CANCELLED", resumeAt: null },
        }),
      ]
    : [];
  await prisma.$transaction([
    ...cancelWaiting,
    prisma.automationStep.deleteMany({ where: { automationId } }),
    prisma.automation.update({
      where: { id: automationId },
      data: {
        ...automationFields,
        trigger: compiled.trigger,
        triggerConfig: compiled.triggerConfig as Prisma.InputJsonValue,
      },
    }),
    prisma.automationStep.createMany({ data: steps }),
  ]);
  return { id: automationId };
}

/**
 * One-toggle install of the Revenue-Recovery pack for an org: the tick-driven
 * templates, the quiet-lead nudge as a spec, and an enabled FollowUpConfig.
 * The tick-driven templates are re-written from PACK_TEMPLATES on every run.
 * The nudge is created once; a legacy campaign-reply install (no spec) is
 * upgraded in place; a spec-backed one is the owner's and never overwritten.
 * Idempotent.
 */
export async function installRevenueRecoveryPack(orgId: string): Promise<void> {
  await ensureLibraryTemplates(
    orgId,
    PACK_TEMPLATES.filter((t) => !PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name))
  );
  const nudge = await prisma.automation.findFirst({
    where: { orgId, name: LEAD_NUDGE_NAME },
    select: { id: true, spec: true },
  });
  // No spec means a legacy install from before there was any UI to edit it, so
  // upgrading keeps its id and switch. A fresh one starts ON: it is the moat
  // the plan is sold on and its copy was written and reviewed by us.
  if (!nudge || nudge.spec === null) {
    await saveFollowUpFromSpec({
      orgId,
      spec: PACK_LEAD_NUDGE_SPEC,
      source: "pack",
      name: LEAD_NUDGE_NAME,
      templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES,
      ...(nudge ? { automationId: nudge.id } : { enabled: true }),
    });
  }
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
export async function setFollowUpTiming(
  orgId: string,
  raw: Partial<FollowUpTiming>
): Promise<FollowUpTiming> {
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

/** The pack's templates for this org, by template name — for the "edit the
 *  wording" links on the follow-ups page. */
export async function getPackTemplateIds(
  orgId: string
): Promise<Map<string, { id: string; metaStatus: string }>> {
  const rows = await prisma.template.findMany({
    where: {
      orgId,
      campaignId: null,
      name: { in: PACK_TEMPLATES.map((t) => t.name) },
    },
    select: { id: true, name: true, metaStatus: true },
  });
  return new Map(rows.map((r) => [r.name, { id: r.id, metaStatus: r.metaStatus }]));
}
```

**Step 6: The same `componentsJson` fix in concierge**

In `src/modules/concierge/index.ts` (`installVerticalPack`), change the `componentsJson` assignment to `buildTemplatePayload(t.content, { name: t.name }).components as Prisma.InputJsonValue`. No test asserts the old shape.

**Step 7: Keep tsc green on the page**

`src/app/(app)/automations/page.tsx` computed `builderHref` from `kind.editableInBuilder` (and `packAutomation` only fed it); `follow-up-rows.tsx` declared and rendered `builderHref` (and imported `Workflow` only for it). Remove all of that and nothing else — Task 10 rewrites the page.

**Step 8: Docs**

In `docs/plans/2026-09-19-ai-followups-design.md` §3, replace "templates + automation are then written in one transaction" with the real ordering (automation row first, off and step-less; then templates to Meta; then steps). In §1 append: "Template names are keyed on the automation id, and an edit re-uses the templates the automation already sends, so renames never orphan approved templates; the pack's nudge keeps its historical `lead_nudge_1/2` names."

**Step 9: Verify**

Run: `npx vitest run tests/followup-pack.test.ts tests/followup-install.test.ts tests/followup-compile.test.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: PASS, tsc silent. `grep -rn "leadNudge" src/` still finds the admin org page reading `config.leadNudge` for a founder status dot and `modules/admin/concierge.ts` selecting the column — the column still exists; leave both (Task 11 revisits the admin page).

**Step 10: Commit**

```bash
git add src/modules/followup/install.ts src/modules/followup/pack.ts src/modules/concierge/index.ts tests/followup-pack.test.ts tests/followup-install.test.ts "src/app/(app)/automations/page.tsx" "src/app/(app)/automations/follow-up-rows.tsx" docs/plans/2026-09-19-ai-followups.md docs/plans/2026-09-19-ai-followups-design.md
git commit -m "feat(followups): install follow-ups from specs; the pack nudge becomes a went_quiet spec

Template names are keyed on the automation id and an edit re-uses the
templates the automation already sends, so renames never orphan approved
copy. Stores Meta's components array (not the whole payload) as
componentsJson — the previous shape would have been rejected live. The
pack nudge is created once and never overwritten."
```

---

### Task 6: Cancel-on-reply in the engine, wired at the four signal sites

**Files:**
- Modify: `src/modules/automation/engine.ts` (append near `tickAutomationRuns`)
- Modify: `src/modules/agent/inbound.ts` (~line 72 opt-out; ~line 126 before `runInboundAutomations`)
- Modify: `src/modules/agent/tools/capture-booking.ts:109`
- Modify: `src/modules/payments/index.ts:158`
- Modify: `src/app/(app)/contacts/actions.ts` (`optOutContact` — the fifth site, staff manual opt-out)
- Modify: `src/app/(app)/automations/automations-list.tsx:34` (`RUN_TONES`) and `src/app/(app)/automations/[id]/runs/runs-table.tsx:33` (`STATUS_TONES`); `run-log.tsx` (label for `cancel` entries); `meta.ts` (wait step description)
- Test: `tests/followup-cancel.test.ts` (new); `tests/credit-gating.test.ts` (engine mock gains `cancelWaitingRuns`; ordering + STOP cases); `tests/multi-number-routing.test.ts` (engine mock); `tests/payment-link.test.ts` (prisma mock gains `automationRun`; asserts the WAITING lookup)

**Step 1: Write the failing test**

```ts
// tests/followup-cancel.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findRuns, claimRun } = vi.hoisted(() => ({
  findRuns: vi.fn(),
  claimRun: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { automationRun: { findMany: findRuns, updateMany: claimRun } },
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage: vi.fn() }));

import { cancelWaitingRuns } from "@/modules/automation/engine";

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

// Shaped like the engine's select: the log is whatever Postgres holds.
const runs = [
  {
    id: "r1",
    currentStep: 1,
    log: [],
    automation: { spec: { situation: { kind: "went_quiet", afterDays: 2 }, stopOn: ["reply"] } },
  },
  {
    id: "r2",
    currentStep: 1,
    log: [{ step: 1, kind: "wait", ok: true, detail: "", at: "" }],
    automation: { spec: null },
  },
];

beforeEach(() => {
  errorLog.mockClear();
  claimRun.mockReset().mockResolvedValue({ count: 1 });
  findRuns.mockResolvedValue(runs);
});

describe("cancelWaitingRuns", () => {
  it("only looks at this org + contact's WAITING runs", async () => {
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(findRuns.mock.calls[0][0].where).toMatchObject({ orgId: "o1", contactId: "c1", status: "WAITING" });
  });

  it("a reply cancels every waiting run — claimed atomically, with a log line for the step that was next", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "reply");
    expect(n).toBe(2);
    expect(claimRun).toHaveBeenCalledTimes(2);
    const second = claimRun.mock.calls[1][0];
    expect(second.where).toEqual({ id: "r2", status: "WAITING" });
    expect(second.data.status).toBe("CANCELLED");
    expect(second.data.resumeAt).toBeNull();
    expect(second.data.log).toHaveLength(2);
    expect(second.data.log[1]).toMatchObject({ step: 2, kind: "cancel", ok: true });
    expect(second.data.log[1].detail).toMatch(/replied/i);
  });

  it("a booking honours stopOn: skips the spec that excludes it, cancels the spec-less run", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "booking");
    expect(n).toBe(1);
    expect(claimRun.mock.calls[0][0].where).toEqual({ id: "r2", status: "WAITING" });
  });

  it("an opt-out cancels everything regardless of stopOn", async () => {
    const n = await cancelWaitingRuns("o1", "c1", "opt_out");
    expect(n).toBe(2);
    expect(claimRun.mock.calls[0][0].data.log[0].detail).toMatch(/opted out/i);
  });

  it("a run the tick claimed first (count 0) is not counted as cancelled", async () => {
    claimRun.mockResolvedValueOnce({ count: 0 });
    await expect(cancelWaitingRuns("o1", "c1", "reply")).resolves.toBe(1);
    expect(claimRun).toHaveBeenCalledTimes(2);
  });

  it("one bad row is logged and skipped — the rest still cancel", async () => {
    claimRun.mockRejectedValueOnce(new Error("row locked"));
    await expect(cancelWaitingRuns("o1", "c1", "reply")).resolves.toBe(1);
    expect(claimRun).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it("a corrupt log is replaced by exactly the cancel entry", async () => {
    findRuns.mockResolvedValue([{ id: "r3", currentStep: 1, log: "garbage", automation: { spec: null } }]);
    await cancelWaitingRuns("o1", "c1", "reply");
    expect(claimRun.mock.calls[0][0].data.log).toEqual([
      { step: 2, kind: "cancel", ok: true, detail: "Cancelled — the customer replied.", at: expect.any(String) },
    ]);
  });

  it("never throws — a database error is logged and returns 0", async () => {
    findRuns.mockRejectedValueOnce(new Error("db down"));
    await expect(cancelWaitingRuns("o1", "c1", "payment")).resolves.toBe(0);
    expect(errorLog).toHaveBeenCalledTimes(1);
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
 * that is waiting to message them. An opt-out always cancels; a reply cancels
 * every chase but not a booked follow-up (see shouldCancelOnSignal); booking
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
      select: { id: true, currentStep: true, log: true, automation: { select: { spec: true } } },
    });
    let cancelled = 0;
    for (const run of waiting) {
      if (!shouldCancelOnSignal(run.automation.spec, signal)) continue;
      const log = [
        ...normalizeLogEntries(run.log),
        logEntry(run.currentStep + 1, "cancel", true, CANCEL_DETAIL[signal]),
      ];
      try {
        // Claim atomically, mirroring the tick: a run the tick has already
        // moved to RUNNING is past cancelling and must not be overwritten.
        const claimed = await prisma.automationRun.updateMany({
          where: { id: run.id, status: "WAITING" },
          data: { status: "CANCELLED", resumeAt: null, log: toJson(log) },
        });
        if (claimed.count === 1) cancelled++;
      } catch (error) {
        console.error(`[automations] cancelWaitingRuns: run ${run.id} not cancelled`, error);
      }
    }
    return cancelled;
  } catch (error) {
    console.error("[automations] cancelWaitingRuns failed", error);
    return 0;
  }
}
```

(`normalizeLogEntries`, `logEntry` and `toJson` already live in the engine — nothing else to import.) The per-run write is the tick's claim in reverse — `updateMany` guarded on `status: "WAITING"` — so cancel and tick can never both win the same run: whichever lands second matches zero rows. A run the tick already moved to RUNNING is past cancelling (its message is in flight); a plain `update` would have flipped it to CANCELLED with a stale log and let the next step write flip it straight back. The cancel log entry is numbered `currentStep + 1`, the step that was about to run — the same convention the tick's resume entries use. Import-cycle check: `followup/spec.ts` pulls in only `automation/definitions` (pure) and the campaign schema/guardrails, and nothing reachable from the engine (`messaging`, `consent`, `orgs`, `whatsapp`, `integrations`, `campaign`, `followup`, `agent/window`, `lib`) imports `payments`, `agent/inbound` or `agent/tools` — verified with a grep, acyclic.

**Step 4: Wire the five signal sites**

`src/modules/agent/inbound.ts` — add `cancelWaitingRuns` to the existing import from `@/modules/automation/engine` (the file already imports `runInboundAutomations` from it), then:

- Directly **after** the `recordContactEvent(orgId, "opted_out", { … })` call and **before** the block's early `return { optedOut: true };` (~line 76). The opt-out block returns straight away, so a cancel placed after the block would never run:
  ```ts
    await cancelWaitingRuns(orgId, contact.id, "opt_out");
  ```
- Directly **before** the comment block that introduces `const automations = await runInboundAutomations(orgId, {` (~line 123), so a reply can never cancel the run it is about to start:
  ```ts
  // The customer is talking to us again — nothing should keep chasing them.
  // Runs before the dispatch so a reply can never cancel the run it starts.
  await cancelWaitingRuns(orgId, contact.id, "reply");
  ```
  (The contact at that point is `contact` — the same `contact.id` the code passes as `contactId` into `runInboundAutomations`.)

`src/modules/agent/tools/capture-booking.ts` — import `cancelWaitingRuns` from `@/modules/automation/engine`; inside `if (booked) {`, before the existing comment + `await fireBookingCreated(ctx.orgId, ctx.contactId, booking.id);` add:
```ts
      // They booked — stop chasing them. Cancel BEFORE firing the booked
      // trigger so the signal can never cancel the run it is about to start.
      await cancelWaitingRuns(ctx.orgId, ctx.contactId, "booking");
```

`src/modules/payments/index.ts` — import `cancelWaitingRuns`; directly after the `recordContactEvent(row.orgId, "payment_paid", { … });` statement add (`PaymentRequest.contactId` is a non-null `String`, so no guard):
```ts
    await cancelWaitingRuns(row.orgId, row.contactId, "payment");
```

`src/app/(app)/contacts/actions.ts` — the fifth site, staff opting a contact out by hand. Import `cancelWaitingRuns`; inside `optOutContact`'s `if (res.count > 0 && contact) {` block, after the `recordContactEvent(ctx.org.id, "opted_out", { … })` call, add:
```ts
    // Nothing may keep chasing an opted-out contact (rule 2).
    await cancelWaitingRuns(ctx.org.id, id, "opt_out");
```

`src/app/(app)/automations/automations-list.tsx` — add `CANCELLED: "neutral",` to `RUN_TONES`; `src/app/(app)/automations/[id]/runs/runs-table.tsx` — the same entry in `STATUS_TONES`. `run-log.tsx` labels a `cancel` entry "Cancelled" instead of routing it through `stepMeta` (`meta.ts`'s `STEP_KINDS`-typed records stay untouched — `cancel` is an engine event, not a step kind). `meta.ts` `STEP_DETAILS.wait.description` becomes "Pause the run. Cancelled if the customer replies, books or pays first." so the builder tells the owner what a wait now does. `actions.ts`'s test-run messages need no entry — a test run can't be cancelled mid-call.

**Step 5: Verify**

Run: `npx vitest run tests/followup-cancel.test.ts tests/credit-gating.test.ts tests/payment-link.test.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: PASS; tsc and lint silent; full suite green. Test adjustments: `tests/credit-gating.test.ts` and `tests/multi-number-routing.test.ts` mock `@/modules/automation/engine` with a factory that returned only `runInboundAutomations`, and vitest refuses a missing export on a factory mock (`No "cancelWaitingRuns" export is defined`), so both gain `cancelWaitingRuns: vi.fn().mockResolvedValue(0)`. `credit-gating` already drives `handleInboundMessage` with that mock, so it also asserts the two orderings that matter: a reply's `cancelWaitingRuns(orgId, contactId, "reply")` has a lower `invocationCallOrder` than `runInboundAutomations`, and a STOP message cancels as `"opt_out"` with `runInboundAutomations` never called. `tests/payment-link.test.ts`'s prisma mock gains `automationRun: { findMany → [], updateMany → { count: 0 } }` (otherwise every run printed a swallowed TypeError) and asserts the paid path looked up this contact's `WAITING` runs.

**Step 6: Commit**

Landed as two commits: the feature, then a follow-up from quality review (atomic claim, `currentStep + 1`, run-log label, wait description, the staff opt-out site, the extra tests).

```bash
git add src/modules/automation/engine.ts src/modules/agent/inbound.ts src/modules/agent/tools/capture-booking.ts src/modules/payments/index.ts "src/app/(app)/contacts/actions.ts" "src/app/(app)/automations/automations-list.tsx" "src/app/(app)/automations/[id]/runs/runs-table.tsx" "src/app/(app)/automations/run-log.tsx" "src/app/(app)/automations/meta.ts" tests/followup-cancel.test.ts tests/credit-gating.test.ts tests/multi-number-routing.test.ts tests/payment-link.test.ts docs/plans/2026-09-19-ai-followups.md
git commit -m "feat(automations): cancel waiting runs when the customer replies, books, pays or opts out"
git commit -m "fix(automations): claim runs atomically when cancelling; cancel on staff opt-out too"
```

---

### Task 7: Evaluate `conversation_quiet` on the cron tick

**Files:**
- Modify: `src/modules/automation/triggers.ts` (append)
- Modify: `src/app/api/cron/process-queue/route.ts` (new step after `resume-automations`; new `chased` summary key)
- Test: `tests/followup-quiet.test.ts`

**Step 1: Write the failing test**

```ts
// tests/followup-quiet.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findAutomations, findTemplates, findRuns, findConversations, runAutomation } = vi.hoisted(() => ({
  findAutomations: vi.fn(),
  findTemplates: vi.fn(),
  findRuns: vi.fn().mockResolvedValue([]),
  findConversations: vi.fn().mockResolvedValue([]),
  runAutomation: vi.fn().mockResolvedValue({ status: "WAITING" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    automation: { findMany: findAutomations },
    template: { findMany: findTemplates },
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
  org: { plan: "growth" },
  steps: [{ id: "s1", automationId: "a1", order: 1, kind: "send_template", config: { templateId: "t1" } }],
};

beforeEach(() => {
  runAutomation.mockClear();
  findRuns.mockClear().mockResolvedValue([{ contactId: "c-done" }]);
  findConversations.mockClear().mockResolvedValue([]);
  findTemplates.mockReset().mockResolvedValue([{ id: "t1", metaStatus: "APPROVED", category: "MARKETING" }]);
  findAutomations.mockResolvedValue([automation]);
});

describe("fireQuietConversations", () => {
  const now = new Date("2026-09-20T03:00:00Z");
  const cutoff = now.getTime() - 48 * 3_600_000;
  const week = 7 * 24 * 3_600_000;

  it("selects open/pending WhatsApp conversations silent both ways past the cutoff, within the lookback, opted-in, at the stage, never chased before", async () => {
    await fireQuietConversations(now);
    expect(findTemplates.mock.calls[0][0]).toMatchObject({
      where: { orgId: "o1", id: { in: ["t1"] } },
      select: { id: true, metaStatus: true, category: true },
    });
    expect(findRuns.mock.calls[0][0].where).toEqual({
      automationId: "a1",
      contactId: { not: null },
      NOT: { status: "FAILED", currentStep: { lte: 1 } },
    });
    const query = findConversations.mock.calls[0][0];
    const where = query.where;
    expect(where.orgId).toBe("o1");
    expect(where.channel).toBe("whatsapp");
    expect(where.status).toEqual({ in: ["open", "pending"] });
    expect(where.lastInboundAt.not).toBeNull();
    expect(where.lastInboundAt.lte.getTime()).toBe(cutoff);
    expect(where.lastInboundAt.gt.getTime()).toBe(cutoff - week);
    expect(where.lastMessageAt.lte.getTime()).toBe(cutoff);
    expect(where.contact).toEqual({ optedOutAt: null, optedIn: true, leadStage: "QUALIFIED" });
    expect(where.contactId).toEqual({ notIn: ["c-done"] });
    expect(query.orderBy).toEqual({ lastInboundAt: "asc" });
    expect(query.take).toBe(200);
  });

  it("does not require opt-in when every send template is UTILITY", async () => {
    findTemplates.mockResolvedValue([{ id: "t1", metaStatus: "APPROVED", category: "UTILITY" }]);
    await fireQuietConversations(now);
    expect(findConversations.mock.calls[0][0].where.contact).toEqual({ optedOutAt: null, leadStage: "QUALIFIED" });
  });

  it("never looks templates up for an automation with no send_template step", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, steps: [{ id: "s1", automationId: "a1", order: 1, kind: "send_message", config: { text: "Still there?" } }] },
    ]);
    await fireQuietConversations(now);
    expect(findTemplates).not.toHaveBeenCalled();
    expect(findConversations).toHaveBeenCalledTimes(1);
  });

  it("starts nothing while a send template is still pending at Meta", async () => {
    findTemplates.mockResolvedValue([{ id: "t1", metaStatus: "PENDING", category: "MARKETING" }]);
    await expect(fireQuietConversations(now)).resolves.toBe(0);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("starts nothing when a send template is missing from the org's library", async () => {
    findTemplates.mockResolvedValue([]);
    await expect(fireQuietConversations(now)).resolves.toBe(0);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("omits the stage filter when the config has none", async () => {
    findAutomations.mockResolvedValue([{ ...automation, triggerConfig: { hours: 24 } }]);
    await fireQuietConversations(now);
    expect(findConversations.mock.calls[0][0].where.contact).toEqual({ optedOutAt: null, optedIn: true });
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

  it("skips a step-less automation and an org off the AI Front Desk plans", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, id: "empty", steps: [] },
      { ...automation, id: "downgraded", org: { plan: "starter" } },
    ]);
    await fireQuietConversations(now);
    expect(findConversations).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("keeps going past skipped automations to a valid one", async () => {
    findAutomations.mockResolvedValue([
      { ...automation, id: "empty", steps: [] },
      { ...automation, id: "downgraded", org: { plan: "starter" } },
      automation,
    ]);
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }]);
    await expect(fireQuietConversations(now)).resolves.toBe(1);
    expect(runAutomation).toHaveBeenCalledTimes(1);
    expect(runAutomation.mock.calls[0][0]).toMatchObject({ id: "a1" });
  });

  it("evaluates every automation of an org separately", async () => {
    findAutomations.mockResolvedValue([automation, { ...automation, id: "a2" }]);
    await fireQuietConversations(now);
    expect(findRuns.mock.calls.map((c) => c[0].where.automationId)).toEqual(["a1", "a2"]);
    expect(findConversations).toHaveBeenCalledTimes(2);
  });

  it("survives a failing run and keeps going", async () => {
    findConversations.mockResolvedValue([{ id: "v1", contactId: "c1" }, { id: "v2", contactId: "c2" }]);
    runAutomation.mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fireQuietConversations(now)).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followup-quiet.test.ts`
Expected: FAIL — `fireQuietConversations` is not exported.

**Step 3: Implement** — append to `triggers.ts` (add `prisma`, `parseQuietConfig` and `planHasAiFrontDesk` imports). An org's automations stay enabled when it downgrades, so the tick gates on the AI Front Desk plan at runtime — the same `planHasAiFrontDesk(org.plan)` check `tickBookingReminders` makes in `src/modules/followup/reminders.ts` — instead of trusting the `enabled` flag alone. It also starts no chases for an automation whose `send_template` steps reference a template that is missing from the org's library or not yet `APPROVED` at Meta: a chase against a pending template would produce a FAILED run, and the one-run-per-contact cap would then exclude that contact forever, whereas holding off keeps every contact eligible until approval. The cap counts every prior run except a FAILED one that never got past step 1 (always the first send for a `went_quiet` spec, since `parseFollowUpSpec` forces `afterDays` 0) — a run that failed on message 2 still counts, because retrying it would re-send message 1, while a never-sent failure just re-attempts on the next tick. "Quiet" means silence in both directions (`lastMessageAt` as well as `lastInboundAt` older than the cutoff — a staff reply from the inbox postpones the chase) within a 7-day lookback, so switching a chase on never drains months of stale threads oldest-first. And a MARKETING chase selects only opted-in contacts (invariant #2; `canSendMarketing` requires `optedIn`, which inbound-created contacts lack by default), so the consent gate in `sendMessage` never turns a lead into a FAILED run:

```ts
import { prisma } from "@/lib/db";
import { parseQuietConfig } from "@/modules/automation/definitions";
import { planHasAiFrontDesk } from "@/modules/billing/limits";

const QUIET_BATCH = 200;
/** Only threads that went quiet in the past week — switching a chase on must not drain months of stale threads. */
const QUIET_LOOKBACK_MS = 7 * 24 * 3_600_000;

/**
 * The outbound moat's trigger: a customer who messaged us (so they showed
 * interest) and the thread has since been silent in both directions for the
 * configured hours. Runs on the cron tick. One chase per contact per
 * automation, ever — enforced by excluding anyone with an existing run that
 * got past its first send — so a nightly tick can never double-send. Like the
 * reminder tick, gated on the AI Front Desk plan at runtime: an org that
 * downgraded stops chasing even though its automations stay enabled.
 * Returns how many runs were started.
 */
export async function fireQuietConversations(now: Date = new Date()): Promise<number> {
  const automations = await prisma.automation.findMany({
    where: { enabled: true, trigger: "conversation_quiet" },
    include: { steps: { orderBy: { order: "asc" } }, org: { select: { plan: true } } },
  });
  let started = 0;
  for (const automation of automations) {
    if (!automation.steps.length || !planHasAiFrontDesk(automation.org.plan)) continue;
    // A chase started while a template is still pending at Meta would FAIL and
    // the one-run cap would then exclude that contact forever — so start nothing
    // until every send template is approved; the contacts stay eligible.
    const templateIds = automation.steps
      .filter((s) => s.kind === "send_template")
      .map((s) => {
        const { templateId } = (s.config ?? {}) as { templateId?: unknown };
        return typeof templateId === "string" ? templateId : "";
      })
      .filter(Boolean);
    // Invariant #2: a MARKETING chase reaches only opted-in contacts — selected
    // up front so the consent gate in sendMessage never turns a lead into a
    // FAILED run.
    let needsOptIn = false;
    if (templateIds.length) {
      const templates = await prisma.template.findMany({
        where: { orgId: automation.orgId, id: { in: templateIds } },
        select: { id: true, metaStatus: true, category: true },
      });
      const approved = new Set(templates.filter((t) => t.metaStatus === "APPROVED").map((t) => t.id));
      if (!templateIds.every((id) => approved.has(id))) continue;
      needsOptIn = templates.some((t) => t.category === "MARKETING");
    }
    const { hours, stage } = parseQuietConfig(automation.triggerConfig);
    const cutoff = new Date(now.getTime() - hours * 3_600_000);
    // A FAILED run that never sent (step 1 is always the first send for a
    // went_quiet spec) does not burn the cap: a suspended org re-attempts each
    // tick until unsuspended — bounded and intended.
    const priorRuns = await prisma.automationRun.findMany({
      where: {
        automationId: automation.id,
        contactId: { not: null },
        NOT: { status: "FAILED", currentStep: { lte: 1 } },
      },
      select: { contactId: true },
    });
    const conversations = await prisma.conversation.findMany({
      where: {
        orgId: automation.orgId,
        channel: "whatsapp",
        status: { in: ["open", "pending"] },
        // Quiet in both directions: a staff reply from the inbox postpones the chase.
        lastInboundAt: { not: null, gt: new Date(cutoff.getTime() - QUIET_LOOKBACK_MS), lte: cutoff },
        lastMessageAt: { lte: cutoff },
        contactId: { notIn: priorRuns.map((r) => r.contactId as string) },
        contact: {
          optedOutAt: null,
          ...(needsOptIn ? { optedIn: true } : {}),
          ...(stage ? { leadStage: stage } : {}),
        },
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

In the route's `summary` object add `chased: boundedCount(chased),` right after `resumedRuns`. Nothing else in the route.

**Step 4: Verify**

Run: `npx vitest run tests/followup-quiet.test.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: PASS; tsc and lint silent; the full suite green.

**Step 5: Commit**

```bash
git add src/modules/automation/triggers.ts src/app/api/cron/process-queue/route.ts tests/followup-quiet.test.ts docs/plans/2026-09-19-ai-followups.md
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, generate, recordSyntheticUsage, envState } = vi.hoisted(() => ({
  envState: { ANTHROPIC_API_KEY: undefined as string | undefined },
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    org: { findUnique: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
  },
  generate: vi.fn(),
  recordSyntheticUsage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage }));

import {
  draftFollowUp,
  draftOffline,
  draftStarterSet,
  parseDraftOutput,
  starterSetOffline,
} from "@/modules/followup/draft";
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
  it("accepts smart quotes around a keyword", () => {
    expect(draftOffline("when someone says “price” send our price list").situation).toEqual({
      kind: "keyword",
      keywords: ["price"],
    });
  });
  it("reads quiet phrasing before booking or keyword words", () => {
    expect(draftOffline("chase leads who asked about pricing but never booked").situation.kind).toBe("went_quiet");
    expect(draftOffline("remind quiet leads to book").situation.kind).toBe("went_quiet");
  });
  it("hears the everyday ways an owner says a lead went quiet", () => {
    expect(draftOffline("chase people who don't reply to my first message").situation.kind).toBe("went_quiet");
    expect(draftOffline("follow up with anyone who has not replied in 3 days").situation).toEqual({
      kind: "went_quiet",
      afterDays: 3,
    });
  });
  it("never claims a visit happened: the review ask is timed from the booking", () => {
    const r = draftOffline("ask for a review the day after the appointment");
    expect(r.situation.kind).toBe("booked");
    expect(r.messages[0].header).toBe("How did it go?");
    expect(r.messages[0].body).not.toMatch(/coming in/);
    expect(r.messages[0].footer).toContain("STOP");
  });
  it("welcomes a new lead with the shared welcome copy and a STOP footer", () => {
    const r = draftOffline("welcome every new lead");
    expect(r.messages[0].header).toBe("Thanks for reaching out");
    expect(r.messages[0].footer).toContain("STOP");
  });
  it("falls back to a 2-day quiet chase for anything else", () => {
    expect(draftOffline("something").situation).toEqual({ kind: "went_quiet", afterDays: 2 });
  });
});

describe("starterSetOffline", () => {
  it("yields three valid, compilable follow-ups timed from the booking", () => {
    const set = starterSetOffline();
    expect(set.map((s) => s.name)).toEqual(["Quiet-lead chase", "Booking confirmed", "Welcome new leads"]);
    for (const s of set) expect(() => compileFollowUp(s)).not.toThrow();
    const booked = set[1];
    expect(booked.situation.kind).toBe("booked");
    expect(booked.stopOn).toEqual(["booking"]);
    expect(booked.messages[0].afterDays).toBe(0);
    expect(booked.messages[0].body).not.toMatch(/tomorrow|coming in/);
    expect(set[2].messages[0].header).toBe("Thanks for reaching out");
    expect(set[2].messages[0].footer).toContain("STOP");
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
  it("takes the first entry when a single draft comes back as a list", () => {
    const r = parseDraftOutput(
      '{"followUps":[{"name":"First","situation":{"kind":"new_lead"},"messages":[{"afterDays":0,"category":"MARKETING","header":"Hi","body":"Hi {{1}}","footer":""}]}]}',
      "single"
    );
    expect(r.ok && r.specs.map((s) => s.name)).toEqual(["First"]);
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

describe("draftFollowUp / draftStarterSet without a key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never calls the model and still meters a synthetic row", async () => {
    const spec = await draftFollowUp({ orgId: "o1", request: "welcome every new lead" });
    expect(spec.situation.kind).toBe("new_lead");
    expect(generate).not.toHaveBeenCalled();
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "o1", purpose: "followup_draft" },
      "welcome every new lead",
      expect.any(String)
    );
  });
  it("writes the offline starter set and meters a synthetic row", async () => {
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set).toHaveLength(3);
    expect(generate).not.toHaveBeenCalled();
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "o1", purpose: "followup_draft" },
      "starter set",
      expect.any(String)
    );
  });
  it("refuses an empty sentence", async () => {
    await expect(draftFollowUp({ orgId: "o1", request: "   " })).rejects.toThrow(
      "Describe the follow-up in a sentence first."
    );
  });
});

const VALID_SINGLE = {
  name: "Chase",
  situation: { kind: "went_quiet", afterDays: 3 },
  messages: [{ afterDays: 0, category: "MARKETING", header: "Hi", body: "Still there {{1}}?", footer: "" }],
};
const VALID_BOOKED = {
  name: "See you",
  situation: { kind: "booked" },
  messages: [{ afterDays: 1, category: "UTILITY", header: "See you", body: "Hi {{1}}", footer: "" }],
};
const PROFILE = {
  businessName: "Glow Clinic",
  vertical: "clinic",
  businessInfo: "Hair transplant consults.",
  tone: "Warm",
  doNots: "",
};

describe("draft with a key (model path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.ANTHROPIC_API_KEY = "test-key";
    prisma.agentProfile.findUnique.mockResolvedValue(PROFILE);
    prisma.org.findUnique.mockResolvedValue({ name: "Glow", vertical: "clinic" });
    prisma.knowledgeEntry.findMany.mockResolvedValue([
      { category: "pricing", fact: "Consults are ₹500", condition: null },
    ]);
  });
  afterEach(() => {
    envState.ANTHROPIC_API_KEY = undefined;
  });

  it("retries once on prose, attributes both calls, and returns the parsed spec", async () => {
    generate
      .mockResolvedValueOnce("Sure! Here is a follow-up for you.")
      .mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    const spec = await draftFollowUp({ orgId: "o1", request: "chase quiet leads after 3 days" });
    expect(spec.name).toBe("Chase");
    expect(spec.messages[0].footer).toContain("STOP");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0].prompt).toContain("IMPORTANT");
    for (const [call] of generate.mock.calls) {
      expect(call.attribution).toEqual({ orgId: "o1", purpose: "followup_draft" });
    }
  });

  it("grounds the system prompt in the business, its active knowledge and the rules", async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    expect(prisma.knowledgeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "o1", status: "active" },
        orderBy: { createdAt: "asc" },
      })
    );
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("Glow Clinic");
    expect(system).toContain("clinic business");
    expect(system).toContain("Hair transplant consults.");
    expect(system).toContain("Consults are ₹500");
    expect(system).toContain("booked situations omit it");
    expect(system).toContain("never write 'tomorrow'");
    expect(system).toContain("unless it appears in the business information below");
    expect(system).not.toContain("know nothing");
    // Blank-line separators survive the conditional-line filter.
    expect(system).toContain("\n\nSituations (use exactly these kinds):");
  });

  it("lists the owner's do-nots as a Never line", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, doNots: "promise results" });
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    expect(generate.mock.calls[0][0].system).toContain("- Never: promise results");
  });

  it("tells the model it knows nothing when there is no business info or knowledge", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, businessInfo: "" });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("know nothing");
    expect(system).not.toContain("About the business:");
  });

  it("treats a whitespace-only profile as knowing nothing", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, businessInfo: "   \n  " });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("know nothing");
    expect(system).not.toContain("About the business:");
  });

  it("gives up with a friendly error after two bad replies, logging only the reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      generate.mockResolvedValue("no json here");
      await expect(draftFollowUp({ orgId: "o1", request: "chase quiet leads" })).rejects.toThrow(
        "We couldn't write that follow-up just now"
      );
      expect(generate).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith("[followup-draft] unusable model output", {
        orgId: "o1",
        mode: "single",
        error: expect.any(String),
      });
    } finally {
      warn.mockRestore();
    }
  });

  it("shows the set the object shape and keeps the valid entries", async () => {
    generate.mockResolvedValueOnce(
      JSON.stringify({ followUps: [VALID_BOOKED, { name: "bad", situation: { kind: "nope" }, messages: [] }] })
    );
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set.map((s) => s.name)).toEqual(["See you"]);
    expect(set[0].stopOn).toEqual(["booking"]);
    const { prompt, maxTokens } = generate.mock.calls[0][0];
    expect(maxTokens).toBe(4000);
    expect(prompt).toContain('"situation"');
    expect(prompt).toContain('"messages"');
  });

  it("returns all six of a full set, with STOP footers on the marketing ones", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...VALID_SINGLE, name: `Chase ${i + 1}` }));
    generate.mockResolvedValueOnce(JSON.stringify({ followUps: six }));
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set).toHaveLength(6);
    for (const s of set) expect(s.messages[0].footer).toContain("STOP");
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
    // Active facts only — archived or unreviewed imports must not ground a draft (invariant #7).
    prisma.knowledgeEntry.findMany({
      where: { orgId, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { category: true, fact: true, condition: true },
      take: 60,
    }),
  ]);
  return {
    businessName: profile?.businessName || org?.name || "the business",
    vertical: profile?.vertical || org?.vertical || "services",
    // Trimmed: a whitespace-only profile is no grounding at all, and must not
    // suppress the "you know nothing about this business" line.
    businessInfo: (profile?.businessInfo ?? "").trim(),
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
    knowledge: buildKnowledgeDigest(entries, 2500).trim(),
  };
}

function systemPrompt(b: BusinessContext): string {
  const grounded = Boolean(b.businessInfo || b.knowledge);
  return [
    `You design WhatsApp follow-ups for ${b.businessName}, a ${b.vertical} business. A follow-up is a message (or up to ${MAX_MESSAGES}) sent automatically after a situation, to bring a customer back.`,
    "",
    "Situations (use exactly these kinds):",
    '- went_quiet {afterDays 1-14, stage?}: a customer who messaged us has not replied for N days. Use for chasing leads. stage is one of NEW, CONTACTED, QUALIFIED, WON, LOST — omit unless the owner named one.',
    "- booked {}: the moment an appointment is booked. Messages here are timed from the booking, not from the appointment — never write 'tomorrow', 'today' or 'thanks for coming in'; confirmations and prep only.",
    "- campaign_reply {}: the customer replied to a marketing campaign.",
    "- keyword {keywords[]}: a message contains one of these words.",
    "- new_lead {}: the customer's first ever message.",
    "",
    "Message rules (Meta WhatsApp templates):",
    "- body: warm, concrete, under 500 characters, uses {{1}} exactly once near the start for the first name. No ALL-CAPS, no pressure, no medical or financial claims; never mention a price, offer, discount, opening hour, guarantee or named service unless it appears in the business information below.",
    "- header: under 50 characters. footer: leave empty (we add the opt-out).",
    "- category: MARKETING for anything promotional or a chase; UTILITY only for a transactional message about a booking the customer made.",
    `- afterDays: days after the previous message (0 = immediately), max ${MAX_GAP_DAYS}. For went_quiet the first message is always 0 — the waiting is in the situation.`,
    "- stopOn: which customer actions end the follow-up early — any of reply, booking, payment (default: all three; booked situations omit it).",
    `- Tone: ${b.tone}.`,
    b.doNots ? `- Never: ${b.doNots}` : false,
    grounded
      ? false
      : "\nYou know nothing about this business except its name and type. Do not mention prices, offers, discounts, hours, staff, or named services — keep every message generic: invite a reply, offer to help.",
    b.businessInfo ? `\nAbout the business:\n${b.businessInfo}` : false,
    b.knowledge ? `\nWhat the business has told us (only use facts from here):\n${b.knowledge}` : false,
    "",
    "Return ONLY a JSON object, no markdown, no commentary.",
  ]
    .filter((line): line is string => line !== false)
    .join("\n");
}

const OBJECT_SHAPE =
  '{"name": "short name", "situation": {"kind": "went_quiet", "afterDays": 2}, "messages": [{"afterDays": 0, "category": "MARKETING", "header": "...", "body": "...", "footer": ""}], "stopOn": ["reply","booking","payment"]}';
const SINGLE_SHAPE = `Shape: {"followUp": ${OBJECT_SHAPE}}`;
const SET_SHAPE = `Shape: {"followUps": [${OBJECT_SHAPE}, ...]} — 4 to 6 objects in total. Cover: a quiet-lead chase, a booking confirmation, and a welcome for new leads; add one or two specific to this kind of business. In the starter set keep each follow-up to at most 2 messages and each body under 300 characters.`;

export type DraftParse =
  | { ok: true; specs: FollowUpSpec[] }
  | { ok: false; error: string };

/** Pure: model text → validated specs. A set keeps the valid entries. */
export function parseDraftOutput(text: string, mode: "single" | "set"): DraftParse {
  const json = extractJson(text);
  if (!json.ok) return { ok: false, error: json.error };
  const obj = json.value && typeof json.value === "object" ? (json.value as Record<string, unknown>) : {};
  const raws =
    mode === "single"
      ? [obj.followUp ?? (Array.isArray(obj.followUps) ? obj.followUps[0] : obj)]
      : Array.isArray(obj.followUps)
        ? obj.followUps
        : [];
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
  // A 4–6 spec set with three messages each does not fit in a single-spec budget.
  const maxTokens = mode === "set" ? 4000 : 1200;
  const attribution = { orgId, purpose: "followup_draft" } as const;
  let text = await generate({ system, prompt: `${userPrompt}\n\n${shape}`, maxTokens, attribution });
  let parsed = parseDraftOutput(text, mode);
  if (!parsed.ok) {
    text = await generate({
      system,
      prompt: `${userPrompt}\n\n${shape}\n\nIMPORTANT: your previous reply was not valid (${parsed.error}). Respond with ONLY the JSON object — first character "{", last character "}".`,
      maxTokens,
      attribution,
    });
    parsed = parseDraftOutput(text, mode);
  }
  if (!parsed.ok) {
    // The reason only — never the prompt or the business text.
    console.warn("[followup-draft] unusable model output", { orgId, mode, error: parsed.error });
    throw new Error("We couldn't write that follow-up just now — try rephrasing, or try again in a moment.");
  }
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
    const set = starterSetOffline();
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

/** Copy that is safe at the moment it fires: `booked` runs when the booking is
 *  made, not when the appointment happens, so nothing here says "tomorrow" or
 *  "thanks for coming in". MARKETING footers are filled in by parse. */
const CONFIRM_COPY = {
  category: "UTILITY" as const,
  header: "You're booked",
  body: "Hi {{1}}, your booking is confirmed — thank you! If anything changes, just reply here and we'll sort it.",
  footer: "",
  buttons: [],
};
const REVIEW_AFTER_BOOKING_COPY = {
  category: "MARKETING" as const,
  header: "How did it go?",
  body: "Hi {{1}}, how did everything go? If you have a minute, reply with a quick word — it really helps us.",
  footer: "",
  buttons: [],
};
const WELCOME_COPY = {
  category: "MARKETING" as const,
  header: "Thanks for reaching out",
  body: "Hi {{1}}, thanks for getting in touch! Tell us what you're looking for and we'll get you sorted — or just reply with any question.",
  footer: "",
  buttons: [],
};

const QUIET_PHRASING =
  /quiet|silent|ghost|no reply|didn't reply|don't reply|not replied|stopped replying|haven't heard|never booked|didn't book/;

function daysIn(text: string, fallback: number): number {
  const m = text.match(/(\d+)\s*(day|days|d)\b/i);
  const weeks = text.match(/(\d+)\s*(week|weeks|w)\b/i) ?? (/\ba week\b/i.test(text) ? ["", "1"] : null);
  const n = m ? Number(m[1]) : weeks ? Number(weeks[1]) * 7 : fallback;
  return Math.min(Math.max(n, 1), MAX_GAP_DAYS);
}

function quietChase(r: string): FollowUpSpec {
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
}

/** Sentence → spec without a model. Good enough to demo every situation.
 *  Quiet phrasing is read first: "never booked" is a chase, not a booking. */
export function draftOffline(request: string): FollowUpSpec {
  const r = request.toLowerCase();
  const keyword = r.match(/["“”']([^"“”']{1,40})["“”']/);
  const spec = ((): FollowUpSpec => {
    if (QUIET_PHRASING.test(r)) return quietChase(r);
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
        messages: [{ afterDays: daysIn(r, 1), ...REVIEW_AFTER_BOOKING_COPY }],
        stopOn: ["booking"],
      };
    }
    if (/book|appointment|confirm/.test(r)) {
      return {
        name: "Booking confirmed",
        situation: { kind: "booked" },
        messages: [{ afterDays: 0, ...CONFIRM_COPY }],
        stopOn: ["booking"],
      };
    }
    if (/new lead|first message|welcome/.test(r)) {
      return {
        name: "Welcome",
        situation: { kind: "new_lead" },
        messages: [{ afterDays: 0, ...WELCOME_COPY }],
        stopOn: ["reply", "booking", "payment"],
      };
    }
    return quietChase(r);
  })();
  const parsed = parseFollowUpSpec(spec);
  return parsed.ok ? parsed.spec : spec;
}

/** The starter set with no model: a quiet chase, a booking confirmation and a
 *  welcome. No review ask — the reminder tick already sends one after the visit. */
export function starterSetOffline(): FollowUpSpec[] {
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
      name: "Booking confirmed",
      situation: { kind: "booked" },
      messages: [{ afterDays: 0, ...CONFIRM_COPY }],
      stopOn: ["booking"],
    },
    {
      name: "Welcome new leads",
      situation: { kind: "new_lead" },
      messages: [{ afterDays: 0, ...WELCOME_COPY }],
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
Expected: PASS, 22 tests; tsc silent.

**Step 5: Commit**

```bash
git add src/lib/model-router/usage.ts src/modules/followup/draft.ts tests/followup-draft.test.ts docs/plans/2026-09-19-ai-followups.md
git commit -m "feat(followups): draft follow-ups from a sentence or the business profile, with a keyless fallback"
```

---

### Task 9: Server actions — draft, create, update, delete, starter set

**Files:**
- Modify: `src/app/(app)/automations/followup-actions.ts` (append)
- Modify: `src/modules/orgs/audit.ts` (`AuditAction` union + `AUDIT_ACTION_LABELS`)
- Modify: `src/app/(app)/automations/actions.ts` (builder edit clears the spec)
- Modify: `src/modules/followup/spec.ts` (`specErrorMessage` — owner copy for a
  parse failure; the raw zod string must never reach the page)
- Modify: `src/modules/followup/draft.ts` (two residuals from Task 8's review:
  trim the grounding strings, hear "don't reply" / "not replied")
- Test: `tests/followups-actions.test.ts` (new), plus additions to
  `tests/followup-spec.test.ts` and `tests/followup-draft.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/followups-actions.test.ts
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The follow-up server actions: every one is ADMIN-gated, flagship-gated where
 * it costs AI, org-scoped on read, and never shows the owner a raw zod string.
 */

const {
  requireOrgContext,
  revalidatePath,
  recordAudit,
  checkAiFrontDesk,
  checkAutomationLimit,
  saveFollowUpFromSpec,
  installRevenueRecoveryPack,
  draftFollowUp,
  draftStarterSet,
  automationFindFirst,
  automationFindMany,
  automationDeleteMany,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  revalidatePath: vi.fn(),
  recordAudit: vi.fn(),
  checkAiFrontDesk: vi.fn(),
  checkAutomationLimit: vi.fn(),
  saveFollowUpFromSpec: vi.fn(),
  installRevenueRecoveryPack: vi.fn(),
  draftFollowUp: vi.fn(),
  draftStarterSet: vi.fn(),
  automationFindFirst: vi.fn(),
  automationFindMany: vi.fn(),
  automationDeleteMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({
  prisma: {
    automation: {
      findFirst: automationFindFirst,
      findMany: automationFindMany,
      deleteMany: automationDeleteMany,
    },
  },
}));
vi.mock("@/modules/orgs/auth", () => {
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrgContext,
    requireRole: (ctx: { role: string }, min: string) => {
      if (ORDER[ctx.role] < ORDER[min]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/billing/limits", () => ({ checkAiFrontDesk, checkAutomationLimit }));
vi.mock("@/modules/followup/install", () => ({
  saveFollowUpFromSpec,
  installRevenueRecoveryPack,
  getFollowUpConfig: vi.fn(),
  setFollowUpEnabled: vi.fn(),
  setFollowUpFlag: vi.fn(),
  setFollowUpTiming: vi.fn(),
}));
vi.mock("@/modules/followup/draft", () => ({ draftFollowUp, draftStarterSet }));

import {
  createFollowUpAction,
  deleteFollowUpAction,
  draftFollowUpAction,
  updateFollowUpAction,
  writeStarterSetAction,
} from "@/app/(app)/automations/followup-actions";

const ctx = (role: "OWNER" | "ADMIN" | "AGENT" = "ADMIN") => ({
  role,
  org: { id: "org1" },
  userId: "u1",
  email: "owner@example.com",
  membership: { displayName: "Asha" },
});

const spec = (over: Record<string, unknown> = {}) => ({
  name: "Quiet-lead chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, any questions?", footer: "" },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue(ctx());
  checkAiFrontDesk.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
  saveFollowUpFromSpec.mockResolvedValue({ id: "auto1" });
  automationFindMany.mockResolvedValue([]);
  automationDeleteMany.mockResolvedValue({ count: 1 });
});

describe("draftFollowUpAction", () => {
  it("returns the spec for review and saves nothing", async () => {
    draftFollowUp.mockResolvedValue(spec());
    const r = await draftFollowUpAction("chase quiet leads after 2 days");
    expect(r.ok).toBe(true);
    expect(r.spec?.name).toBe("Quiet-lead chase");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
    expect(draftFollowUp).toHaveBeenCalledWith({
      orgId: "org1",
      request: "chase quiet leads after 2 days",
    });
  });

  it("caps the request so a pasted essay can't run up the bill", async () => {
    draftFollowUp.mockResolvedValue(spec());
    await draftFollowUpAction("x".repeat(900));
    expect(draftFollowUp.mock.calls[0][0].request).toHaveLength(500);
  });

  it("refuses an agent and a workspace without the flagship", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await draftFollowUpAction("chase")).ok).toBe(false);

    requireOrgContext.mockResolvedValue(ctx());
    checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    const r = await draftFollowUpAction("chase");
    expect(r).toEqual({ ok: false, message: "Upgrade first." });
    expect(draftFollowUp).not.toHaveBeenCalled();
  });

  it("passes the drafter's own friendly failure through", async () => {
    draftFollowUp.mockRejectedValue(new Error("We couldn't write that follow-up just now — try rephrasing."));
    const r = await draftFollowUpAction("chase");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("couldn't write that follow-up");
  });
});

describe("createFollowUpAction", () => {
  it("saves a reviewed spec as an AI follow-up that lands off", async () => {
    const r = await createFollowUpAction(spec());
    expect(r).toMatchObject({ ok: true, id: "auto1" });
    expect(r.message).toMatch(/off/i);
    const arg = saveFollowUpFromSpec.mock.calls[0][0];
    expect(arg.orgId).toBe("org1");
    expect(arg.source).toBe("ai");
    expect(arg.spec.messages[0].footer).toContain("STOP");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.created", "Quiet-lead chase");
    expect(revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("echoes the spec it actually saved, repairs and all", async () => {
    // What is stored is not what the owner typed: parse adds the STOP footer
    // and a quiet chase's first message always fires immediately. The card has
    // to render the stored version, so the action hands it back.
    const r = await createFollowUpAction(spec({ messages: [{ ...spec().messages[0], afterDays: 2 }] }));
    expect(r.ok).toBe(true);
    expect(r.spec).toEqual(saveFollowUpFromSpec.mock.calls[0][0].spec);
    expect(r.spec?.messages[0].footer).toContain("STOP");
    expect(r.spec?.messages[0].afterDays).toBe(0);
  });

  it("shows an owner-facing sentence, not a zod string, for an invalid spec", async () => {
    const long = spec({
      messages: [
        { afterDays: 0, category: "MARKETING", header: "Hi", body: `Hi {{1}} ${"x".repeat(700)}`, footer: "" },
      ],
    });
    const r = await createFollowUpAction(long);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Each message needs a body of 1–600 characters.");
    expect(r.spec).toBeUndefined();
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("checks the plan's automation limit before saving", async () => {
    checkAutomationLimit.mockResolvedValue({
      allowed: false,
      message: "You've reached the Starter plan's limit of 3 automations.",
      used: 3,
      limit: 3,
    });
    const r = await createFollowUpAction(spec());
    expect(r.ok).toBe(false);
    expect(r.message).toContain("limit of 3 automations");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("refuses an agent", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await createFollowUpAction(spec())).ok).toBe(false);
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });
});

describe("updateFollowUpAction", () => {
  it("re-saves over an org-scoped follow-up and keeps a pack follow-up in the pack", async () => {
    automationFindFirst.mockResolvedValue({ id: "a1", source: "pack" });
    const r = await updateFollowUpAction("a1", spec());
    expect(r.ok).toBe(true);
    expect(automationFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", orgId: "org1" });
    expect(saveFollowUpFromSpec).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", automationId: "a1", source: "pack" })
    );
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.updated", "Quiet-lead chase");
    expect(revalidatePath).toHaveBeenCalledWith("/automations");
    expect(revalidatePath).toHaveBeenCalledWith("/automations/a1");
  });

  it("echoes the spec it actually saved", async () => {
    automationFindFirst.mockResolvedValue({ id: "a1", source: "ai" });
    const r = await updateFollowUpAction("a1", spec({ messages: [{ ...spec().messages[0], afterDays: 2 }] }));
    expect(r.spec).toEqual(saveFollowUpFromSpec.mock.calls[0][0].spec);
    expect(r.spec?.messages[0].footer).toContain("STOP");
    expect(r.spec?.messages[0].afterDays).toBe(0);
  });

  it("a hand-built follow-up edited here becomes an AI-spec one", async () => {
    automationFindFirst.mockResolvedValue({ id: "a1", source: "builder" });
    await updateFollowUpAction("a1", spec());
    expect(saveFollowUpFromSpec.mock.calls[0][0].source).toBe("ai");
  });

  it("refuses another org's id and an invalid spec", async () => {
    automationFindFirst.mockResolvedValue(null);
    expect(await updateFollowUpAction("other", spec())).toEqual({
      ok: false,
      message: "Follow-up not found.",
    });

    automationFindFirst.mockResolvedValue({ id: "a1", source: "ai" });
    const r = await updateFollowUpAction("a1", spec({ situation: { kind: "nonsense" } }));
    expect(r.ok).toBe(false);
    expect(r.message).toBe("We couldn't tell what should start that follow-up — try rewording it.");
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("refuses an agent", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await updateFollowUpAction("a1", spec())).ok).toBe(false);
    expect(automationFindFirst).not.toHaveBeenCalled();
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });
});

describe("deleteFollowUpAction", () => {
  it("deletes an org-scoped follow-up and says the templates stay", async () => {
    automationFindFirst.mockResolvedValue({ name: "Quiet-lead chase" });
    const r = await deleteFollowUpAction("a1");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/templates/i);
    expect(automationFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", orgId: "org1" });
    // deleteMany, not delete: the org scope stays on the write, and a row that
    // vanished between the read and the write is a message, not a P2025.
    expect(automationDeleteMany).toHaveBeenCalledWith({ where: { id: "a1", orgId: "org1" } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.deleted", "Quiet-lead chase");
  });

  it("refuses another org's id", async () => {
    automationFindFirst.mockResolvedValue(null);
    expect(await deleteFollowUpAction("other")).toEqual({ ok: false, message: "Follow-up not found." });
    expect(automationDeleteMany).not.toHaveBeenCalled();
  });

  it("says not found — never a Prisma error — when the row goes first", async () => {
    automationFindFirst.mockResolvedValue({ name: "Quiet-lead chase" });
    automationDeleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteFollowUpAction("a1")).toEqual({ ok: false, message: "Follow-up not found." });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("refuses an agent", async () => {
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await deleteFollowUpAction("a1")).ok).toBe(false);
    expect(automationDeleteMany).not.toHaveBeenCalled();
  });
});

describe("the flagship boundary", () => {
  // Deliberate: drafting and creating cost AI and are flagship-only, but an org
  // that drops off the plan must still be able to edit or remove what exists.
  beforeEach(() => {
    checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    automationFindFirst.mockResolvedValue({ id: "a1", source: "ai", name: "Quiet-lead chase" });
  });

  it("still lets an org without the flagship edit and delete, but not create", async () => {
    expect((await updateFollowUpAction("a1", spec())).ok).toBe(true);
    expect((await deleteFollowUpAction("a1")).ok).toBe(true);
    const created = await createFollowUpAction(spec());
    expect(created).toEqual({ ok: false, message: "Upgrade first." });
  });
});

describe("writeStarterSetAction", () => {
  it("installs the ready-made pack, then saves the drafted set, all off", async () => {
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" })]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(2);
    expect(r.message).toContain("2 follow-ups");
    expect(installRevenueRecoveryPack).toHaveBeenCalledWith("org1");
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(2);
    expect(saveFollowUpFromSpec.mock.calls[0][0].source).toBe("ai");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.drafted", "2 drafted");
  });

  it("skips a name the org already has, whatever its casing", async () => {
    automationFindMany.mockResolvedValue([{ name: "quiet-lead CHASE" }]);
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" })]);
    const r = await writeStarterSetAction();
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
    expect(saveFollowUpFromSpec.mock.calls[0][0].spec.name).toBe("Welcome");
  });

  it("keeps the installed pack when drafting fails, and logs the reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      draftStarterSet.mockRejectedValue(new Error("credits exhausted"));
      const r = await writeStarterSetAction();
      expect(r.ok).toBe(true);
      expect(r.message).toBe(
        "Installed the ready-made follow-ups, but couldn't draft the extra ones just now — try the bar above."
      );
      expect(installRevenueRecoveryPack).toHaveBeenCalledWith("org1");
      expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[followup-starter-set] drafting failed",
        expect.objectContaining({ orgId: "org1" })
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps what it saved when a save fails partway, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" }), spec({ name: "Rebook" })]);
      saveFollowUpFromSpec
        .mockResolvedValueOnce({ id: "a1" })
        .mockRejectedValueOnce(new Error("db went away"));
      const r = await writeStarterSetAction();
      expect(r).toMatchObject({ ok: true, created: 1 });
      expect(r.message).toContain("1 follow-up");
      expect(r.message).toContain("couldn't finish the rest");
      expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "followup.drafted", "1 drafted");
      expect(revalidatePath).toHaveBeenCalledWith("/automations");
      expect(warn).toHaveBeenCalledWith(
        "[followup-starter-set] save failed",
        expect.objectContaining({ orgId: "org1", name: "Welcome" })
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("saves one follow-up when the model returns the same name twice", async () => {
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "QUIET-LEAD CHASE" })]);
    const r = await writeStarterSetAction();
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
  });

  it("skips a spec that doesn't validate instead of saving it", async () => {
    draftStarterSet.mockResolvedValue([spec({ situation: { kind: "nonsense" } }), spec({ name: "Welcome" })]);
    const r = await writeStarterSetAction();
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
    expect(saveFollowUpFromSpec.mock.calls[0][0].spec.name).toBe("Welcome");
  });

  it("stops at the plan's automation limit and reports what it created", async () => {
    checkAutomationLimit.mockResolvedValue({ allowed: true, message: "", used: 4, limit: 5 });
    draftStarterSet.mockResolvedValue([spec(), spec({ name: "Welcome" }), spec({ name: "Rebook" })]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(1);
    expect(saveFollowUpFromSpec).toHaveBeenCalledTimes(1);
    expect(r.message).toContain("1 follow-up");
    expect(r.message).toMatch(/plan allows/i);
  });

  it("says nothing was new when the org already has every drafted name", async () => {
    automationFindMany.mockResolvedValue([{ name: "Quiet-lead chase" }]);
    draftStarterSet.mockResolvedValue([spec()]);
    const r = await writeStarterSetAction();
    expect(r.ok).toBe(true);
    expect(r.created).toBe(0);
    expect(saveFollowUpFromSpec).not.toHaveBeenCalled();
  });

  it("installs nothing without the flagship, and refuses an agent", async () => {
    checkAiFrontDesk.mockResolvedValue({ allowed: false, message: "Upgrade first.", used: 0, limit: 0 });
    expect(await writeStarterSetAction()).toMatchObject({ ok: false, message: "Upgrade first." });

    checkAiFrontDesk.mockResolvedValue({ allowed: true, message: "", used: 0, limit: null });
    requireOrgContext.mockResolvedValue(ctx("AGENT"));
    expect((await writeStarterSetAction()).ok).toBe(false);
    expect(installRevenueRecoveryPack).not.toHaveBeenCalled();
  });
});

describe("the builder writes over a spec", () => {
  // Source-level: saveAutomation drags in the engine + draft parser, so this
  // one line is asserted on the file. A hand edit invalidates the spec the
  // follow-up card renders from, so the row must stop claiming to have one.
  const source = readFileSync("src/app/(app)/automations/actions.ts", "utf8");

  it("clears the spec and marks the automation hand-built on a builder save", () => {
    const from = source.indexOf("prisma.automation.update");
    const to = source.indexOf("prisma.automation.create", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const update = source.slice(from, to);
    expect(update).toContain("spec: Prisma.DbNull");
    expect(update).toContain('source: "builder"');
    expect(source).toContain('import { Prisma } from "@prisma/client"');
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/followups-actions.test.ts tests/followup-spec.test.ts tests/followup-draft.test.ts`
Expected: FAIL — `draftFollowUpAction` and `specErrorMessage` don't exist yet.

**Step 3: Audit vocabulary** — in `audit.ts` add after `"followup.timing"`:

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

**Step 4: Actions** — append to `followup-actions.ts` (extend the imports: `checkAutomationLimit` from `@/modules/billing/limits`; `prisma` from `@/lib/db`; `draftFollowUp, draftStarterSet` from `@/modules/followup/draft`; `saveFollowUpFromSpec` from `@/modules/followup/install`; `parseFollowUpSpec, specErrorMessage, type FollowUpSpec` from `@/modules/followup/spec`):

```ts
export interface DraftResult extends ActionResult {
  /** The unsaved draft the owner reviews before it is created. */
  spec?: FollowUpSpec;
}

/** Sentence → reviewable spec. Nothing is saved. ADMIN + AI Front Desk. */
export async function draftFollowUpAction(request: string): Promise<DraftResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const spec = await draftFollowUp({
      orgId: ctx.org.id,
      request: String(request ?? "").slice(0, 500),
    });
    return { ok: true, message: "Here's a draft — edit anything, then create it.", spec };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't draft that follow-up.",
    };
  }
}

export interface CreateResult extends ActionResult {
  id?: string;
  /** What was actually stored — parse repairs the draft ({{1}}, the STOP
   *  footer, a quiet chase's first message), so the card renders this, not
   *  the version the owner submitted. */
  spec?: FollowUpSpec;
}

/** Save a reviewed spec as a new follow-up. Lands OFF. */
export async function createFollowUpAction(raw: unknown): Promise<CreateResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    // Plan limit: automations (creates only, exactly like the builder's save).
    const limit = await checkAutomationLimit(ctx.org.id);
    if (!limit.allowed) return { ok: false, message: limit.message };

    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: specErrorMessage(parsed.error) };

    const { id } = await saveFollowUpFromSpec({
      orgId: ctx.org.id,
      spec: parsed.spec,
      source: "ai",
    });
    recordAudit(ctx, "followup.created", parsed.spec.name);
    revalidatePath("/automations");
    return {
      ok: true,
      message: "Created — it's off until you switch it on.",
      id,
      spec: parsed.spec,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't create that follow-up.",
    };
  }
}

export interface UpdateResult extends ActionResult {
  /** The stored spec after parse's repairs — the card re-renders from this. */
  spec?: FollowUpSpec;
}

/** Re-save an edited spec over an existing follow-up (org-scoped). */
export async function updateFollowUpAction(
  id: string,
  raw: unknown
): Promise<UpdateResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { id: true, source: true },
    });
    if (!existing) return { ok: false, message: "Follow-up not found." };

    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: specErrorMessage(parsed.error) };

    await saveFollowUpFromSpec({
      orgId: ctx.org.id,
      spec: parsed.spec,
      // A pack follow-up stays the pack's (its templates are pinned by name);
      // anything else edited here is now spec-backed.
      source: existing.source === "pack" ? "pack" : "ai",
      automationId: id,
    });
    recordAudit(ctx, "followup.updated", parsed.spec.name);
    revalidatePath("/automations");
    revalidatePath(`/automations/${id}`);
    return {
      ok: true,
      message: "Saved. Changed wording goes back to Meta for approval.",
      spec: parsed.spec,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save that follow-up.",
    };
  }
}

export async function deleteFollowUpAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { name: true },
    });
    if (!existing) return { ok: false, message: "Follow-up not found." };

    // deleteMany keeps the org scope on the write, and a row that vanished
    // between the read and the write is a message, not a raw Prisma P2025.
    const { count } = await prisma.automation.deleteMany({
      where: { id, orgId: ctx.org.id },
    });
    if (!count) return { ok: false, message: "Follow-up not found." };

    recordAudit(ctx, "followup.deleted", existing.name);
    revalidatePath("/automations");
    return { ok: true, message: "Deleted. Its templates stay in your library." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't delete that follow-up.",
    };
  }
}

export interface StarterSetResult extends ActionResult {
  /** How many drafted follow-ups were actually saved. */
  created?: number;
}

/** First-open: install the tick-driven pack (its quiet-lead nudge starts ON,
 *  as the installer has always done) AND draft a tailored set, which lands OFF. */
export async function writeStarterSetAction(): Promise<StarterSetResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    await installRevenueRecoveryPack(ctx.org.id);

    // The pack is the part we promise; drafting is the bonus. Credits gone or
    // the provider down must not lose the install.
    let specs: FollowUpSpec[];
    try {
      specs = await draftStarterSet({ orgId: ctx.org.id });
    } catch (err) {
      console.warn("[followup-starter-set] drafting failed", { orgId: ctx.org.id, err });
      revalidatePath("/automations");
      return {
        ok: true,
        created: 0,
        message:
          "Installed the ready-made follow-ups, but couldn't draft the extra ones just now — try the bar above.",
      };
    }

    const existing = new Set(
      (
        await prisma.automation.findMany({
          where: { orgId: ctx.org.id },
          select: { name: true },
        })
      ).map((a) => a.name.toLowerCase())
    );
    // Checked once, after the install: the loop only ever adds automations.
    const limit = await checkAutomationLimit(ctx.org.id);
    const room = limit.limit === null ? Infinity : Math.max(0, limit.limit - limit.used);

    // A save that fails midway must not lose the ones already written: the
    // boundary is inside the loop, and what was created is always reported.
    let created = 0;
    let stopped = false;
    let failed = false;
    for (const spec of specs) {
      if (existing.has(spec.name.toLowerCase())) continue;
      if (created >= room) {
        stopped = true;
        break;
      }
      // Defence in depth: the keyless helpers can hand back an unparsed spec.
      const parsed = parseFollowUpSpec(spec);
      if (!parsed.ok) continue;
      try {
        await saveFollowUpFromSpec({ orgId: ctx.org.id, spec: parsed.spec, source: "ai" });
        created++;
        existing.add(spec.name.toLowerCase()); // the model repeats itself
      } catch (err) {
        console.warn("[followup-starter-set] save failed", {
          orgId: ctx.org.id,
          name: spec.name,
          err,
        });
        failed = true;
        break;
      }
    }

    recordAudit(ctx, "followup.drafted", `${created} drafted`);
    revalidatePath("/automations");
    const message = created
      ? `Drafted ${created} follow-up${created === 1 ? "" : "s"} for you — read them, then switch on the ones you want.`
      : stopped || failed
        ? "Installed the ready-made follow-ups."
        : "Your starter set is already here.";
    return {
      ok: true,
      created,
      message: stopped
        ? `${message} We stopped there — that's as many automations as your plan allows.`
        : failed
          ? `${message} Something went wrong after that, so we couldn't finish the rest.`
          : message,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't write your starter set.",
    };
  }
}
```

`toggleRevenueRecoveryAction` stays for now, but note `writeStarterSetAction`
calls `installRevenueRecoveryPack` directly — and Task 10 removes the pack's
pause/resume card, which leaves the toggle action with no caller (see Task 10,
Step 6).

Why the starter set is shaped this way: the pack is what we promise, the
drafting is the bonus, so a drafting failure (credits gone, provider down)
returns `ok: true` with the pack installed and points the owner at the bar.
Names are compared case-insensitively — the model returns "Quiet-lead chase"
whatever case the org's existing one has — and the plan's automation limit is
read once, after the install, so a trip reports how many were created rather
than failing the whole action.

**Step 5: A builder edit clears the spec** — in `automations/actions.ts`, change `import type { Prisma } from "@prisma/client"` to `import { Prisma } from "@prisma/client"` and in the update branch's `data:` add:

```ts
            spec: Prisma.DbNull,
            source: "builder",
```

**Step 6: Verify**

Run: `npx vitest run tests/followups-actions.test.ts tests/followup-spec.test.ts tests/followup-draft.test.ts && npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

**Step 7: Commit**

```bash
git add "src/app/(app)/automations/followup-actions.ts" "src/app/(app)/automations/actions.ts" src/modules/orgs/audit.ts src/modules/followup/spec.ts src/modules/followup/draft.ts tests/followups-actions.test.ts tests/followup-spec.test.ts tests/followup-draft.test.ts docs/plans/2026-09-19-ai-followups.md
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
const rows = readFileSync("src/app/(app)/automations/follow-up-rows.tsx", "utf8");

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
    expect(page).toContain("handed to a teammate");
  });

  it("keeps the tick-driven appointment rows, with their hour fields", () => {
    expect(page).toContain("<FollowUpRows");
    expect(page).toContain("FOLLOW_UP_KINDS");
    expect(page).toContain("paused={!config?.enabled}");
    expect(rows).toContain("setFollowUpTimingAction");
    expect(rows).toContain("setFollowUpFlagAction");
  });

  it("renders a hand-built follow-up as itself: trigger label, step count, no inline edit", () => {
    expect(card).toContain("When: ${model.triggerLabel}");
    expect(card).toContain("built in the editor");
    expect(card).toContain("model.spec && !editing");
    expect(card).toContain("Open in builder");
  });

  it("never shows a paused follow-up as waiting on Meta", () => {
    expect(card).toMatch(/REJECTED[\s\S]{0,300}!m\.enabled[\s\S]{0,300}APPROVED/);
  });

  it("re-renders from the spec the server stored, not the one submitted", () => {
    expect(card).toContain("r.ok && r.spec");
  });

  it("offers the starter set until there is an AI-written follow-up, and once per session", () => {
    expect(bar).toContain("Write my starter set (about 3–5 AI credits)");
    expect(bar).toContain("hasSpecFollowUps");
    expect(bar).toContain("setDone(true)");
    expect(page).toMatch(/hasSpecFollowUps=\{cards\.some/);
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
            aria-label="Headline"
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
};

const DEFAULT_EXAMPLES = [
  "Chase anyone who went quiet after showing interest, after 2 days, then once more 5 days later",
  "Thank people the day after their appointment and ask how it went",
  "Welcome every new lead with what we do and how to book",
];

export function FollowUpBar({
  vertical,
  canManage,
  hasSpecFollowUps,
}: {
  vertical: string;
  canManage: boolean;
  /** Has the org any AI-written follow-up yet? A builder-only org is still
   *  offered the starter set. */
  hasSpecFollowUps: boolean;
}) {
  const { toast } = useToast();
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<FollowUpSpec | null>(null);
  // The starter set costs two model calls, so it is offered once per session —
  // the action's own "already here" reply covers a second tab.
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const examples = EXAMPLES[vertical] ?? DEFAULT_EXAMPLES;

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
      if (r.ok) setDone(true);
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
            aria-label="Describe a follow-up"
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
            {!hasSpecFollowUps && (
              <Button variant="secondary" onClick={starter} loading={pending} disabled={done}>
                Write my starter set (about 3–5 AI credits)
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

A single draft is about 1 AI credit; the starter set about 3–5 (one model call, 4–6 specs) — the starter button says so, the bar does not need to.

**Step 5: The card**

```tsx
// src/app/(app)/automations/follow-up-card.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Trash2, Workflow } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
  /** Null for a hand-built follow-up — the builder clears the spec when it
   *  saves, so there is no plain-English version to show or edit here. */
  spec: FollowUpSpec | null;
  source: string;
  enabled: boolean;
  triggerLabel: string;
  stepsCount: number;
  /** Meta status of every template this follow-up sends. */
  templateStatuses: string[];
}

/**
 * The chip has to agree with the switch beside it. A rejection is surfaced
 * whatever the switch says — it is the owner's to fix — but an off follow-up
 * reads "Off" rather than "Waiting for Meta", which would imply it is armed.
 * (Every freshly created follow-up lands off with pending templates, so the
 * naive order labelled the whole starter set "Waiting for Meta".)
 */
function statusOf(m: FollowUpCardModel): { label: string; tone: BadgeTone } {
  if (m.templateStatuses.includes("REJECTED")) return { label: "Rejected by Meta", tone: "danger" };
  if (!m.enabled) return { label: "Off", tone: "neutral" };
  if (m.templateStatuses.some((s) => s !== "APPROVED")) return { label: "Waiting for Meta", tone: "warning" };
  return { label: "On", tone: "success" };
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
      // Show what was stored, not what was submitted: the server repairs the
      // {{1}}, the STOP footer and a quiet chase's first message.
      if (r.ok && r.spec) {
        setDraft(r.spec);
        setEditing(false);
      }
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
          {/* Hand-built: no spec to read back, so say what it is and send the
              owner to the editor that owns it — no inline Edit, no message
              list, just the step count, the switch, the builder link, delete. */}
          {!model.spec && (
            <p className="mt-1 text-xs text-neutral-500">
              {model.stepsCount} step{model.stepsCount === 1 ? "" : "s"}
              {" · built in the editor"}
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
  // Managing an automation (switch, edit, delete, builder) is ADMIN, as it has
  // always been — `saveAutomation`/`toggleAutomation`/`deleteFollowUpAction`
  // are role-gated, not plan-gated, and Free/Entry/Starter orgs do get
  // automations. The AI bar is the flagship part, so only it takes the plan
  // gate; every action behind it refuses server-side anyway.
  const canManage = hasRole(role, "ADMIN");
  const hasFrontDesk = planHasAiFrontDesk(org.plan);

  const [config, packTemplates, automations, profile] = await Promise.all([
    getFollowUpConfig(org.id),
    getPackTemplateIds(org.id),
    prisma.automation.findMany({
      where: { orgId: org.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
      include: { steps: { orderBy: { order: "asc" } } },
    }),
    prisma.agentProfile.findUnique({ where: { orgId: org.id }, select: { vertical: true } }),
  ]);

  const templateIdOf = (stepConfig: unknown) =>
    String((stepConfig as { templateId?: string })?.templateId ?? "");

  const templateIds = automations
    .flatMap((a) =>
      a.steps.filter((s) => s.kind === "send_template").map((s) => templateIdOf(s.config))
    )
    .filter(Boolean);
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
        .map((s) => statusById.get(templateIdOf(s.config)) ?? "PENDING"),
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

      <FollowUpBar
        vertical={profile?.vertical || org.vertical || "default"}
        canManage={canManage && hasFrontDesk}
        hasSpecFollowUps={cards.some((c) => c.spec !== null)}
      />

      <p className="mt-3 text-xs text-neutral-500">
        Follow-ups go out during the nightly run, so a &ldquo;2 days later&rdquo;
        message lands the next night after that. A conversation you&rsquo;ve
        handed to a teammate is left alone until it&rsquo;s back to open.
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

`org.vertical` does exist (`Org.vertical String?`), and `draft.ts` already
prefers the agent profile's, so the page uses the same order: `profile?.vertical
|| org.vertical || "default"`.

`revenue-recovery-card.tsx` is deleted (the page was its only importer).
`toggleRevenueRecoveryAction` in `followup-actions.ts` is now **caller-less** —
the pack's master pause/resume lost its only UI. Left in place deliberately;
Task 12 decides whether to remove it or give `config.enabled` a home. Note
`FollowUpRows` still reads it as `paused={!config?.enabled}`, and
`writeStarterSetAction` → `installRevenueRecoveryPack` is now the only thing
that sets it true.

`automations-list.tsx` also loses its last importer. Left in place for Task 12
for the same reason.

**Step 7: Verify**

Run: `npx vitest run tests/followups-page.test.ts && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all green.

**Step 8: Check it in the browser** — use the worktree's own dev server on
`:3010` (`:3000` serves the founder's other branch). `curl -s -o /dev/null -w
"%{http_code}" http://localhost:3010/automations` must be a 307 to `/login` —
the route is wired and middleware compiled. Signed-in behaviour can only be
checked by the founder: reload `/automations`, click **Write my starter set**
(in test mode this is instant and keyless), confirm the AI cards + the pack
nudge + three reminder rows appear, all Off except the pack nudge; type a
sentence, **Draft it**, edit a word, **Create follow-up**; switch one on; open
one in the builder and back.

**Step 9: Commit**

```bash
git add "src/app/(app)/automations/" tests/followups-page.test.ts docs/plans/2026-09-19-ai-followups.md
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

### Deferred (recorded 2026-09-20)

- Live wording edits do not reach Meta: `submitRowToMeta` always creates; for an existing name it re-syncs the old template's status. Needs edit-in-place via Meta's template edit endpoint using `metaTemplateId` (`library.ts`).
- Shrinking a spec's message count leaves the extra template rows in the library.
- `fireQuietConversations` loads every prior contactId per automation into a `notIn` — needs a `Contact`↔`AutomationRun` relation (or a NOT EXISTS) before any single follow-up accumulates ~10k runs.
- The cron route wraps every step in one try; a `chase-quiet` DB error skips the remaining steps that night — per-step try is a separate change.

### Deferred (recorded 2026-09-21, from the Task 9 review)

- No concurrency guard on `writeStarterSetAction`: a double-click runs the pack
  install and the drafting twice. The name check is read-then-write, so the
  second run can create duplicates. Wanted: `@@unique([orgId, name])` on
  `Automation` plus a pending-state button in Task 10 — wire the button first,
  then decide whether the constraint is still needed.
- The starter-set orchestration (install → draft → filter → save) lives in the
  action. Task 11 needs the same sequence per org from the founder panel; lift
  it into `src/modules/followup/install.ts` at that point, not before.
