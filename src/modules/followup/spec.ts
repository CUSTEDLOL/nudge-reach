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
