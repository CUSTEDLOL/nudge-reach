/**
 * Provider-neutral contracts for the model-router (E3). The public doorway
 * (index.ts) resolves a driver per call; drivers marshal these shapes into
 * their SDK's wire format. No Anthropic/OpenAI/Google types may leak out of
 * a driver file.
 */

export type LlmProvider = "anthropic" | "openai" | "google";

/** Plain JSON-Schema object shape — what every provider's tool-calling accepts. */
export interface ToolSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface AgentToolDef {
  name: string;
  description: string;
  input_schema: ToolSchema;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ToolInvocation {
  name: string;
  input: unknown;
}

/** What a resolved call runs with: which model, on whose key. */
export interface DriverRuntime {
  model: string;
  apiKey: string;
}

export interface DriverUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface DriverGenerateArgs {
  system: string;
  prompt: string;
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
  document?: { data: string };
  maxTokens: number;
}

export interface DriverChatArgs {
  system: string;
  messages: ChatTurn[];
  maxTokens: number;
}

export interface DriverAgentArgs {
  system: string;
  messages: ChatTurn[];
  tools: AgentToolDef[];
  runTool: (call: ToolInvocation) => Promise<{ result: string; isError?: boolean }>;
  maxTokens: number;
  maxSteps: number;
}

export interface DriverAgentOutcome {
  text: string;
  toolCalls: ToolInvocation[];
  cappedOut: boolean;
  usage: DriverUsage;
}

export interface LlmDriver {
  generate(
    rt: DriverRuntime,
    args: DriverGenerateArgs
  ): Promise<{ text: string; usage: DriverUsage }>;
  chat(
    rt: DriverRuntime,
    args: DriverChatArgs
  ): Promise<{ text: string; usage: DriverUsage }>;
  runAgent(rt: DriverRuntime, args: DriverAgentArgs): Promise<DriverAgentOutcome>;
}
