import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";

/**
 * Platform module: the ONLY doorway through which the app talks to an LLM.
 *
 * Rule 3 (CLAUDE.md): the deployed app calls the cheapest vision-capable
 * tier — default Claude Haiku — never an expensive build-time model. The
 * model comes from RUNTIME_MODEL env and is validated by the guard below.
 */

export interface GenerateInput {
  system: string;
  prompt: string;
  /** Base64-encoded image for the vision path. */
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
  maxTokens?: number;
}

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — campaign generation needs it. Add it to .env.local."
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function generate({
  system,
  prompt,
  image,
  maxTokens = 1024, // campaigns are short; keep the cap low to control cost
}: GenerateInput): Promise<string> {
  const model = env.RUNTIME_MODEL || "claude-haiku-4-5";
  assertRuntimeModelAllowed(model);

  const content: Anthropic.ContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.data,
      },
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
  });

  return response.content
    .filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    )
    .map((block) => block.text)
    .join("");
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatInput {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}

/**
 * Multi-turn chat for the conversational agent (Phase 7). Same cheap-model
 * guarantee as generate() — Haiku tier only, never an expensive model.
 * Tool/function-calling is layered on in Phase 9.
 */
export async function chat({
  system,
  messages,
  maxTokens = 400, // WhatsApp replies are short; keep cost + latency low
}: ChatInput): Promise<string> {
  const model = env.RUNTIME_MODEL || "claude-haiku-4-5";
  assertRuntimeModelAllowed(model);

  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.text })),
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
