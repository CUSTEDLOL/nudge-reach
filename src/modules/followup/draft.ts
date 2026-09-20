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
    "- For booked situations omit stopOn — we default it.",
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
        stopOn: ["booking"],
      };
    }
    if (/book|appointment|confirm/.test(r)) {
      return {
        name: "After booking",
        situation: { kind: "booked" },
        messages: [{ afterDays: 0, ...packCopy("appt_reminder_24h") }],
        stopOn: ["booking"],
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
      stopOn: ["booking"],
    },
    {
      name: "Review ask",
      situation: { kind: "booked" },
      messages: [{ afterDays: 1, ...packCopy("review_ask") }],
      stopOn: ["booking"],
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
