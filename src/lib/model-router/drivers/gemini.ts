import { GoogleGenAI, type Content } from "@google/genai";
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

/** Google Gemini driver (E3 BYO-LLM) — generateContent with function calling. */

const clients = new Map<string, GoogleGenAI>();

function client(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error("Google AI API key is missing for this workspace.");
  let c = clients.get(apiKey);
  if (!c) {
    c = new GoogleGenAI({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

function usageOf(u: GeminiUsage | undefined): DriverUsage {
  return {
    inputTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
  };
}

function toContents(messages: { role: "user" | "assistant"; text: string }[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
}

function toolConfig(args: DriverAgentArgs) {
  return [
    {
      functionDeclarations: args.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.input_schema as Record<string, unknown>,
      })),
    },
  ];
}

export const geminiDriver: LlmDriver = {
  async generate(rt: DriverRuntime, args: DriverGenerateArgs) {
    if (args.document) {
      // The doorway routes PDF ingest to the platform driver; belt and braces.
      throw new Error("PDF documents are not supported on the Gemini driver.");
    }
    const parts: Content["parts"] = [];
    if (args.image) {
      parts!.push({
        inlineData: { mimeType: args.image.mediaType, data: args.image.data },
      });
    }
    parts!.push({ text: args.prompt });

    const response = await client(rt.apiKey).models.generateContent({
      model: rt.model,
      contents: [{ role: "user", parts }],
      config: { systemInstruction: args.system, maxOutputTokens: args.maxTokens },
    });
    return { text: response.text ?? "", usage: usageOf(response.usageMetadata) };
  },

  async chat(rt: DriverRuntime, args: DriverChatArgs) {
    const response = await client(rt.apiKey).models.generateContent({
      model: rt.model,
      contents: toContents(args.messages),
      config: { systemInstruction: args.system, maxOutputTokens: args.maxTokens },
    });
    return {
      text: (response.text ?? "").trim(),
      usage: usageOf(response.usageMetadata),
    };
  },

  async runAgent(rt: DriverRuntime, args: DriverAgentArgs): Promise<DriverAgentOutcome> {
    const convo: Content[] = toContents(args.messages);
    const toolCalls: ToolInvocation[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    const tally = (u: GeminiUsage | undefined) => {
      inputTokens += u?.promptTokenCount ?? 0;
      outputTokens += u?.candidatesTokenCount ?? 0;
    };

    for (let step = 0; step < args.maxSteps; step++) {
      const response = await client(rt.apiKey).models.generateContent({
        model: rt.model,
        contents: convo,
        config: {
          systemInstruction: args.system,
          maxOutputTokens: args.maxTokens,
          tools: toolConfig(args),
        },
      });
      tally(response.usageMetadata);
      const calls = response.functionCalls ?? [];

      if (calls.length === 0) {
        return {
          text: (response.text ?? "").trim(),
          toolCalls,
          cappedOut: false,
          usage: { inputTokens, outputTokens },
        };
      }

      convo.push({
        role: "model",
        parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
      });
      const responseParts: NonNullable<Content["parts"]> = [];
      for (const call of calls) {
        const name = call.name ?? "";
        const input = call.args ?? {};
        toolCalls.push({ name, input });
        const { result, isError } = await args.runTool({ name, input });
        responseParts.push({
          functionResponse: {
            name,
            response: isError ? { error: result } : { result },
          },
        });
      }
      convo.push({ role: "user", parts: responseParts });
    }

    // Hit the cap — one closing call without tools for a safe wrap-up line.
    const closing = await client(rt.apiKey).models.generateContent({
      model: rt.model,
      contents: [
        ...convo,
        {
          role: "user",
          parts: [{ text: "Wrap up now in one short message to the customer, without any tools." }],
        },
      ],
      config: { systemInstruction: args.system, maxOutputTokens: args.maxTokens },
    });
    tally(closing.usageMetadata);
    return {
      text: (closing.text ?? "").trim(),
      toolCalls,
      cappedOut: true,
      usage: { inputTokens, outputTokens },
    };
  },
};
