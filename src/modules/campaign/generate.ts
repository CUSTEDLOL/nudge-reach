import { generate } from "@/lib/model-router";
import { extractJson, repairAndValidate } from "@/modules/campaign/guardrails";
import type { CampaignContent } from "@/modules/campaign/schema";

/**
 * Market voice for AI copywriting (global outreach): Indian workspaces keep
 * the original PRD §7 voice (light Hinglish); everyone else gets clear
 * international English. Derived from the org's dial code at the call site.
 */
export type MarketVoice = "india" | "global";

export function marketVoiceForDialCode(dialCode: string): MarketVoice {
  return dialCode === "+91" ? "india" : "global";
}

const VOICE_LINES: Record<
  MarketVoice,
  { audience: string; tone: string; sampleName: string }
> = {
  india: {
    audience: "Indian small retail businesses",
    tone: "Keep it local and personal (Indian retail voice; light Hinglish allowed if natural).",
    sampleName: "a realistic Indian first name",
  },
  global: {
    audience: "small retail and service businesses",
    tone: "Keep it warm, local and personal, in clear international English (no slang, no region-specific phrases).",
    sampleName: "a realistic first name common in the business's market",
  },
};

/** PRD §7 system prompt, parameterized by market voice. */
function systemPrompt(voice: MarketVoice): string {
  const v = VOICE_LINES[voice];
  return `You are a senior WhatsApp marketing strategist for ${v.audience}. Given a product (image and/or short description), produce ONE high-converting, Meta-policy-compliant WhatsApp MARKETING template. Rules: the body is warm, concrete and under 600 characters; it uses {{1}} exactly once near the start for the customer's first name; it states one clear offer and one clear next step; no ALL-CAPS shouting, no misleading claims, no prohibited content. ${v.tone} Return ONLY a JSON object — no markdown, no commentary.

The JSON object must have exactly these keys:
{
  "productName": "string",
  "campaignAngle": "one sentence on the strategy",
  "header": "string, <=55 chars",
  "body": "string containing {{1}} exactly once",
  "footer": "string, short, MUST contain an opt-out e.g. 'Reply STOP to unsubscribe'",
  "buttons": [
    { "type": "URL", "text": "Shop now", "url": "https://example.com" },
    { "type": "QUICK_REPLY", "text": "Send catalog" }
  ],
  "sampleName": "${v.sampleName}",
  "imageTreatment": "one sentence: how to shoot/crop/light this photo",
  "notes": "one short practical tip"
}`;
}

export interface GenerateCampaignInput {
  description?: string;
  image?: {
    data: string; // base64
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
  /** Market copywriting voice; defaults to the original Indian voice. */
  voice?: MarketVoice;
  /** Org the generated copy is billed to (AI usage metering). */
  orgId?: string;
}

function buildUserPrompt(description?: string): string {
  const parts = ["Create the WhatsApp marketing campaign JSON now."];
  if (description?.trim()) {
    parts.push(`Product description from the shop owner: ${description.trim()}`);
  } else {
    parts.push("Base it on the attached product photo.");
  }
  return parts.join("\n");
}

/**
 * Photo/description → validated CampaignContent. Parses defensively and
 * retries once with a stricter instruction before surfacing a friendly
 * error (PRD §7 guardrails).
 */
export async function generateCampaignContent(
  input: GenerateCampaignInput
): Promise<CampaignContent> {
  if (!input.description?.trim() && !input.image) {
    throw new Error("Provide a product photo or a short description.");
  }

  const system = systemPrompt(input.voice ?? "india");
  const prompt = buildUserPrompt(input.description);
  const attribution = input.orgId
    ? ({ orgId: input.orgId, purpose: "campaign_copy" } as const)
    : undefined;
  let text = await generate({
    system,
    prompt,
    image: input.image,
    maxTokens: 1024,
    attribution,
  });

  let parsed = extractJson(text);
  if (!parsed.ok) {
    text = await generate({
      system,
      prompt:
        `${prompt}\n\nIMPORTANT: Your previous reply was not valid JSON. ` +
        `Respond with ONLY the JSON object — first character "{", last character "}".`,
      image: input.image,
      maxTokens: 1024,
      attribution,
    });
    parsed = extractJson(text);
  }

  if (!parsed.ok) {
    throw new Error(
      "We couldn't write your campaign just now — please try again in a moment."
    );
  }
  return repairAndValidate(parsed.value);
}
