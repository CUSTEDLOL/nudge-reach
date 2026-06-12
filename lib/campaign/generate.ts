import { generate } from "@/lib/model-router";
import { extractJson, repairAndValidate } from "@/lib/campaign/guardrails";
import type { CampaignContent } from "@/lib/campaign/schema";

/** PRD §7 system prompt, verbatim starting point. */
const SYSTEM_PROMPT = `You are a senior WhatsApp marketing strategist for Indian small retail businesses. Given a product (image and/or short description), produce ONE high-converting, Meta-policy-compliant WhatsApp MARKETING template. Rules: the body is warm, concrete and under 600 characters; it uses {{1}} exactly once near the start for the customer's first name; it states one clear offer and one clear next step; no ALL-CAPS shouting, no misleading claims, no prohibited content. Keep it local and personal (Indian retail voice; light Hinglish allowed if natural). Return ONLY a JSON object — no markdown, no commentary.

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
  "sampleName": "a realistic Indian first name",
  "imageTreatment": "one sentence: how to shoot/crop/light this photo",
  "notes": "one short practical tip"
}`;

export interface GenerateCampaignInput {
  description?: string;
  image?: {
    data: string; // base64
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
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

  const prompt = buildUserPrompt(input.description);
  let text = await generate({
    system: SYSTEM_PROMPT,
    prompt,
    image: input.image,
    maxTokens: 1024,
  });

  let parsed = extractJson(text);
  if (!parsed.ok) {
    text = await generate({
      system: SYSTEM_PROMPT,
      prompt:
        `${prompt}\n\nIMPORTANT: Your previous reply was not valid JSON. ` +
        `Respond with ONLY the JSON object — first character "{", last character "}".`,
      image: input.image,
      maxTokens: 1024,
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
