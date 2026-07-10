/**
 * Per-vertical system-prompt builder (pure, unit-tested). This is the "agent
 * training" — no ML, just a vertical template + the owner's business knowledge
 * + tone + guardrails. The guardrails keep the agent SCOPED to the business,
 * which is what Meta's 2026 policy requires (no open-domain assistants).
 */

export interface AgentProfileInput {
  vertical: string;
  businessName: string;
  businessInfo: string;
  tone: string;
  doNots: string;
}

/** A short, human-readable label + scope sentence per supported vertical. */
const VERTICAL_TEMPLATES: Record<
  string,
  { noun: string; scope: string }
> = {
  restaurant: {
    noun: "restaurant",
    scope:
      "the menu, dishes and prices, opening hours, location and directions, reservations and table availability, takeaway/delivery, and daily specials",
  },
  retail: {
    noun: "shop",
    scope:
      "products and prices, availability, store hours, location, orders and order status, and returns",
  },
  clinic: {
    noun: "clinic",
    scope:
      "services and treatments offered, prices, practitioners, opening hours, location, and booking or rescheduling appointments",
  },
  salon: {
    noun: "salon",
    scope:
      "services and treatments offered, prices, stylists and therapists, opening hours, location, and booking or rescheduling appointments",
  },
  real_estate: {
    noun: "real-estate business",
    scope:
      "available properties and prices, locations, and booking a site visit",
  },
};

export const HANDOFF_SENTINEL = "[[HANDOFF]]";

/**
 * Scope line for verticals without a curated template. The agent's identity
 * comes from the org's OWN vertical label — never a wrong-vertical fallback
 * (a jewellery shop must not introduce itself as a restaurant).
 */
export const GENERIC_SCOPE =
  "products and services offered, prices, availability, opening hours, location, and orders or bookings";

export function agentIdentity(vertical: string): {
  noun: string;
  scope: string;
} {
  const curated = VERTICAL_TEMPLATES[vertical];
  if (curated) return curated;
  const label = vertical.trim().replace(/_/g, " ").toLowerCase();
  return {
    noun: label ? `${label} business` : "business",
    scope: GENERIC_SCOPE,
  };
}

/** Org-local "TODAY" line so conditional facts ("weekends only") resolve correctly. */
export function formatNowLine(now: Date, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-GB", {
      ...opts,
      timeZone: timezone,
    }).format(now);
  } catch {
    formatted = new Intl.DateTimeFormat("en-GB", opts).format(now);
  }
  return formatted.replace(/\bam\b/g, "AM").replace(/\bpm\b/g, "PM");
}

/**
 * Tool-use guidance appended when the agent has a tool belt (Milestone 1).
 * This is where "worker" behavior + safety live: confirm before recording a
 * booking, capture leads on buying intent, and escalate via the tool.
 */
export const TOOL_GUIDANCE = [
  "TAKING ACTION (you have tools):",
  "- When the customer shows buying intent (interested in a product/service/property, wants a quote), call `capture_lead` so the sales team follows up. Include their name if you know it.",
  "- For a booking/appointment/reservation: once you have the name and the time (and party size if relevant), confirm them ONCE, and as soon as the customer agrees, call `capture_booking_request`. Do not keep re-asking for confirmation — one check is enough. Never call it with guessed details. After it succeeds, tell the customer the team will confirm shortly — never claim the slot is guaranteed.",
  "- Hand off ONLY for real reasons: the customer is upset or complaining, explicitly asks for a person, or needs something genuinely outside this business (a refund dispute, a legal/medical judgement call). Do NOT hand off just because you are missing a small detail.",
  "- Missing a detail is NOT a reason to hand off or to tell them to call/visit. If a fact isn't in the business information, answer what you DO know, then offer to check that one specific thing with the team — keep helping in chat.",
  "- If the customer asks something the business knowledge does not answer, call `ask_owner` with their question — then tell them you're checking with the team and will get back to them. Never guess, never invent. If the tool replies with a KNOWN fact, just answer with it.",
  "- Only take an action when it clearly fits. A simple question just needs a helpful answer — no tool.",
].join("\n");

export interface AgentPromptOptions {
  withTools?: boolean;
  /** Categorized digest from `modules/knowledge` — the primary source of truth. */
  knowledgeDigest?: string;
  /** Together with `timezone`, adds a TODAY line so conditional facts resolve. */
  now?: Date;
  timezone?: string;
}

export function buildAgentSystemPrompt(
  profile: AgentProfileInput,
  options: AgentPromptOptions = {}
): string {
  const identity = agentIdentity(profile.vertical);
  const digest = options.knowledgeDigest?.trim() ?? "";
  const blob = profile.businessInfo.trim();
  const hasTime = Boolean(options.now && options.timezone);

  const handoffRule = options.withTools
    ? "- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, use the handoff tool (see below)."
    : `- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, reply with exactly "${HANDOFF_SENTINEL}" and nothing else, so a human takes over.`;

  const knowledgeSections = digest
    ? [
        "BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):",
        digest,
        ...(blob ? ["", "ADDITIONAL BUSINESS INFORMATION:", blob] : []),
      ]
    : [
        "BUSINESS INFORMATION (this is your only source of truth — never invent anything not stated here):",
        blob || "(No details provided yet.)",
      ];

  return [
    `You are the WhatsApp assistant for "${profile.businessName}", a ${identity.noun}. You reply to customers on WhatsApp.`,
    ...(hasTime
      ? [`TODAY: ${formatNowLine(options.now!, options.timezone!)}.`]
      : []),
    "",
    `WHAT YOU HELP WITH: ${identity.scope}.`,
    "",
    ...knowledgeSections,
    "",
    `TONE: ${profile.tone}. Keep replies short and natural for WhatsApp — a sentence or two, no long paragraphs, no markdown headings.`,
    "",
    "RULES:",
    `- Only help with ${profile.businessName}. If the customer asks about anything unrelated (general knowledge, other businesses, advice, or open-ended chit-chat), politely say you can only help with ${profile.businessName} and offer what you can help with. Do NOT answer off-topic questions — you are not a general assistant.`,
    "- Never invent menu items, prices, availability, hours, or policies that are not stated above. If you don't know, say you'll check with the team.",
    ...(hasTime
      ? [
          '- Some facts carry a condition after "— only:". Apply it against TODAY — e.g. a weekends-only item is unavailable on a Tuesday; say so naturally and offer what IS available.',
        ]
      : []),
    "- Never promise a confirmed booking or order yourself — say the team will confirm.",
    profile.doNots.trim() ? `- Also avoid: ${profile.doNots.trim()}` : "",
    handoffRule,
    ...(options.withTools ? ["", TOOL_GUIDANCE] : []),
  ]
    .filter(Boolean)
    .join("\n");
}
