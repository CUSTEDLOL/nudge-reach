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
  /**
   * UNCACHED input tokens, on every provider. Anthropic reports this shape
   * natively; the OpenAI and Google drivers subtract their cached portion out
   * of the provider's prompt-token count so the rate card prices one meaning.
   */
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache tokens, priced separately from inputTokens. Omitted = 0. */
  cacheReadTokens?: number;
  /** Anthropic only — OpenAI and Google cache automatically, with no write charge. */
  cacheWriteTokens?: number;
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

/**
 * `systemTail` is system text that changes call to call (the agent's TODAY
 * line). Anthropic sends it as a second, uncached block after the cached
 * `system`, so a per-minute clock cannot bust the prompt cache. Drivers
 * without an explicit breakpoint append it via `fullSystem`.
 */
export interface DriverChatArgs {
  system: string;
  systemTail?: string;
  messages: ChatTurn[];
  maxTokens: number;
}

export interface DriverAgentArgs {
  system: string;
  systemTail?: string;
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
  /** Every line the model said across the loop, in order (pre-tool lines included). */
  spoken?: string[];
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

/** `system` + `systemTail` as one string, for drivers with implicit caching. */
export function fullSystem(args: { system: string; systemTail?: string }): string {
  return args.systemTail ? `${args.system}\n\n${args.systemTail}` : args.system;
}
