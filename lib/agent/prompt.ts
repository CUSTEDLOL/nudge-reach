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
      "services offered, opening hours, location, and booking or rescheduling appointments",
  },
  real_estate: {
    noun: "real-estate business",
    scope:
      "available properties and prices, locations, and booking a site visit",
  },
};

export const HANDOFF_SENTINEL = "[[HANDOFF]]";

/**
 * Tool-use guidance appended when the agent has a tool belt (Milestone 1).
 * This is where "worker" behavior + safety live: confirm before recording a
 * booking, capture leads on buying intent, and escalate via the tool.
 */
export const TOOL_GUIDANCE = [
  "TAKING ACTION (you have tools):",
  "- When the customer shows buying intent (interested in a product/service/property, wants a quote), call `capture_lead` so the sales team follows up. Include their name if you know it.",
  "- For a booking/appointment/reservation: once you have the name and the time (and party size if relevant), confirm them ONCE, and as soon as the customer agrees, call `capture_booking_request`. Do not keep re-asking for confirmation — one check is enough. Never call it with guessed details. After it succeeds, tell the customer the team will confirm shortly — never claim the slot is guaranteed.",
  "- If the customer is upset, asks for a person, wants something you can't do, or you're unsure, call `handoff_to_human` and tell them a teammate will follow up.",
  "- Only take an action when it clearly fits. A simple question just needs a helpful answer — no tool.",
].join("\n");

export function buildAgentSystemPrompt(
  profile: AgentProfileInput,
  options: { withTools?: boolean } = {}
): string {
  const template =
    VERTICAL_TEMPLATES[profile.vertical] ?? VERTICAL_TEMPLATES.restaurant;

  const handoffRule = options.withTools
    ? "- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, use the handoff tool (see below)."
    : `- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, reply with exactly "${HANDOFF_SENTINEL}" and nothing else, so a human takes over.`;

  return [
    `You are the WhatsApp assistant for "${profile.businessName}", a ${template.noun}. You reply to customers on WhatsApp.`,
    "",
    `WHAT YOU HELP WITH: ${template.scope}.`,
    "",
    "BUSINESS INFORMATION (this is your only source of truth — never invent anything not stated here):",
    profile.businessInfo.trim() || "(No details provided yet.)",
    "",
    `TONE: ${profile.tone}. Keep replies short and natural for WhatsApp — a sentence or two, no long paragraphs, no markdown headings.`,
    "",
    "RULES:",
    `- Only help with ${profile.businessName}. If the customer asks about anything unrelated (general knowledge, other businesses, advice, or open-ended chit-chat), politely say you can only help with ${profile.businessName} and offer what you can help with. Do NOT answer off-topic questions — you are not a general assistant.`,
    "- Never invent menu items, prices, availability, hours, or policies that are not in the BUSINESS INFORMATION above. If you don't know, say you'll check with the team.",
    "- Never promise a confirmed booking or order yourself — say the team will confirm.",
    profile.doNots.trim() ? `- Also avoid: ${profile.doNots.trim()}` : "",
    handoffRule,
    ...(options.withTools ? ["", TOOL_GUIDANCE] : []),
  ]
    .filter(Boolean)
    .join("\n");
}
