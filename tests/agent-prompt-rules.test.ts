import { describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  type AgentProfileInput,
  type AgentPromptOptions,
} from "@/modules/agent/prompt";
import { renderRulesBlock } from "@/modules/agent/rules";

/**
 * The bug this file pins: the owner typed "push everyone to the waitlist at
 * <url>" and the AI ignored it, because the knowledge was introduced as "your
 * only source of truth" and the owner's instruction sat beneath it. House rules
 * now sit ABOVE the knowledge and the heading no longer contradicts them.
 */

const profile: AgentProfileInput = {
  vertical: "clinic",
  businessName: "Gut Feeling",
  businessInfo: "Legacy blob info here.",
  tone: "warm and direct",
  doNots: "medical advice",
};

const digest = "SERVICES\n- Consult ₹500";

const rules = [
  { instruction: "Always point people to the waitlist at https://getgutfeeling.in/" },
  { instruction: "Never quote a price; offer a consultation instead" },
];

const RULES_HEADING =
  "HOUSE RULES — follow these in every reply, even when the knowledge below points elsewhere:";

const OLD_KNOWLEDGE_HEADING =
  "BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):";
const NEW_KNOWLEDGE_HEADING =
  "BUSINESS KNOWLEDGE — your source of truth for facts (never invent anything not stated here):";
const OLD_INFO_HEADING =
  "BUSINESS INFORMATION (this is your only source of truth — never invent anything not stated here):";
const NEW_INFO_HEADING =
  "BUSINESS INFORMATION — your source of truth for facts (never invent anything not stated here):";

/**
 * Captured from the builder at 85e0e49, BEFORE house rules existed. An org with
 * no rules must still get exactly this prompt apart from two deliberate
 * changes: the softened heading, and the removal of the two retired Setup
 * boxes (`ADDITIONAL BUSINESS INFORMATION:` + its blob, and `- Also avoid: …`),
 * which the migration now carries as rules and facts. Each test below states
 * the transformation it applies. Regenerate only with a deliberate change.
 */
const WHATSAPP_OPTIONS: AgentPromptOptions = {
  knowledgeDigest: digest,
  now: new Date("2026-09-22T10:00:00Z"),
  timezone: "Asia/Kolkata",
};
const GOLDEN_WHATSAPP_BEFORE = `You are the WhatsApp assistant for "Gut Feeling", a clinic. You reply to customers on WhatsApp.
TODAY: Tuesday, 22 September 2026 at 3:30 PM.
WHAT YOU HELP WITH: services and treatments offered, prices, practitioners, opening hours, location, and booking or rescheduling appointments.
BUSINESS KNOWLEDGE (your only source of truth — never invent anything not stated here):
SERVICES
- Consult ₹500
ADDITIONAL BUSINESS INFORMATION:
Legacy blob info here.
TONE: warm and direct. Keep replies short and natural for WhatsApp — a sentence or two, no long paragraphs, no markdown headings.
RULES:
- Only help with Gut Feeling. If the customer asks about anything unrelated (general knowledge, other businesses, advice, or open-ended chit-chat), politely say you can only help with Gut Feeling and offer what you can help with. Do NOT answer off-topic questions — you are not a general assistant.
- Write plain WhatsApp text. For emphasis use WhatsApp's *single asterisks* sparingly — never Markdown (no **double asterisks**, no ## headings, no [links](...)).
- Never invent menu items, prices, availability, hours, or policies. When naming items or prices, use ONLY those stated above, exactly as stated. If you don't know, say you'll check with the team.
- Some facts carry a condition after "— only:". Apply it against TODAY — e.g. a weekends-only item is unavailable on a Tuesday; say so naturally and offer what IS available.
- Never promise a confirmed booking or order yourself — say the team will confirm.
- Also avoid: medical advice
- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, reply with exactly "[[HANDOFF]]" and nothing else, so a human takes over.`;

const VOICE_OPTIONS: AgentPromptOptions = { channel: "voice" };
const GOLDEN_VOICE_BEFORE = `You are the phone assistant for "Gut Feeling", a clinic. You are speaking with a customer on a live phone call.
WHAT YOU HELP WITH: services and treatments offered, prices, practitioners, opening hours, location, and booking or rescheduling appointments.
BUSINESS INFORMATION (this is your only source of truth — never invent anything not stated here):
Legacy blob info here.
TONE: warm and direct. Speak the way a warm, efficient receptionist talks on the phone.
PHONE MANNERS (you are speaking, not typing):
- Reply in one or two short spoken sentences, each under 20 words. Ask one question at a time. No filler openers such as "Great question" or "I appreciate that" — start with the answer.
- Plain speech only: no emojis, no markdown, no bullet points, no headings, no symbols.
- Say numbers and prices in words as a person would ("three hundred rupees", "five thirty pm") — never symbols like ₹ or digit strings.
- Never read out a web link or claim that a message was sent unless a tool confirms it.
- Never list more than three items aloud. Offer to have the team follow up with full details.
- Confirm names, dates, times and phone numbers back to the caller before saving. Read phone numbers back digit by digit.
- If the caller speaks Hindi or Hinglish, reply the same way. Match their language.
- If you did not catch something, ask them to repeat it — never guess a name or a time.
- Never narrate your tools. Never say "let me capture / record / note / save that" or mention checking a system — use the tool silently and keep talking like a person. Around a tool call say at most one short sentence before it and one after — never the same thing twice.
RULES:
- Only help with Gut Feeling. If the customer asks about anything unrelated (general knowledge, other businesses, advice, or open-ended chit-chat), politely say you can only help with Gut Feeling and offer what you can help with. Do NOT answer off-topic questions — you are not a general assistant.
- Write plain WhatsApp text. For emphasis use WhatsApp's *single asterisks* sparingly — never Markdown (no **double asterisks**, no ## headings, no [links](...)).
- Never invent menu items, prices, availability, hours, or policies. When naming items or prices, use ONLY those stated above, exactly as stated. If you don't know, say you'll check with the team.
- Never promise a confirmed booking or order yourself — say the team will confirm.
- Also avoid: medical advice
- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, reply with exactly "[[HANDOFF]]" and nothing else, so a human takes over.`;

describe("house rules outrank the facts", () => {
  it("puts the rules block above the knowledge, with nothing between them", () => {
    const p = buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules });

    expect(p).toContain(renderRulesBlock(rules));
    expect(p.indexOf(RULES_HEADING)).toBeGreaterThan(-1);
    expect(p.indexOf(RULES_HEADING)).toBeLessThan(
      p.indexOf(NEW_KNOWLEDGE_HEADING)
    );

    // "Immediately before": the last rule is the line above the heading, so no
    // other instruction can wedge itself in and re-order the priority.
    const lines = p.split("\n");
    const headingAt = lines.indexOf(NEW_KNOWLEDGE_HEADING);
    expect(headingAt).toBeGreaterThan(0);
    expect(lines[headingAt - 1]).toBe(`- ${rules[1].instruction}`);
    expect(lines[headingAt - rules.length - 1]).toBe(RULES_HEADING);
  });

  it("puts the rules above the business information when there is no digest", () => {
    const p = buildAgentSystemPrompt(profile, { rules });
    expect(p.indexOf(RULES_HEADING)).toBeGreaterThan(-1);
    expect(p.indexOf(RULES_HEADING)).toBeLessThan(p.indexOf(NEW_INFO_HEADING));
    // The blob no longer fills that section; with no digest it is empty.
    expect(p).not.toContain("Legacy blob info here.");
    expect(p).toContain("(No details provided yet.)");
  });

  it("carries the owner's own instruction verbatim", () => {
    const p = buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules });
    expect(p).toContain(
      "- Always point people to the waitlist at https://getgutfeeling.in/"
    );
  });

  it("applies on a voice call too", () => {
    const p = buildAgentSystemPrompt(profile, { ...VOICE_OPTIONS, rules });
    expect(p).toContain(RULES_HEADING);
    expect(p).toContain("- Never quote a price; offer a consultation instead");
    expect(p.indexOf(RULES_HEADING)).toBeLessThan(p.indexOf(NEW_INFO_HEADING));
  });

  it("applies on a voice call with a digest and tools", () => {
    const p = buildAgentSystemPrompt(profile, {
      channel: "voice",
      canTransfer: true,
      withTools: true,
      knowledgeDigest: digest,
      rules,
    });
    expect(p.indexOf(RULES_HEADING)).toBeLessThan(
      p.indexOf(NEW_KNOWLEDGE_HEADING)
    );
    expect(p).toContain("PHONE MANNERS");
  });
});

describe("the heading that was defeating the rules", () => {
  const combos: Array<[string, AgentPromptOptions]> = [
    ["digest + rules", { ...WHATSAPP_OPTIONS, rules }],
    ["digest, no rules", WHATSAPP_OPTIONS],
    ["no digest + rules", { rules }],
    ["no digest, no rules", {}],
    ["voice + rules", { ...VOICE_OPTIONS, rules }],
    ["voice with tools", { channel: "voice", withTools: true, rules }],
  ];

  for (const [label, options] of combos) {
    it(`never claims to be the only source of truth (${label})`, () => {
      expect(buildAgentSystemPrompt(profile, options)).not.toContain(
        "your only source of truth"
      );
    });
  }

  it("softens the digest heading without dropping never-invent", () => {
    const p = buildAgentSystemPrompt(profile, WHATSAPP_OPTIONS);
    expect(p).toContain(NEW_KNOWLEDGE_HEADING);
    expect(p).not.toContain(OLD_KNOWLEDGE_HEADING);
  });

  it("softens the no-digest heading without dropping never-invent", () => {
    const p = buildAgentSystemPrompt(profile, {});
    expect(p).toContain(NEW_INFO_HEADING);
    expect(p).not.toContain(OLD_INFO_HEADING);
  });

  it("leaves the digest itself untouched", () => {
    const p = buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules });
    expect(p).toContain(`${NEW_KNOWLEDGE_HEADING}\n${digest}`);
  });
});

/**
 * The retired `/agent/setup` boxes. `migrateProfileToRules` copies both into
 * house rules and knowledge facts, so rendering them here as well sent every
 * migrated org the same text twice — and left the stale original underneath an
 * edited rule. These four assertions are the opposite of what this file used to
 * assert ("keeps the legacy blob exactly where it was" / "keeps the owner's
 * doNots line"); those two tests encoded the duplication.
 */
describe("the retired Setup boxes never reach the model", () => {
  const everyShape: Array<[string, AgentPromptOptions]> = [
    ["digest + rules", { ...WHATSAPP_OPTIONS, rules }],
    ["digest, no rules", WHATSAPP_OPTIONS],
    ["no digest + rules", { rules }],
    ["no digest, no rules", {}],
    ["voice", VOICE_OPTIONS],
    ["voice + digest + tools", { ...VOICE_OPTIONS, knowledgeDigest: digest, withTools: true, rules }],
    ["whatsapp + tools", { ...WHATSAPP_OPTIONS, withTools: true, rules }],
  ];

  for (const [label, options] of everyShape) {
    it(`drops businessInfo and doNots (${label})`, () => {
      const p = buildAgentSystemPrompt(profile, options);
      expect(p).not.toContain("ADDITIONAL BUSINESS INFORMATION");
      expect(p).not.toContain(profile.businessInfo);
      expect(p).not.toContain("Also avoid");
      expect(p).not.toContain(profile.doNots);
    });
  }

  it("still renders the rules and the digest that replaced them", () => {
    const p = buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules });
    expect(p).toContain(renderRulesBlock(rules));
    expect(p).toContain(digest);
    expect(p).toContain("- Consult ₹500");
  });

  it("keeps the RULES block intact where the doNots line used to sit", () => {
    const p = buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules });
    expect(p).toContain(
      '- Never promise a confirmed booking or order yourself — say the team will confirm.\n- If the customer is upset, wants something you cannot handle, or explicitly asks for a person, reply with exactly "[[HANDOFF]]"'
    );
  });
});

describe("invariant #7 — rules are not an escape hatch", () => {
  const withRules = { ...WHATSAPP_OPTIONS, rules };

  it("keeps the one-business scope guardrail", () => {
    const p = buildAgentSystemPrompt(profile, withRules);
    expect(p).toContain(
      `- Only help with ${profile.businessName}. If the customer asks about anything unrelated`
    );
    expect(p).toContain("you are not a general assistant.");
  });

  it("keeps the never-invent instruction", () => {
    const p = buildAgentSystemPrompt(profile, withRules);
    expect(p).toContain(
      "- Never invent menu items, prices, availability, hours, or policies."
    );
    expect(p).toContain(
      "When naming items or prices, use ONLY those stated above, exactly as stated."
    );
  });

  it("keeps both guardrails on a voice call with rules", () => {
    const p = buildAgentSystemPrompt(profile, { ...VOICE_OPTIONS, rules });
    expect(p).toContain(`- Only help with ${profile.businessName}.`);
    expect(p).toContain("- Never invent menu items, prices, availability");
  });

  it("drops the owner's doNots line — the migration carries it as a rule", () => {
    const p = buildAgentSystemPrompt(profile, withRules);
    expect(p).not.toContain("- Also avoid: medical advice");
  });
});

describe("an org with no rules is untouched", () => {
  it("shows no HOUSE RULES heading", () => {
    expect(buildAgentSystemPrompt(profile, WHATSAPP_OPTIONS)).not.toContain(
      "HOUSE RULES"
    );
    expect(
      buildAgentSystemPrompt(profile, { ...WHATSAPP_OPTIONS, rules: [] })
    ).not.toContain("HOUSE RULES");
  });

  it("gets the pre-house-rules prompt apart from the heading and the retired boxes (whatsapp)", () => {
    expect(GOLDEN_WHATSAPP_BEFORE).toContain(OLD_KNOWLEDGE_HEADING);
    const expected = GOLDEN_WHATSAPP_BEFORE
      .replace(OLD_KNOWLEDGE_HEADING, NEW_KNOWLEDGE_HEADING)
      .replace("\nADDITIONAL BUSINESS INFORMATION:\nLegacy blob info here.", "")
      .replace("\n- Also avoid: medical advice", "");
    expect(buildAgentSystemPrompt(profile, WHATSAPP_OPTIONS)).toBe(expected);
  });

  it("gets the pre-house-rules prompt apart from the heading and the retired boxes (voice)", () => {
    expect(GOLDEN_VOICE_BEFORE).toContain(OLD_INFO_HEADING);
    const expected = GOLDEN_VOICE_BEFORE
      .replace(OLD_INFO_HEADING, NEW_INFO_HEADING)
      // With no digest and no blob, the section says so rather than vanishing.
      .replace("\nLegacy blob info here.", "\n(No details provided yet.)")
      .replace("\n- Also avoid: medical advice", "");
    expect(buildAgentSystemPrompt(profile, VOICE_OPTIONS)).toBe(expected);
  });

  it("an empty rules array reads the same as no rules key at all", () => {
    const combos: AgentPromptOptions[] = [
      {},
      WHATSAPP_OPTIONS,
      VOICE_OPTIONS,
      { withTools: true },
      { withTools: true, knowledgeDigest: digest },
      {
        withTools: true,
        customTools: [{ name: "check_stock", description: "live stock" }],
      },
      { channel: "voice", withTools: true, canTransfer: true },
    ];
    for (const options of combos) {
      expect(buildAgentSystemPrompt(profile, { ...options, rules: [] })).toBe(
        buildAgentSystemPrompt(profile, options)
      );
    }
  });
});
