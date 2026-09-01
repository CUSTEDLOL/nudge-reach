import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";
import { recordUsage, type Attribution } from "@/lib/model-router/usage";

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
  /** Base64-encoded PDF (document content block — supported on Haiku,
   * no beta header; 100-page cap on 200K-context models). */
  document?: {
    data: string;
  };
  maxTokens?: number;
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
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
  document,
  maxTokens = 1024, // campaigns are short; keep the cap low to control cost
  attribution,
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
  if (document) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: document.data,
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

  if (attribution) {
    recordUsage(
      attribution,
      model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );
  }

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
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
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
  attribution,
}: ChatInput): Promise<string> {
  const model = env.RUNTIME_MODEL || "claude-haiku-4-5";
  assertRuntimeModelAllowed(model);

  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.text })),
  });

  if (attribution) {
    recordUsage(
      attribution,
      model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Tool/function-calling agent loop (Milestone 1). Same cheap-model guarantee
 * as generate()/chat(). The loop is HARD-CAPPED (maxSteps) so the agent can
 * chain tools but can never spin forever — a core reliability guard.
 *
 * The caller owns tool execution via `runTool`, keeping all side effects (DB
 * writes, tenant scoping, validation) outside the model layer.
 */
export interface AgentToolDef {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
}

export interface ToolInvocation {
  name: string;
  input: unknown;
}

export interface RunAgentInput {
  system: string;
  messages: ChatTurn[];
  tools: AgentToolDef[];
  /** Executes one tool call and returns a short result string for the model. */
  runTool: (call: ToolInvocation) => Promise<{ result: string; isError?: boolean }>;
  maxTokens?: number;
  /** Hard ceiling on model↔tool round trips (default 5). */
  maxSteps?: number;
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
}

export interface RunAgentResult {
  /** The agent's final natural-language reply. */
  text: string;
  /** Every tool the agent actually invoked, in order. */
  toolCalls: ToolInvocation[];
  /** True if the loop hit maxSteps without a clean finish. */
  cappedOut: boolean;
}

export async function runAgent({
  system,
  messages,
  tools,
  runTool,
  maxTokens = 500,
  maxSteps = 5,
  attribution,
}: RunAgentInput): Promise<RunAgentResult> {
  const model = env.RUNTIME_MODEL || "claude-haiku-4-5";
  assertRuntimeModelAllowed(model);

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));
  const toolCalls: ToolInvocation[] = [];

  // One usage row per agent run — accumulated across every loop step.
  let inputTokens = 0;
  let outputTokens = 0;
  const tally = (usage: Anthropic.Usage | undefined) => {
    inputTokens += usage?.input_tokens ?? 0;
    outputTokens += usage?.output_tokens ?? 0;
  };
  const flushUsage = () => {
    if (attribution) recordUsage(attribution, model, inputTokens, outputTokens);
  };

  for (let step = 0; step < maxSteps; step++) {
    const response = await client().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools,
      messages: convo,
    });

    tally(response.usage);
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // No tool calls → the agent is done; return its text.
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      flushUsage();
      return { text, toolCalls, cappedOut: false };
    }

    // Record the assistant turn (with its tool_use blocks) verbatim.
    convo.push({ role: "assistant", content: response.content });

    // Execute each requested tool and feed results back.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      toolCalls.push({ name: use.name, input: use.input });
      const { result, isError } = await runTool({
        name: use.name,
        input: use.input,
      });
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: result,
        is_error: isError,
      });
    }
    convo.push({ role: "user", content: results });
  }

  // Hit the cap — ask the model once more, without tools, for a safe closing line.
  const closing = await client().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [
      ...convo,
      {
        role: "user",
        content:
          "Wrap up now in one short message to the customer, without any tools.",
      },
    ],
  });
  tally(closing.usage);
  flushUsage();
  const text = closing.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, toolCalls, cappedOut: true };
}
