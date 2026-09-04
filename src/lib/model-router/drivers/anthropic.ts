import Anthropic from "@anthropic-ai/sdk";
import type {
  DriverAgentArgs,
  DriverAgentOutcome,
  DriverChatArgs,
  DriverGenerateArgs,
  DriverRuntime,
  DriverUsage,
  LlmDriver,
  ToolInvocation,
} from "@/lib/model-router/types";

/**
 * Anthropic driver — the platform default, moved verbatim from the old
 * single-provider index.ts. Clients are cached per key so BYO keys and the
 * platform key coexist.
 */

const clients = new Map<string, Anthropic>();

function client(apiKey: string): Anthropic {
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — campaign generation needs it. Add it to .env.local."
    );
  }
  let c = clients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function usageOf(u: Anthropic.Usage | undefined): DriverUsage {
  return { inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
}

export const anthropicDriver: LlmDriver = {
  async generate(rt: DriverRuntime, args: DriverGenerateArgs) {
    const content: Anthropic.ContentBlockParam[] = [];
    if (args.image) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: args.image.mediaType,
          data: args.image.data,
        },
      });
    }
    if (args.document) {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: args.document.data,
        },
      });
    }
    content.push({ type: "text", text: args.prompt });

    const response = await client(rt.apiKey).messages.create({
      model: rt.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: "user", content }],
    });
    return { text: textOf(response.content), usage: usageOf(response.usage) };
  },

  async chat(rt: DriverRuntime, args: DriverChatArgs) {
    const response = await client(rt.apiKey).messages.create({
      model: rt.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: args.messages.map((m) => ({ role: m.role, content: m.text })),
    });
    return { text: textOf(response.content).trim(), usage: usageOf(response.usage) };
  },

  async runAgent(rt: DriverRuntime, args: DriverAgentArgs): Promise<DriverAgentOutcome> {
    const convo: Anthropic.MessageParam[] = args.messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));
    const toolCalls: ToolInvocation[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    const tally = (u: Anthropic.Usage | undefined) => {
      inputTokens += u?.input_tokens ?? 0;
      outputTokens += u?.output_tokens ?? 0;
    };
    // Neutral ToolSchema is a superset-compatible shape of Anthropic's.
    const tools = args.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));

    for (let step = 0; step < args.maxSteps; step++) {
      const response = await client(rt.apiKey).messages.create({
        model: rt.model,
        max_tokens: args.maxTokens,
        system: args.system,
        tools,
        messages: convo,
      });

      tally(response.usage);
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        return {
          text: textOf(response.content).trim(),
          toolCalls,
          cappedOut: false,
          usage: { inputTokens, outputTokens },
        };
      }

      convo.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        toolCalls.push({ name: use.name, input: use.input });
        const { result, isError } = await args.runTool({
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

    // Hit the cap — one closing call without tools for a safe wrap-up line.
    const closing = await client(rt.apiKey).messages.create({
      model: rt.model,
      max_tokens: args.maxTokens,
      system: args.system,
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
    return {
      text: textOf(closing.content).trim(),
      toolCalls,
      cappedOut: true,
      usage: { inputTokens, outputTokens },
    };
  },
};
