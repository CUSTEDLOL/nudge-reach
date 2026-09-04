import OpenAI from "openai";
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

/** OpenAI driver (E3 BYO-LLM) — chat-completions with function calling. */

const clients = new Map<string, OpenAI>();

function client(apiKey: string): OpenAI {
  if (!apiKey) throw new Error("OpenAI API key is missing for this workspace.");
  let c = clients.get(apiKey);
  if (!c) {
    c = new OpenAI({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function usageOf(u: { prompt_tokens?: number; completion_tokens?: number } | undefined | null): DriverUsage {
  return { inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0 };
}

function toTools(args: DriverAgentArgs): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return args.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

export const openaiDriver: LlmDriver = {
  async generate(rt: DriverRuntime, args: DriverGenerateArgs) {
    if (args.document) {
      // The doorway routes PDF ingest to the platform driver; belt and braces.
      throw new Error("PDF documents are not supported on the OpenAI driver.");
    }
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    if (args.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${args.image.mediaType};base64,${args.image.data}` },
      });
    }
    userContent.push({ type: "text", text: args.prompt });

    const response = await client(rt.apiKey).chat.completions.create({
      model: rt.model,
      max_completion_tokens: args.maxTokens,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: userContent },
      ],
    });
    return {
      text: response.choices[0]?.message?.content ?? "",
      usage: usageOf(response.usage),
    };
  },

  async chat(rt: DriverRuntime, args: DriverChatArgs) {
    const response = await client(rt.apiKey).chat.completions.create({
      model: rt.model,
      max_completion_tokens: args.maxTokens,
      messages: [
        { role: "system", content: args.system },
        ...args.messages.map((m) => ({ role: m.role, content: m.text })),
      ],
    });
    return {
      text: (response.choices[0]?.message?.content ?? "").trim(),
      usage: usageOf(response.usage),
    };
  },

  async runAgent(rt: DriverRuntime, args: DriverAgentArgs): Promise<DriverAgentOutcome> {
    const convo: Message[] = [
      { role: "system", content: args.system },
      ...args.messages.map((m) => ({ role: m.role, content: m.text })),
    ];
    const toolCalls: ToolInvocation[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    const tally = (u: { prompt_tokens?: number; completion_tokens?: number } | undefined | null) => {
      inputTokens += u?.prompt_tokens ?? 0;
      outputTokens += u?.completion_tokens ?? 0;
    };

    for (let step = 0; step < args.maxSteps; step++) {
      const response = await client(rt.apiKey).chat.completions.create({
        model: rt.model,
        max_completion_tokens: args.maxTokens,
        messages: convo,
        tools: toTools(args),
      });
      tally(response.usage);
      const message = response.choices[0]?.message;
      const calls = message?.tool_calls ?? [];

      if (!message || calls.length === 0) {
        return {
          text: (message?.content ?? "").trim(),
          toolCalls,
          cappedOut: false,
          usage: { inputTokens, outputTokens },
        };
      }

      convo.push(message);
      for (const call of calls) {
        if (call.type !== "function") continue;
        let input: unknown = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = {};
        }
        toolCalls.push({ name: call.function.name, input });
        const { result, isError } = await args.runTool({ name: call.function.name, input });
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: isError ? `ERROR: ${result}` : result,
        });
      }
    }

    // Hit the cap — one closing call without tools for a safe wrap-up line.
    const closing = await client(rt.apiKey).chat.completions.create({
      model: rt.model,
      max_completion_tokens: args.maxTokens,
      messages: [
        ...convo,
        {
          role: "user",
          content: "Wrap up now in one short message to the customer, without any tools.",
        },
      ],
    });
    tally(closing.usage);
    return {
      text: (closing.choices[0]?.message?.content ?? "").trim(),
      toolCalls,
      cappedOut: true,
      usage: { inputTokens, outputTokens },
    };
  },
};
