// src/modules/followup/draft.ts
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generate } from "@/lib/model-router";
import { recordSyntheticUsage, type UsagePurpose } from "@/lib/model-router/usage";
import { extractJson } from "@/modules/campaign/guardrails";
import { renderRulesBlock } from "@/modules/agent/rules";
import { activeRulesForOrg } from "@/modules/agent/rules-store";
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
 * router (RUNTIME_MODEL, BYOK-aware, credit-metered as followup_draft — the
 * founder panel passes `concierge_draft` instead, which Nudge absorbs). The
 * keyless path is deterministic so the whole flow demos with no API key
 * (invariant #4). Never load-bearing: every failure is a readable error and
 * nothing is saved until a spec validates.
 */

interface BusinessContext {
  businessName: string;
  vertical: string;
  /**
   * The two retired `/agent/setup` boxes. Still on the profile row, still read
   * by the Training page's "structure my existing info" and the concierge
   * checks, but deliberately NOT rendered into this prompt any more — see the
   * notes in `systemPrompt`. Kept on the type because this is "stop rendering",
   * not "stop storing".
   */
  businessInfo: string;
  tone: string;
  doNots: string;
  /** The owner's house rules — what `doNots` was migrated into. */
  rules: { instruction: string }[];
  knowledge: string;
}

async function loadBusinessContext(orgId: string): Promise<BusinessContext> {
  const [profile, org, entries, rules] = await Promise.all([
    prisma.agentProfile.findUnique({ where: { orgId } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { name: true, vertical: true } }),
    // Active facts only — archived or unreviewed imports must not ground a draft (invariant #7).
    prisma.knowledgeEntry.findMany({
      where: { orgId, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { category: true, fact: true, condition: true },
      take: 60,
    }),
    // The owner's house rules, the same ones the reply prompt carries. This
    // builder has no idea whether the workspace is a restricted trial, so it
    // takes the derived limit rather than naming a `MAX_ACTIVE_RULES` entry.
    activeRulesForOrg(orgId),
  ]);
  return {
    businessName: profile?.businessName || org?.name || "the business",
    vertical: profile?.vertical || org?.vertical || "services",
    // Trimmed: a whitespace-only profile is no grounding at all, and must not
    // suppress the "you know nothing about this business" line.
    businessInfo: (profile?.businessInfo ?? "").trim(),
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
    rules,
    knowledge: buildKnowledgeDigest(entries, 2500).trim(),
  };
}

function systemPrompt(b: BusinessContext): string {
  // FACTS only — never the rules. "Grounded" here means one thing: does the
  // model have anything true to say about this business? A rule is behaviour
  // ("always offer the evening slot first"), and no amount of behaviour tells
  // it a price, an opening hour or the name of a service.
  //
  // This briefly read `b.knowledge || b.rules.length`, which silenced the
  // anti-invention warning for exactly the org that needs it most: the one
  // whose entire legacy box was instruction-shaped, so the migration filed
  // every line as a rule and left it with zero facts. It has house rules and
  // knows nothing — both lines belong in its prompt. The two are orthogonal:
  // the block below renders on rules, this warning on facts.
  const grounded = Boolean(b.knowledge);
  const houseRules = renderRulesBlock(b.rules);
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
    // The retired `/agent/setup` do-nots box used to add `- Never: ${b.doNots}`
    // here. Do not reinstate it: `migrateProfileToRules` copies that box into
    // `AgentRule` rows, which the HOUSE RULES block below now renders, so
    // rendering the original as well sends the same instruction twice — and
    // leaves the stale original speaking for a rule the owner has since edited
    // or archived. The column stays on the profile row and on `BusinessContext`.
    houseRules ? `\n${houseRules}` : false,
    grounded
      ? false
      : "\nYou know nothing about this business except its name and type. Do not mention prices, offers, discounts, hours, staff, or named services — keep every message generic: invite a reply, offer to help.",
    // The retired `/agent/setup` business-info box used to be rendered here as
    // "About the business:". Same reason: the migration files its fact-shaped
    // lines as `KnowledgeEntry` rows, which are the digest below, so rendering
    // the blob as well duplicated every migrated fact.
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

async function draftWithModel(
  orgId: string,
  mode: "single" | "set",
  userPrompt: string,
  purpose: UsagePurpose
): Promise<FollowUpSpec[]> {
  const b = await loadBusinessContext(orgId);
  const system = systemPrompt(b);
  const shape = mode === "single" ? SINGLE_SHAPE : SET_SHAPE;
  // A 4–6 spec set with three messages each does not fit in a single-spec budget.
  const maxTokens = mode === "set" ? 4000 : 1200;
  const attribution = { orgId, purpose } as const;
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

/** `purpose` is who pays: the owner's own drafting is `followup_draft`
 *  (their credits); the founder's concierge setup is `concierge_draft`,
 *  which the ledger absorbs. */
export async function draftFollowUp(opts: {
  orgId: string;
  request: string;
  purpose?: UsagePurpose;
}): Promise<FollowUpSpec> {
  const request = opts.request.trim();
  if (!request) throw new Error("Describe the follow-up in a sentence first.");
  const purpose = opts.purpose ?? "followup_draft";
  if (!env.ANTHROPIC_API_KEY) {
    const spec = draftOffline(request);
    recordSyntheticUsage({ orgId: opts.orgId, purpose }, request, JSON.stringify(spec));
    return spec;
  }
  const [spec] = await draftWithModel(
    opts.orgId,
    "single",
    `The owner asked for this follow-up: "${request}"`,
    purpose
  );
  return spec;
}

export async function draftStarterSet(opts: {
  orgId: string;
  purpose?: UsagePurpose;
}): Promise<FollowUpSpec[]> {
  const purpose = opts.purpose ?? "followup_draft";
  if (!env.ANTHROPIC_API_KEY) {
    const set = starterSetOffline();
    recordSyntheticUsage({ orgId: opts.orgId, purpose }, "starter set", JSON.stringify(set));
    return set;
  }
  return draftWithModel(opts.orgId, "set", "Write the starter set of follow-ups for this business.", purpose);
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
